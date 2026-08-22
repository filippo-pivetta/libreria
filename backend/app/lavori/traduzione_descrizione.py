"""Traduzione assistita delle descrizioni mancanti (issue #24, sotto-issue
rimanente di #20 punto 6).

La fetta #21 (Descrizione) recupera testo reale per lingua — Wikipedia via
i sitelink di Wikidata, ripiego Google Books — senza mai tradurre: dove
nessuna fonte ha il testo in una lingua, il campo resta vuoto (design-
frontend.md §9). Questo lavoro copre il caso in cui un'opera ha una
descrizione reale in una delle due lingue dell'interfaccia (it/en) ma non
nell'altra: il modello traduce il testo esistente, non lo genera da zero
— stessa regola "mai inventato" delle altre funzioni assistite di #20,
qui applicata alla lingua invece che alla lunghezza.

Accodato da `catalogo_repository.crea_scheda` (per l'asimmetria che
Google Books lascia alla nascita della scheda) e da
`app/lavori/descrizioni.py` (per l'asimmetria che resta dopo il tentativo
Wikipedia, l'ultimo scrittore della pipeline quando Wikidata ha sitelink).

Trattamento di trasparenza: nessun campo dedicato — decisione presa in
questa issue di riusare `libro_descrizione.riformulata`, il cui
significato si allarga da "riformulato" a "non è la citazione letterale
della fonte in questa lingua" (migrazione 20260822173331).
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database, lavoro_repository

logger = logging.getLogger("app.lavori.traduzione_descrizione")


async def esegui(payload: dict[str, Any]) -> None:
    libro_id = str(payload["libro_id"])
    lingua_mancante = str(payload["lingua_mancante"])
    lingua_sorgente = str(payload["lingua_sorgente"])

    def _leggi() -> tuple[
        str | None, tuple[str, str, str | None] | None, str, list[str], int | None, list[str]
    ]:
        with database.apri_connessione() as connessione:
            testo_mancante = catalogo_repository.leggi_descrizione(
                connessione, libro_id, lingua_mancante
            )
            sorgente = catalogo_repository.leggi_descrizione_con_fonte(
                connessione, libro_id, lingua_sorgente
            )
            titolo, autori, anno, generi = catalogo_repository.contesto_bibliografico(
                connessione, libro_id
            )
        return testo_mancante, sorgente, titolo, autori, anno, generi

    testo_mancante, sorgente, titolo, autori, _anno, _generi = await run_in_threadpool(_leggi)

    if testo_mancante is not None:
        # Un'altra fonte (tipicamente Wikipedia) ha già scritto un testo
        # reale per questa lingua fra l'accodamento e l'esecuzione: la
        # traduzione non serve più, non è un fallimento.
        return

    if sorgente is None:
        # La lingua sorgente non ha più una descrizione (fusione/dedup
        # fuori banda?): nulla da tradurre.
        return
    testo_sorgente, fonte_sorgente, url_fonte_sorgente = sorgente

    try:
        testo_tradotto = await llm.traduci_descrizione(
            titolo=titolo,
            autori=autori,
            testo_sorgente=testo_sorgente,
            lingua_sorgente=lingua_sorgente,
            lingua_target=lingua_mancante,
        )
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            scritta = catalogo_repository.scrivi_descrizione_tradotta(
                connessione,
                libro_id,
                lingua_mancante,
                testo_tradotto,
                fonte_sorgente,
                url_fonte_sorgente,
            )
            fuori_standard = (
                len(testo_tradotto) < catalogo_repository.SOGLIA_MINIMA_DESCRIZIONE
                or len(testo_tradotto) > catalogo_repository.SOGLIA_MASSIMA_DESCRIZIONE
            )
            if scritta and fuori_standard:
                lavoro_repository.accoda(
                    connessione,
                    "standardizzazione_descrizione",
                    f"{libro_id}:{lingua_mancante}",
                    {"libro_id": libro_id, "lingua": lingua_mancante},
                )

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuna scrittura: la lingua resta senza descrizione, come già
    oggi quando nessuna fonte la fornisce (PRD, entità Descrizione: "se
    nessuna fonte ha una descrizione dell'opera, il campo resta vuoto")."""
    logger.warning(
        "Traduzione descrizione di %s (%s -> %s) non riuscita: %s",
        payload.get("libro_id"),
        payload.get("lingua_sorgente"),
        payload.get("lingua_mancante"),
        errore,
    )
