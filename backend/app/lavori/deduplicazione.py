"""Deduplicazione assistita (issue #20, punto 4).

Gira quando la catena di risoluzione non trova nulla (né Open Library né
Wikidata, vedi `SchedaRisolta.canonicalizzata`): la scheda nasce non
canonicalizzata. Confronta con schede che condividono almeno un autore
esatto e, se il modello ritiene che sia la stessa opera, scrive SOLO una
proposta in `proposta_fusione_libro` — MAI una fusione eseguita in
autonomia. Vincolo assoluto dell'issue: un merge sbagliato corromperebbe
silenziosamente lo storico di lettura di un Utente sulla scheda
"perdente", l'errore più difficile da scoprire dei due possibili. Il
Manutentore rivede la proposta fuori banda e, se conferma, invoca
`public.fondi_libro` (ADR 0007 — nessuna fusione raggiungibile
dall'applicazione).
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database

logger = logging.getLogger("app.lavori.deduplicazione")


async def esegui(payload: dict[str, Any]) -> None:
    libro_id = str(payload["libro_id"])
    nuovo = llm.OperaPerConfronto(
        libro_id=libro_id,
        titolo=str(payload.get("titolo") or ""),
        autori=list(payload.get("autori") or []),
        descrizione=payload.get("descrizione"),
    )

    def _candidati() -> list[llm.OperaPerConfronto]:
        with database.apri_connessione() as connessione:
            righe = catalogo_repository.candidati_deduplicazione(connessione, libro_id)
        return [
            llm.OperaPerConfronto(
                libro_id=cid, titolo=titolo, autori=autori, descrizione=descrizione
            )
            for cid, titolo, autori, descrizione in righe
        ]

    candidati = await run_in_threadpool(_candidati)
    if not candidati:
        # Nessun altro libro condivide un autore: non c'è nulla con cui
        # confrontarsi, non vale la spesa di una chiamata al modello.
        return

    try:
        decisione = await llm.valuta_duplicati(nuovo, candidati)
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    if decisione is None:
        return

    validi = {c.libro_id for c in candidati}
    if decisione.libro_id_candidato not in validi:
        logger.warning(
            "Il modello ha restituito un libro_id_candidato fuori dai candidati per %s: %s",
            libro_id,
            decisione.libro_id_candidato,
        )
        return

    def _proponi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.proponi_fusione_libro(
                connessione, libro_id, decisione.libro_id_candidato, decisione.motivo
            )

    await run_in_threadpool(_proponi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuna scrittura: la scheda resta non canonicalizzata, esattamente
    lo stato pre-lavoro. Nessuno stato osservabile del prodotto dipende da
    questo — la deduplicazione è manutenzione ordinaria fuori banda, non
    qualcosa che il PRD chiede di mostrare a un Utente."""
    logger.warning("Deduplicazione di %s non riuscita: %s", payload.get("libro_id"), errore)
