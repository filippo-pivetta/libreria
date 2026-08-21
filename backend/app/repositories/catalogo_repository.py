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


def aggiorna_copertina(
    connection: psycopg.Connection[Any],
    libro_id: str,
    miniatura_path: str,
    grande_path: str,
    colore_dominante: str,
) -> None:
    """Registra la copertina recuperata e convertita.

    I tre campi si scrivono insieme perché `chk_libro_copertina_coerente`
    li lega: lo stato 'presente' senza percorso immagine (o viceversa) è
    una riga che il database rifiuta, non un caso da gestire qui.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.libro
               set copertina_stato = 'presente',
                   copertina_miniatura_path = %(miniatura)s,
                   copertina_grande_path = %(grande)s,
                   copertina_colore_dominante = %(colore)s
             where id = %(id)s
            """,
            {
                "id": libro_id,
                "miniatura": miniatura_path,
                "grande": grande_path,
                "colore": colore_dominante,
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
    """
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
    return autore_id


def crea_scheda(
    connection: psycopg.Connection[Any],
    titolo_canonico: str,
    autori: list[str],
    anno_prima_pubblicazione: int | None,
    lingua_originale: str | None,
    pagine_mediane: int | None,
    generi: list[str],
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

    return libro_id


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
