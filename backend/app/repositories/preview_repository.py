"""Il contesto che le funzioni assistite personali inviano al fornitore
di modelli, e nient'altro (issue #6, esteso dall'issue #27 a sintesi
tematica e suggerimenti di lettura — nome del file invariato perché è
nato con la preview, non perché sia rimasto suo).

Repository a sé e non funzioni in più dentro `voce_repository`: qui ogni
`select` è materiale che esce dal sistema, e la lista delle colonne è il
documento che dimostra la regola 19. Mescolarle a quelle di uso interno
avrebbe reso la verifica una lettura di tutto il file invece che di
questo.

Due cose che NON compaiono in nessuna query di questo modulo, e non per
distrazione:

- `voce_di_libreria_privata`, cioè la nota di intenzione. Non esce in
  nessuno stato del consenso (PRD): contiene abitualmente nomi di persone
  che non usano l'applicazione.
- Qualunque riga di un altro Utente. Ogni funzione filtra esplicitamente
  su `utente_id` oltre alla RLS, come già fanno `GET /voci` e il dedup di
  `POST /voci` da quando un collegato può leggere le stesse righe.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

LINGUA_INTERFACCIA = "it"

MASSIMO_LIBRI_STORICO = 40
"""Quanti libri finiti si raccontano al modello. Non un limite di costo
ma di segnale: oltre qualche decina di titoli il prompt diventa un elenco
in cui nessuna preferenza risalta, e il parere torna generico."""

MASSIMO_TESTI_PROPRI = 30
"""Quanti fra insight e recensioni. Stessa ragione, più una pratica: sono
testi senza limite di lunghezza (PRD), e il più recente dice di più del
più vecchio."""

LUNGHEZZA_MASSIMA_TESTO = 1200
"""Ogni testo è troncato qui prima di uscire. Un insight lunghissimo non
va escluso — è proprio il tipo di contenuto che dice qualcosa su chi
legge — ma nemmeno lasciato riempire da solo l'intero contesto."""

_SELECT_LIBRO = (
    "id, titolo_canonico, anno_prima_pubblicazione, "
    "libro_autore(ordine, autore:autore_id(nome_canonico)), "
    "libro_genere(genere:genere_id(genere_etichetta(lingua, etichetta))), "
    "libro_descrizione(lingua, testo)"
)


def _autori(libro: dict[str, Any]) -> list[str]:
    return [
        riga["autore"]["nome_canonico"]
        for riga in libro.get("libro_autore", [])
        if riga.get("autore")
    ]


def _generi(libro: dict[str, Any]) -> list[str]:
    etichette = []
    for riga in libro.get("libro_genere", []):
        genere = riga.get("genere") or {}
        for e in genere.get("genere_etichetta", []):
            if e.get("lingua") == LINGUA_INTERFACCIA:
                etichette.append(e["etichetta"])
    return etichette


def _descrizione(libro: dict[str, Any]) -> str | None:
    for riga in libro.get("libro_descrizione", []):
        if riga.get("lingua") == LINGUA_INTERFACCIA:
            return str(riga["testo"])
    return None


def scheda_del_libro(client: Client, voce_id: UUID, utente_id: UUID) -> dict[str, Any] | None:
    """Il libro su cui si chiede il parere. Dato di catalogo condiviso:
    uscirebbe comunque con le funzioni bibliografiche, che il consenso non
    copre. Il filtro su `utente_id` serve alla Voce, non al libro — una
    preview si genera solo su una propria Voce (regola 23: l'artefatto è
    legato alla Voce da cui è stato invocato)."""
    response = (
        client.table("voce_di_libreria")
        .select(f"id, stato, libro:libro_id ({_SELECT_LIBRO})")
        .eq("id", str(voce_id))
        .eq("utente_id", str(utente_id))
        .maybe_single()
        .execute()
    )
    if response is None or not response.data:
        return None
    riga = cast("dict[str, Any]", response.data)
    libro = riga.get("libro") or {}
    return {
        "titolo": libro.get("titolo_canonico", ""),
        "autori": _autori(libro),
        "generi": _generi(libro),
        "anno_prima_pubblicazione": libro.get("anno_prima_pubblicazione"),
        "descrizione": _descrizione(libro),
    }


