"""Recupero della descrizione dell'opera, per lingua.

Wikipedia è preferita a Google Books per qualità: è prosa scritta per
spiegare di cosa parla un libro, mentre la descrizione di Google è testo
di quarta di copertina, scritto per venderlo. Copre però solo le opere
notabili, e la descrizione di Google viene già scritta alla nascita della
scheda: questo lavoro la SOSTITUISCE dove Wikipedia arriva, e non fa nulla
dove non arriva.

Sta in secondo piano e non nella richiesta di aggiunta perché costa una
chiamata per lingua, e nessuna di esse deve poter rallentare — o far
fallire — l'aggiunta di un libro.
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import wikipedia
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database

logger = logging.getLogger("app.lavori.descrizioni")

LINGUE = ("it", "en")
"""Le lingue dell'interfaccia (PRD: bilingue dal primo giorno). Non tutte
quelle che Wikipedia ha: conservare descrizioni in lingue che nessuno può
leggere occuperebbe spazio senza servire a nessuno."""


async def esegui(payload: dict[str, Any]) -> None:
    libro_id = str(payload["libro_id"])
    titoli: dict[str, str] = payload.get("titoli_wikipedia") or {}

    trovate: list[tuple[str, str, str, str | None]] = []
    for lingua in LINGUE:
        titolo = titoli.get(lingua)
        if not titolo:
            continue
        try:
            sommario = await wikipedia.sommario(lingua, titolo)
        except FonteNonRaggiungibileError as errore:
            raise ErroreTransitorio(errore.motivo) from errore
        if sommario is not None:
            trovate.append((lingua, sommario.testo, "wikipedia", sommario.url))

    if not trovate:
        # Non è un fallimento: l'opera non è su Wikipedia, e la descrizione
        # di Google scritta alla nascita della scheda resta quella buona.
        logger.info("Nessuna descrizione da Wikipedia per %s.", libro_id)
        return

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.scrivi_descrizioni(connessione, libro_id, trovate)

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuno stato da scrivere: una descrizione mancante non è uno stato
    del prodotto, è semplicemente una descrizione in meno — e quella di
    Google, quando c'è, è già stata scritta alla nascita della scheda."""
    logger.warning("Descrizione di %s non recuperata: %s", payload.get("libro_id"), errore)
