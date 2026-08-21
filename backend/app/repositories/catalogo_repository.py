"""Scritture sul catalogo bibliografico condiviso (`libro` e tabelle
collegate), su connessione diretta a Postgres.

Non passa da PostgREST, per due ragioni indipendenti che puntano nella
stessa direzione (docs/adr/0016):

1. La nascita di una scheda tocca `libro`, `libro_autore`,
   `libro_riferimento_esterno`, `variante_titolo` e la coda dei lavori, e
   deve avvenire tutta o niente. Una scheda con l'identificativo esterno
   scritto ma gli autori no sarebbe peggio di nessuna scheda: il primo
   passo della risoluzione la ritroverebbe per sempre e non la
   ricostruirebbe mai. PostgREST non ha transazioni su più tabelle.
2. `service_role` non ha comunque i privilegi SQL sulle tabelle `public`
   — verificato sul database reale: solo REFERENCES, TRIGGER e TRUNCATE.
   Anche volendo, la chiave di servizio non potrebbe scrivere qui.

Nessuna di queste righe appartiene a un Utente: sono dato condiviso di
sistema, e la RLS su di esse non ha una forma basata su `auth.uid()` (vedi
i commenti accanto alle tabelle nella migrazione 20260818115830).
"""

from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

SOGLIA_MINIMA_DESCRIZIONE = 200
"""Sotto questa lunghezza (caratteri) una descrizione è troppo corta per
lo standard di prosa breve della scheda del libro e viene accodata per la
standardizzazione assistita (design-frontend.md §24, emendamento 21
agosto 2026). Non è un limite arbitrario: è la soglia sotto cui è
realistico che la fonte abbia scritto una frase sola invece di un
paragrafo."""

SOGLIA_MASSIMA_DESCRIZIONE = 900
"""Sopra questa lunghezza una descrizione supera lo standard (400-600
caratteri, con margine) e viene accorciata — tipicamente una trama
promozionale di Google Books, più lunga della prosa enciclopedica che la
scheda vuole. Tolleranza ampia apposta: solo ciò che è chiaramente fuori
standard paga una chiamata al modello, non ogni descrizione più lunga del
target."""


def aggiorna_copertina(
    connection: psycopg.Connection[Any],
    libro_id: str,
    miniatura_path: str,
    grande_path: str,
    colore_dominante: str,
    colore_dominante_scuro: str,
) -> None:
    """Registra la copertina recuperata e convertita.

    I campi si scrivono insieme perché `chk_libro_copertina_coerente` e
    `chk_libro_copertina_colore_scuro_coerente` li legano: lo stato
    'presente' senza percorso immagine (o viceversa), o un colore senza
    l'altro, sono righe che il database rifiuta, non casi da gestire qui.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.libro
               set copertina_stato = 'presente',
                   copertina_miniatura_path = %(miniatura)s,
                   copertina_grande_path = %(grande)s,
                   copertina_colore_dominante = %(colore)s,
                   copertina_colore_dominante_scuro = %(colore_scuro)s
             where id = %(id)s
            """,
            {
                "id": libro_id,
                "miniatura": miniatura_path,
                "grande": grande_path,
                "colore": colore_dominante,
                "colore_scuro": colore_dominante_scuro,
            },
        )