def storico_personale(
    client: Client, utente_id: UUID, escludi_voce_id: UUID | None = None
) -> list[tuple[str, list[str], list[str], float | None]]:
    """I libri finiti dal richiedente, con il suo voto.

    Solo `stato = 'letto'`: "a partire dallo storico" del PRD sono le
    letture concluse, non la coda dei desideri, che dice cosa si spera di
    leggere e non cosa è piaciuto. `escludi_voce_id` esclude la Voce su
    cui si sta chiedendo un parere, che altrimenti comparirebbe come già
    letta: solo la preview lo passa. I suggerimenti di lettura (issue
    #27) chiamano questa funzione senza esclusione, perché non c'è una
    singola Voce a cui la richiesta si riferisce.
    """
    query = (
        client.table("voce_di_libreria")
        .select(f"id, voto, libro:libro_id ({_SELECT_LIBRO})")
        .eq("utente_id", str(utente_id))
        .eq("stato", "letto")
    )
    if escludi_voce_id is not None:
        query = query.neq("id", str(escludi_voce_id))
    response = query.order("aggiornato_at", desc=True).limit(MASSIMO_LIBRI_STORICO).execute()
    storico = []
    for riga in cast("list[dict[str, Any]]", response.data):
        libro = riga.get("libro") or {}
        voto = riga.get("voto")
        storico.append(
            (
                str(libro.get("titolo_canonico") or ""),
                _autori(libro),
                _generi(libro),
                float(voto) if voto is not None else None,
            )
        )
    return storico


def testi_propri(client: Client, utente_id: UUID) -> list[str]:
    """Insight e recensioni del richiedente, privati compresi.

    I privati non sono un'eccezione strappata: il testo del consenso li
    nomina esplicitamente ("I testi che scrivi, insight e recensioni
    compresi"), ed è la ragione per cui il consenso esiste. Lo spoiler non
    filtra nulla qui: è una regola di presentazione verso altri lettori
    (regola 10), non un segreto verso se stessi.

    Le due tabelle si ordinano e si tagliano **insieme**, non una alla
    volta. Fino al 22 agosto 2026 il tetto si applicava dopo aver
    concatenato prima tutti gli insight e poi tutte le recensioni: con
    trenta o più insight — normale, sono molti per Voce contro una sola
    recensione per Voce — nessuna recensione arrivava mai al fornitore,
    e la funzione prometteva "insight e recensioni" mandando solo i
    primi. Stesso rimedio già applicato a `testi_propri_con_riferimenti`.

    Le due date non sono lo stesso tipo (`insight.data` è una data scelta
    dall'Utente, `recensione.aggiornato_at` un istante): si troncano
    entrambe al giorno prima di confrontarle, quindi fra un insight e una
    recensione dello stesso giorno l'ordine è arbitrario ma stabile. A
    questa scala non vale una colonna in più per risolverlo.
    """
    grezzi: list[tuple[str, str]] = []
    for tabella, colonna_data in (("insight", "data"), ("recensione", "aggiornato_at")):
        response = (
            client.table(tabella)
            .select(f"testo, {colonna_data}")
            .eq("utente_id", str(utente_id))
            .order(colonna_data, desc=True)
            .limit(MASSIMO_TESTI_PROPRI)
            .execute()
        )
        for r in cast("list[dict[str, Any]]", response.data):
            if not r.get("testo"):
                continue
            data = r.get(colonna_data)
            grezzi.append(
                (str(data)[:10] if data else "", str(r["testo"])[:LUNGHEZZA_MASSIMA_TESTO])
            )
    grezzi.sort(key=lambda coppia: coppia[0], reverse=True)
    return [testo for _, testo in grezzi[:MASSIMO_TESTI_PROPRI]]


