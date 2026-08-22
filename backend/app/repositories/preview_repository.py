"""Il contesto che la preview personalizzata invia al fornitore di
modelli, e nient'altro (issue #6).

Repository a sé e non tre funzioni in più dentro `voce_repository`: qui
ogni `select` è materiale che esce dal sistema, e la lista delle colonne
è il documento che dimostra la regola 19. Mescolarle a quelle di uso
interno avrebbe reso la verifica una lettura di tutto il file invece che
di questo.

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
    client: Client, utente_id: UUID, escludi_voce_id: UUID
) -> list[tuple[str, list[str], list[str], float | None]]:
    """I libri finiti dal richiedente, con il suo voto.

    Solo `stato = 'letto'`: "a partire dallo storico" del PRD sono le
    letture concluse, non la coda dei desideri, che dice cosa si spera di
    leggere e non cosa è piaciuto. Si esclude la Voce su cui si sta
    chiedendo il parere, che altrimenti comparirebbe come già letta.
    """
    response = (
        client.table("voce_di_libreria")
        .select(f"id, voto, libro:libro_id ({_SELECT_LIBRO})")
        .eq("utente_id", str(utente_id))
        .eq("stato", "letto")
        .neq("id", str(escludi_voce_id))
        .order("aggiornato_at", desc=True)
        .limit(MASSIMO_LIBRI_STORICO)
        .execute()
    )
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
    """
    testi: list[str] = []
    for tabella, ordine in (("insight", "data"), ("recensione", "aggiornato_at")):
        response = (
            client.table(tabella)
            .select("testo")
            .eq("utente_id", str(utente_id))
            .order(ordine, desc=True)
            .limit(MASSIMO_TESTI_PROPRI)
            .execute()
        )
        testi.extend(
            str(r["testo"])[:LUNGHEZZA_MASSIMA_TESTO]
            for r in cast("list[dict[str, Any]]", response.data)
            if r.get("testo")
        )
    return testi[:MASSIMO_TESTI_PROPRI]