def segna_copertina(connection: psycopg.Connection[Any], libro_id: str, stato: str) -> None:
    """Scrive uno stato copertina che non comporta un'immagine.

    'assente' quando la fonte ha risposto e non ha l'immagine — un esito,
    non un fallimento (PRD: "segnaposto con titolo e autore, senza
    ulteriori tentativi automatici"). 'fallita' quando i tentativi si sono
    esauriti su errori di trasporto.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "update public.libro set copertina_stato = %(stato)s, "
            "copertina_miniatura_path = null, copertina_grande_path = null "
            "where id = %(id)s",
            {"id": libro_id, "stato": stato},
        )


def libro_per_riferimenti(
    connection: psycopg.Connection[Any], riferimenti: list[tuple[str, str]]
) -> UUID | None:
    """Il primo passo della catena di risoluzione: questo identificativo
    l'ho già visto?

    Una sola query sulla chiave primaria di `libro_riferimento_esterno`,
    zero chiamate esterne. A regime è il caso più frequente — il secondo
    Utente che aggiunge un libro che qualcuno ha già aggiunto — ed è il
    motivo per cui gli ISBN stanno in quella tabella insieme agli
    identificativi delle fonti, invece che in una tabella a parte.
    """
    if not riferimenti:
        return None
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "select libro_id from public.libro_riferimento_esterno "
            "where (fonte, identificativo) in "
            "(select * from unnest(%(fonti)s::text[], %(identificativi)s::text[])) "
            "limit 1",
            {
                "fonti": [f for f, _ in riferimenti],
                "identificativi": [i for _, i in riferimenti],
            },
        )
        riga = cursor.fetchone()
    return UUID(str(riga["libro_id"])) if riga else None


def _autore_id(connection: psycopg.Connection[Any], nome: str) -> UUID:
    """L'identità dell'autore per un nome di catalogo, creandola se serve.

    La riconduzione avviene su `autore_nome_variante` e per corrispondenza
    esatta della forma grezza: è la regola 22bis del PRD ("un nome
    d'autore ricondotto a un'identità esistente non crea un secondo autore
    nella metrica"), nella sua forma deterministica. La riconduzione
    assistita per le forme che non coincidono è un'altra cosa e non sta
    qui.

    Ogni forma vista viene comunque conservata come variante, anche quando
    coincide con il nome canonico: è ciò che rende reversibile una
    riconduzione sbagliata (commento su `autore_nome_variante`, migrazione
    20260818115830), perché l'informazione originale non va perduta.

    Solo qui — quando nasce un autore nuovo — si accoda il lavoro di
    riconduzione assistita (issue #20, punto 3): le corrispondenze esatte,
    il caso comune, non pagano mai una chiamata al modello.
    """
    from app.repositories import lavoro_repository

    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "select autore_id from public.autore_nome_variante where nome_variante = %(nome)s",
            {"nome": nome},
        )
        riga = cursor.fetchone()
        if riga:
            return UUID(str(riga["autore_id"]))

        cursor.execute(
            "insert into public.autore (nome_canonico) values (%(nome)s) returning id",
            {"nome": nome},
        )
        nuovo = cursor.fetchone()
        assert nuovo is not None  # RETURNING su un INSERT riuscito
        autore_id = UUID(str(nuovo["id"]))
        cursor.execute(
            "insert into public.autore_nome_variante (autore_id, nome_variante) "
            "values (%(autore)s, %(nome)s) on conflict (nome_variante) do nothing",
            {"autore": str(autore_id), "nome": nome},
        )

    lavoro_repository.accoda(
        connection,
        "riconduzione_autore",
        str(autore_id),
        {"autore_id": str(autore_id), "nome_variante": nome},
    )
    return autore_id


def crea_scheda(
    connection: psycopg.Connection[Any],
    titolo_canonico: str,
    autori: list[str],
    anno_prima_pubblicazione: int | None,
    lingua_originale: str | None,
    pagine_mediane: int | None,
    generi: list[str],
    soggetti: list[str],
    riferimenti: list[tuple[str, str, bool]],
    varianti_titolo: list[tuple[str, str, str]],
    descrizioni: list[tuple[str, str, str, str | None]],
    copertina_volume_id: str | None,
    copertina_isbn13: str | None,
    titoli_wikipedia: dict[str, str],
) -> UUID:
    """Fa nascere una scheda intera, o niente.

    Una sola transazione su sei tabelle più la coda. Non è prudenza
    generica: una scheda con l'identificativo esterno scritto ma gli
    autori no verrebbe ritrovata per sempre dal primo passo della catena
    di risoluzione, e non verrebbe mai ricostruita. È anche il motivo per
    cui queste scritture non passano da PostgREST, che non ha transazioni
    su più tabelle (docs/adr/0016).
    """
    from app.repositories import lavoro_repository

    with connection.transaction():
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                insert into public.libro
                  (titolo_canonico, anno_prima_pubblicazione, lingua_originale,
                   pagine_mediane_catalogo, copertina_stato)
                values (%(titolo)s, %(anno)s, %(lingua)s, %(pagine)s, 'in_attesa')
                returning id
                """,
                {
                    "titolo": titolo_canonico,
                    "anno": anno_prima_pubblicazione,
                    "lingua": lingua_originale,
                    "pagine": pagine_mediane,
                },
            )
            riga = cursor.fetchone()
            assert riga is not None
            libro_id = UUID(str(riga["id"]))

            for ordine, nome in enumerate(autori):
                autore_id = _autore_id(connection, nome)
                cursor.execute(
                    "insert into public.libro_autore (libro_id, autore_id, ordine) "
                    "values (%(libro)s, %(autore)s, %(ordine)s) on conflict do nothing",
                    {"libro": str(libro_id), "autore": str(autore_id), "ordine": ordine},
                )

            for genere in generi:
                cursor.execute(
                    "insert into public.libro_genere (libro_id, genere_id) "
                    "values (%(libro)s, %(genere)s) on conflict do nothing",
                    {"libro": str(libro_id), "genere": genere},
                )

            for fonte, identificativo, principale in riferimenti:
                # `do nothing` e non un errore: un altro Utente può aver
                # fatto nascere la stessa scheda un istante prima. Chi
                # chiama rileva il caso e riusa la sua.
                cursor.execute(
                    "insert into public.libro_riferimento_esterno "
                    "(libro_id, fonte, identificativo, principale) "
                    "values (%(libro)s, %(fonte)s, %(id)s, %(principale)s) "
                    "on conflict (fonte, identificativo) do nothing",
                    {
                        "libro": str(libro_id),
                        "fonte": fonte,
                        "id": identificativo,
                        "principale": principale,
                    },
                )

            for lingua, titolo, fonte in varianti_titolo:
                cursor.execute(
                    """
                    insert into public.variante_titolo (libro_id, lingua, titolo, fonte)
                    values (%(libro)s, %(lingua)s, %(titolo)s, %(fonte)s)
                    on conflict (libro_id, lingua) do update
                      set titolo = excluded.titolo, fonte = excluded.fonte
                      where public.rango_fonte_variante(excluded.fonte)
                          < public.rango_fonte_variante(variante_titolo.fonte)
                    """,
                    {
                        "libro": str(libro_id),
                        "lingua": lingua,
                        "titolo": titolo,
                        "fonte": fonte,
                    },
                )

            for lingua, testo, fonte, url in descrizioni:
                cursor.execute(
                    "insert into public.libro_descrizione "
                    "(libro_id, lingua, testo, fonte, url_fonte) "
                    "values (%(libro)s, %(lingua)s, %(testo)s, %(fonte)s, %(url)s) "
                    "on conflict (libro_id, lingua) do nothing",
                    {
                        "libro": str(libro_id),
                        "lingua": lingua,
                        "testo": testo,
                        "fonte": fonte,
                        "url": url,
                    },
                )

        # I lavori si accodano DENTRO la stessa transazione, non dopo: una
        # scheda che nascesse senza il suo recupero copertina resterebbe
        # `copertina_stato = 'in_attesa'` per sempre, con nessuno che la
        # serve — e l'Utente vedrebbe uno scaffale che aspetta
        # un'immagine che nessuno produrrà. Il libro_id non esiste prima
        # dell'insert, quindi è qui e non nel chiamante che i payload si
        # possono comporre.
        if copertina_volume_id or copertina_isbn13:
            lavoro_repository.accoda(
                connection,
                "copertina",
                str(libro_id),
                {
                    "libro_id": str(libro_id),
                    "google_volume_id": copertina_volume_id,
                    "isbn13": copertina_isbn13,
                },
            )
        if titoli_wikipedia:
            lavoro_repository.accoda(
                connection,
                "descrizione",
                str(libro_id),
                {"libro_id": str(libro_id), "titoli_wikipedia": titoli_wikipedia},
            )

        # Emendamento design-frontend.md §24 (21 agosto 2026): descrizioni
        # fuori standard (misurato: alcune voci Wikipedia sono una frase
        # sola, es. "Le notti bianche è un racconto giovanile di Fëdor
        # Dostoevskij."; altre — soprattutto le trame di Google Books —
        # lo superano abbondantemente) vengono riformulate dal modello,
        # espandendo o accorciando secondo il caso. Solo quelle scritte
        # QUI (Google Books, alla nascita) — il lavoro "descrizione"
        # innesca lo stesso controllo per conto suo quando scrive la
        # versione Wikipedia.
        for lingua, testo, _, _ in descrizioni:
            if len(testo) < SOGLIA_MINIMA_DESCRIZIONE or len(testo) > SOGLIA_MASSIMA_DESCRIZIONE:
                lavoro_repository.accoda(
                    connection,
                    "standardizzazione_descrizione",
                    f"{libro_id}:{lingua}",
                    {"libro_id": str(libro_id), "lingua": lingua},
                )

        # Punti 1+2 dell'issue #20, accorpati in un solo lavoro: si accoda
        # solo ciò che il catalogo primario e Wikidata non hanno già
        # risolto (regola 21/22 — la scheda nasce comunque, l'arricchimento
        # assistito non è mai nel percorso critico di POST /libri).
        necessita: dict[str, bool] = {}
        if not generi:
            necessita["genere"] = True
        if anno_prima_pubblicazione is None:
            necessita["anno"] = True
        if lingua_originale is None:
            necessita["lingua"] = True
        if necessita:
            lavoro_repository.accoda(
                connection,
                "arricchimento_bibliografico",
                str(libro_id),
                {
                    "libro_id": str(libro_id),
                    "titolo": titolo_canonico,
                    "autori": autori,
                    "soggetti": soggetti,
                    "necessita": necessita,
                },
            )

        # Punto 4: nessuna fonte canonica ha risolto l'opera (stessa
        # condizione di SchedaRisolta.canonicalizzata). Il confronto
        # assistito gira in secondo piano e PROPONE soltanto — mai una
        # fusione eseguita in autonomia (issue #20, vincolo assoluto).
        if not any(f in ("open_library", "wikidata") for f, _, _ in riferimenti):
            lavoro_repository.accoda(
                connection,
                "deduplicazione_libro",
                str(libro_id),
                {
                    "libro_id": str(libro_id),
                    "titolo": titolo_canonico,
                    "autori": autori,
                    "descrizione": _descrizione_rappresentativa(descrizioni),
                },
            )

    return libro_id


def _descrizione_rappresentativa(
    descrizioni: list[tuple[str, str, str, str | None]],
) -> str | None:
    """La descrizione da mandare al confronto assistito di deduplicazione:
    italiano se c'è, altrimenti inglese, altrimenti la prima disponibile.
    Stesso criterio di preferenza linguistica usato altrove nel prodotto
    (docs/design-frontend.md: italiano e inglese sono le due lingue
    dell'interfaccia)."""
    per_lingua = {lingua: testo for lingua, testo, _, _ in descrizioni}
    return per_lingua.get("it") or per_lingua.get("en") or next(iter(per_lingua.values()), None)


def scrivi_descrizioni(
    connection: psycopg.Connection[Any],
    libro_id: str,
    descrizioni: list[tuple[str, str, str, str | None]],
) -> None:
    """Sostituisce la descrizione di una lingua con una di fonte migliore.

    Wikipedia vince su Google Books: `do update` senza condizioni perché
    solo Wikipedia passa da qui — la descrizione di Google si scrive alla
    nascita della scheda e non viene mai riscritta. Se un giorno le fonti
    diventassero più di due, questo diventerebbe un arbitraggio esplicito
    come quello delle varianti di titolo.
    """
    with connection.cursor() as cursor:
        for lingua, testo, fonte, url in descrizioni:
            cursor.execute(
                """
                insert into public.libro_descrizione
                  (libro_id, lingua, testo, fonte, url_fonte)
                values (%(libro)s, %(lingua)s, %(testo)s, %(fonte)s, %(url)s)
                on conflict (libro_id, lingua) do update
                  set testo = excluded.testo,
                      fonte = excluded.fonte,
                      url_fonte = excluded.url_fonte
                """,
                {
                    "libro": libro_id,
                    "lingua": lingua,
                    "testo": testo,
                    "fonte": fonte,
                    "url": url,
                },
            )


def aggiungi_riferimenti(
    connection: psycopg.Connection[Any],
    libro_id: UUID,
    riferimenti: list[tuple[str, str, bool]],
) -> int:
    """Attacca a una scheda esistente gli identificativi con cui la si è
    appena ritrovata.

    È il guadagno concreto della cardinalità 1:N, e senza questa funzione
    resterebbe teorico. Un Utente cerca un libro e sceglie un'edizione che
    il sistema non aveva mai visto: si paga la catena di risoluzione
    esterna (misurata: diversi secondi) per scoprire che l'opera era già
    una scheda. Registrando qui gli identificativi di quell'edizione, la
    prossima volta che qualcuno la sceglie il riconoscimento è una query
    sulla chiave primaria — e il catalogo si arricchisce con l'uso invece
    che con un lavoro fuori banda.

    `principale = false` sempre: un riferimento arrivato per questa via è
    una via d'accesso in più, non una promozione a rappresentante di
    quella fonte. Il vincolo unico parziale su (libro, fonte) dove
    `principale` lo impedirebbe comunque, ma vale scriverlo.
    """
    if not riferimenti:
        return 0
    scritti = 0
    with connection.cursor() as cursor:
        for fonte, identificativo, _ in riferimenti:
            cursor.execute(
                "insert into public.libro_riferimento_esterno "
                "(libro_id, fonte, identificativo, principale) "
                "values (%(libro)s, %(fonte)s, %(id)s, false) "
                "on conflict (fonte, identificativo) do nothing",
                {"libro": str(libro_id), "fonte": fonte, "id": identificativo},
            )
            scritti += cursor.rowcount
    return scritti


# ============================================================================
# Arricchimento bibliografico assistito (issue #20, punti 1+2)
# ============================================================================


def generi_ammessi(
    connection: psycopg.Connection[Any], lingua: str = "it"
) -> list[tuple[str, str]]:
    """L'elenco chiuso dei generi con l'etichetta nella lingua data, per il
    prompt del modello — mai duplicato a mano: letto dalla stessa tabella
    che il Manutentore gestisce fuori banda (ADR 0005)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "select genere_id, etichetta from public.genere_etichetta "
            "where lingua = %(lingua)s order by genere_id",
            {"lingua": lingua},
        )
        return [(str(riga[0]), str(riga[1])) for riga in cursor.fetchall()]


def scrivi_arricchimento_bibliografico(
    connection: psycopg.Connection[Any],
    libro_id: str,
    generi: list[str],
    anno_prima_pubblicazione: int | None,
    lingua_originale: str | None,
) -> None:
    """Scrive l'esito del lavoro di arricchimento assistito, difensiva su
    entrambi i fronti.

    Il genere si scrive SOLO se la scheda è ancora "non classificato": la
    regola 21/22 vieta a qualunque esecuzione automatica di sovrascrivere
    un genere già presente, sia esso stato dedotto in precedenza sia stato
    corretto fuori banda dal Manutentore — `where not exists` invece di un
    upsert lo rende impossibile per costruzione, non per convenzione.

    Anno e lingua si scrivono solo se ancora assenti (COALESCE): il flag
    `*_dedotto` si alza solo quando è DAVVERO questa scrittura a
    valorizzare il campo, mai quando il valore era già di fonte — il lato
    destro dell'OR legge il valore precedente alla riga, non quello appena
    scritto dal COALESCE nella stessa istruzione.
    """
    with connection.cursor() as cursor:
        if generi:
            cursor.execute(
                """
                insert into public.libro_genere (libro_id, genere_id)
                select %(libro)s, unnest(%(generi)s::text[])
                where not exists (
                  select 1 from public.libro_genere where libro_id = %(libro)s
                )
                on conflict do nothing
                """,
                {"libro": libro_id, "generi": generi},
            )
        cursor.execute(
            """
            update public.libro
               set anno_prima_pubblicazione = coalesce(anno_prima_pubblicazione, %(anno)s),
                   anno_dedotto = anno_dedotto
                     or (anno_prima_pubblicazione is null and %(anno)s is not null),
                   lingua_originale = coalesce(lingua_originale, %(lingua)s),
                   lingua_dedotta = lingua_dedotta
                     or (lingua_originale is null and %(lingua)s is not null)
             where id = %(libro)s
            """,
            {"libro": libro_id, "anno": anno_prima_pubblicazione, "lingua": lingua_originale},
        )


# ============================================================================
# Riconduzione autori assistita (issue #20, punto 3)
# ============================================================================


def tutti_autori(connection: psycopg.Connection[Any]) -> list[tuple[str, str]]:
    """id e nome canonico di ogni autore.

    Alla scala del prodotto (un gruppo chiuso, PRD) è una lettura leggera,
    non un problema di scala: filtrare i candidati per cognome in Python
    (app.core.testo.cognome) riusa la normalizzazione già scritta per la
    riconduzione deterministica del nucleo, che SQL non replicherebbe
    senza duplicarla.
    """
    with connection.cursor() as cursor:
        cursor.execute("select id, nome_canonico from public.autore")
        return [(str(riga[0]), str(riga[1])) for riga in cursor.fetchall()]


def varianti_di_autori(
    connection: psycopg.Connection[Any], autore_ids: list[str]
) -> dict[str, list[str]]:
    """Le varianti di nome note per un insieme di autori, per costruire i
    candidati mostrati al modello nel confronto di riconduzione."""
    if not autore_ids:
        return {}
    with connection.cursor() as cursor:
        cursor.execute(
            "select autore_id, nome_variante from public.autore_nome_variante "
            "where autore_id = any(%(ids)s::uuid[])",
            {"ids": autore_ids},
        )
        risultato: dict[str, list[str]] = {i: [] for i in autore_ids}
        for autore_id, variante in cursor.fetchall():
            risultato[str(autore_id)].append(str(variante))
        return risultato


def fondi_autore(
    connection: psycopg.Connection[Any],
    autore_id_canonico: str,
    autore_id_duplicato: str,
    nome_variante: str,
    motivo: str,
) -> None:
    """Esegue la riconduzione decisa dal modello: sposta varianti e libri
    dell'autore duplicato su quello canonico, cancella il duplicato, e
    registra l'operazione in `autore_riconduzione` — l'unica cosa che la
    rende ispezionabile e reversibile fuori banda (issue #20, punto 3;
    ADR 0007, nessun meccanismo di rollback applicativo).

    A differenza della deduplicazione libri, questa esecuzione È
    automatica quando il modello è confidente: il raggio d'azione resta
    dentro il catalogo condiviso (autore, autore_nome_variante,
    libro_autore), mai `voce_di_libreria`.
    """
    with connection.transaction():
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "select nome_canonico from public.autore where id = %(id)s",
                {"id": autore_id_duplicato},
            )
            riga = cursor.fetchone()
            nome_duplicato = str(riga["nome_canonico"]) if riga else ""

            cursor.execute(
                "update public.autore_nome_variante set autore_id = %(canonico)s "
                "where autore_id = %(duplicato)s",
                {"canonico": autore_id_canonico, "duplicato": autore_id_duplicato},
            )
            # Se lo stesso libro referenzia già entrambi gli autori (caso
            # raro: due nomi diversi dello stesso autore nella lista
            # autori di un'opera), il repoint non tocca quella riga —
            # violerebbe la PK (libro_id, autore_id) — e la DELETE sotto
            # la ripulisce.
            cursor.execute(
                """
                update public.libro_autore la
                   set autore_id = %(canonico)s
                 where la.autore_id = %(duplicato)s
                   and not exists (
                     select 1 from public.libro_autore la2
                      where la2.libro_id = la.libro_id and la2.autore_id = %(canonico)s
                   )
                """,
                {"canonico": autore_id_canonico, "duplicato": autore_id_duplicato},
            )
            cursor.execute(
                "delete from public.libro_autore where autore_id = %(duplicato)s",
                {"duplicato": autore_id_duplicato},
            )
            cursor.execute(
                "delete from public.autore where id = %(duplicato)s",
                {"duplicato": autore_id_duplicato},
            )
            cursor.execute(
                """
                insert into public.autore_riconduzione
                  (autore_id_canonico, autore_id_duplicato, nome_duplicato, nome_variante, motivo)
                values (%(canonico)s, %(duplicato)s, %(nome_duplicato)s, %(variante)s, %(motivo)s)
                """,
                {
                    "canonico": autore_id_canonico,
                    "duplicato": autore_id_duplicato,
                    "nome_duplicato": nome_duplicato,
                    "variante": nome_variante,
                    "motivo": motivo,
                },
            )


# ============================================================================
# Deduplicazione assistita (issue #20, punto 4)
# ============================================================================


def candidati_deduplicazione(
    connection: psycopg.Connection[Any], libro_id: str
) -> list[tuple[str, str, list[str], str | None]]:
    """Altri libri che condividono almeno un autore ESATTO col nuovo.

    Non per somiglianza di titolo: il caso di riferimento del PRD è
    proprio la traduzione che il catalogo non collega, dove i titoli
    possono essere in lingue diverse — filtrare per titolo escluderebbe
    esattamente il caso che questa funzione deve intercettare. Il filtro
    per identità autore esatta è già economico e preciso, perché la
    riconduzione assistita (punto 3) canonicalizza l'identità autore
    quando possibile.
    """
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            select l.id, l.titolo_canonico,
                   coalesce(
                     array_agg(distinct a.nome_canonico) filter (where a.nome_canonico is not null),
                     array[]::text[]
                   ) as autori,
                   (
                     select ld.testo from public.libro_descrizione ld
                      where ld.libro_id = l.id
                      order by (ld.lingua = 'it') desc, (ld.lingua = 'en') desc
                      limit 1
                   ) as descrizione
              from public.libro l
              join public.libro_autore la on la.libro_id = l.id
              left join public.autore a on a.id = la.autore_id
             where la.autore_id in (
               select autore_id from public.libro_autore where libro_id = %(libro)s
             )
               and l.id != %(libro)s
             group by l.id, l.titolo_canonico
             limit 20
            """,
            {"libro": libro_id},
        )
        return [
            (
                str(riga["id"]),
                str(riga["titolo_canonico"]),
                list(riga["autori"]),
                riga["descrizione"],
            )
            for riga in cursor.fetchall()
        ]