def testi_propri_con_riferimenti(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """Come `testi_propri`, ma ogni testo porta con sé da dove viene (issue
    #27, sintesi tematica a temi): titolo e id della Voce — per collegare
    un tema al libro invece di limitarsi a nominarlo — più tipo, id e data
    del contenuto, per poter mostrare l'insight o la recensione vera dietro
    un tema invece di un riassunto del riassunto. Stessi due insiemi di
    `testi_propri`, stesso filtro su `utente_id`, mai
    `voce_di_libreria_privata`.

    L'embed verso `voce_di_libreria` si scrive per nome di tabella
    (`voce:voce_di_libreria(...)`) e non per colonna (`voce:voce_id(...)`):
    la FK di `insight`/`recensione` verso `voce_di_libreria` è composita
    (`voce_id, utente_id`, vedi AGENTS.md), e PostgREST non risolve
    l'embed dalla sola colonna `voce_id` di una chiave composita — lo
    stesso vincolo che rende ogni riga già garantita dell'utente proprietario.

    Le due tabelle si ordinano e si tagliano **insieme**, non una alla
    volta: prendere i trenta insight più recenti e le trenta recensioni
    più recenti e poi tagliare la somma a trenta affamerebbe
    sistematicamente la tabella più numerosa (di solito gli insight,
    molti per Voce, contro una sola recensione per Voce) — un difetto
    preesistente di `testi_propri`, non ripetuto qui.
    """
    embed_voce = "voce:voce_di_libreria (id, libro:libro_id (titolo_canonico))"
    grezzi: list[dict[str, Any]] = []
    for tabella, colonna_data in (("insight", "data"), ("recensione", "creato_at")):
        response = (
            client.table(tabella)
            .select(f"id, testo, {colonna_data}, {embed_voce}")
            .eq("utente_id", str(utente_id))
            .order(colonna_data, desc=True)
            .limit(MASSIMO_TESTI_PROPRI)
            .execute()
        )
        for r in cast("list[dict[str, Any]]", response.data):
            testo = r.get("testo")
            if not testo:
                continue
            voce = r.get("voce") or {}
            libro = voce.get("libro") or {}
            data = r.get(colonna_data)
            grezzi.append(
                {
                    "contenuto_id": r["id"],
                    "tipo": tabella,
                    "testo": str(testo)[:LUNGHEZZA_MASSIMA_TESTO],
                    "data": str(data)[:10] if data else None,
                    "voce_id": voce.get("id"),
                    "titolo": str(libro.get("titolo_canonico") or ""),
                }
            )
    grezzi.sort(key=lambda r: r["data"] or "", reverse=True)
    return grezzi[:MASSIMO_TESTI_PROPRI]


_SELECT_PROFILO = (
    f"id, stato, voto, libro:libro_id ({_SELECT_LIBRO}), "
    "letture:lettura (data_fine, esito), recensione (testo), insight (testo, data)"
)

MASSIMO_INSIGHT_PER_VOCE = 2
"""Quanti insight per libro entrano nel profilo dei suggerimenti. Un
libro con dodici insight non deve pesare dodici volte più di uno con
uno solo: qui conta il libro, non il numero di note che gli hai
dedicato."""

LUNGHEZZA_MINIMA_INSIGHT = 40
"""Sotto questa soglia un insight è quasi sempre rumore ("bello", "wow",
"da rileggere assolutamente"): dice che hai scritto qualcosa, non cosa
ti è piaciuto. Scartato qui, prima di arrivare al modello — un filtro di
lunghezza non ha bisogno di essere chiesto in un prompt, si misura."""


def _data_lettura(letture: list[dict[str, Any]], esito: str) -> str | None:
    """La data più recente fra le Letture chiuse con l'esito indicato
    (stesso pattern di `export_service._ultima_lettura_conclusa`, esteso
    anche a "abbandonata": qui serve sapere non solo quando un libro è
    stato finito, ma anche quando è stato lasciato)."""
    date = [
        str(lettura["data_fine"])
        for lettura in letture
        if lettura.get("esito") == esito and lettura.get("data_fine")
    ]
    return max(date) if date else None


def profilo_suggerimenti(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """Ogni Voce del richiedente, in **qualunque stato**, con tutto il
    segnale di gusto già appiattito: titolo/autori/generi/descrizione del
    libro, voto, stato, quando è stata conclusa o abbandonata l'ultima
    Lettura, il testo della recensione, gli insight sopra la soglia di
    rumore (issue #27, suggerimenti di lettura a profilo).

    Nessun filtro su `stato`, a differenza di `storico_personale` (solo
    "letto"): i suggerimenti hanno bisogno anche degli abbandoni, il
    segnale negativo più diretto che esiste e che prima non arrivava mai
    al modello, e di ogni Voce esistente (comprese quelle "da_leggere")
    per non riproporre un libro già in libreria in qualunque forma.
    `suggerimenti_service` decide come classificare le righe in
    pilastri/recenti/delusi/esclusi — la classificazione è una decisione
    di prodotto, l'appiattimento no, stessa divisione fra "cosa si legge"
    e "cosa se ne fa" di `export_repository`/`export_service`, che usa lo
    stesso pattern di embed per `letture`/`recensione`.
    """
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_PROFILO)
        .eq("utente_id", str(utente_id))
        .execute()
    )
    profilo: list[dict[str, Any]] = []
    for riga in cast("list[dict[str, Any]]", response.data):
        libro = riga.get("libro") or {}
        recensione = riga.get("recensione")
        if isinstance(recensione, list):
            recensione = recensione[0] if recensione else None
        insight_validi = sorted(
            (
                i
                for i in (riga.get("insight") or [])
                if i.get("testo") and len(str(i["testo"]).strip()) >= LUNGHEZZA_MINIMA_INSIGHT
            ),
            key=lambda i: str(i.get("data") or ""),
            reverse=True,
        )
        voto = riga.get("voto")
        profilo.append(
            {
                "voce_id": riga["id"],
                "stato": riga.get("stato"),
                "titolo": str(libro.get("titolo_canonico") or ""),
                "autori": _autori(libro),
                "generi": _generi(libro),
                "descrizione": _descrizione(libro),
                "voto": float(voto) if voto is not None else None,
                "recensione": (
                    str(recensione["testo"]) if recensione and recensione.get("testo") else None
                ),
                "insight": [
                    str(i["testo"]).strip() for i in insight_validi[:MASSIMO_INSIGHT_PER_VOCE]
                ],
                "data_conclusa": _data_lettura(riga.get("letture") or [], "conclusa"),
                "data_abbandonata": _data_lettura(riga.get("letture") or [], "abbandonata"),
            }
        )
    return profilo