def proponi_fusione_libro(
    connection: psycopg.Connection[Any], libro_id_a: str, libro_id_b: str, motivo: str
) -> None:
    """Registra SOLO una proposta di fusione — mai una fusione eseguita
    (issue #20, vincolo assoluto: un merge sbagliato corromperebbe
    silenziosamente lo storico di lettura di un Utente). Il Manutentore la
    rivede fuori banda e, se conferma, invoca `public.fondi_libro`."""
    a, b = sorted((libro_id_a, libro_id_b))
    with connection.cursor() as cursor:
        cursor.execute(
            "insert into public.proposta_fusione_libro (libro_id_a, libro_id_b, motivo) "
            "values (%(a)s, %(b)s, %(motivo)s) "
            "on conflict (libro_id_a, libro_id_b) do nothing",
            {"a": a, "b": b, "motivo": motivo},
        )


# ============================================================================
# Arricchimento descrizioni troppo corte (design-frontend.md §24,
# emendamento 21 agosto 2026)
# ============================================================================


def leggi_descrizione(
    connection: psycopg.Connection[Any], libro_id: str, lingua: str
) -> str | None:
    """Il testo corrente per (libro, lingua), letto fresco all'esecuzione
    del lavoro e non fidandosi del payload accodato: fra l'accodamento e
    l'esecuzione un'altra fonte potrebbe averlo già sostituito con una
    versione migliore (es. Wikipedia dopo Google Books)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "select testo from public.libro_descrizione "
            "where libro_id = %(libro)s and lingua = %(lingua)s",
            {"libro": libro_id, "lingua": lingua},
        )
        riga = cursor.fetchone()
        return str(riga[0]) if riga else None


def contesto_bibliografico(
    connection: psycopg.Connection[Any], libro_id: str
) -> tuple[str, list[str], int | None, list[str]]:
    """Titolo, autori, anno di prima pubblicazione e generi (etichette in
    italiano) — i soli fatti già verificati che l'arricchimento della
    descrizione può usare come contesto, oltre al testo sorgente stesso
    (mai la conoscenza generale del modello sull'opera)."""
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "select titolo_canonico, anno_prima_pubblicazione "
            "from public.libro where id = %(libro)s",
            {"libro": libro_id},
        )
        riga = cursor.fetchone()
        titolo = str(riga["titolo_canonico"]) if riga else ""
        anno = riga["anno_prima_pubblicazione"] if riga else None

        cursor.execute(
            "select a.nome_canonico from public.libro_autore la "
            "join public.autore a on a.id = la.autore_id "
            "where la.libro_id = %(libro)s order by la.ordine",
            {"libro": libro_id},
        )
        autori = [str(r["nome_canonico"]) for r in cursor.fetchall()]

        cursor.execute(
            "select ge.etichetta from public.libro_genere lg "
            "join public.genere_etichetta ge on ge.genere_id = lg.genere_id and ge.lingua = 'it' "
            "where lg.libro_id = %(libro)s",
            {"libro": libro_id},
        )
        generi = [str(r["etichetta"]) for r in cursor.fetchall()]

    return titolo, autori, anno, generi


def scrivi_descrizione_riformulata(
    connection: psycopg.Connection[Any], libro_id: str, lingua: str, testo_riformulato: str
) -> None:
    """Sostituisce il testo con la versione riformulata dal modello
    (espansa o accorciata, a seconda del caso) e la marca `riformulata`.

    Difensiva: scrive solo se la riga è ancora fuori standard al momento
    della scrittura — se un'altra fonte l'ha già sostituita con una
    versione nella fascia giusta nel frattempo (es. Wikipedia dopo
    Google Books), quella vince e questa scrittura non ha effetto
    (nessun blind overwrite, stesso principio delle scritture difensive
    di `scrivi_arricchimento_bibliografico`)."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.libro_descrizione
               set testo = %(testo)s, riformulata = true
             where libro_id = %(libro)s and lingua = %(lingua)s
               and (length(testo) < %(minima)s or length(testo) > %(massima)s)
            """,
            {
                "libro": libro_id,
                "lingua": lingua,
                "testo": testo_riformulato,
                "minima": SOGLIA_MINIMA_DESCRIZIONE,
                "massima": SOGLIA_MASSIMA_DESCRIZIONE,
            },
        )
