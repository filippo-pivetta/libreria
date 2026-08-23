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
from app.core.lingua import LINGUE_INTERFACCIA as LINGUE
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database, lavoro_repository

logger = logging.getLogger("app.lavori.descrizioni")

# `LINGUE` (issue #34/#40): le lingue dell'interfaccia (PRD: bilingue dal
# primo giorno), importate da `app.core.lingua.LINGUE_INTERFACCIA` invece
# di una quarta copia hardcoded — non tutte quelle che Wikipedia ha:
# conservare descrizioni in lingue che nessuno può leggere occuperebbe
# spazio senza servire a nessuno.


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
            # Emendamento design-frontend.md §24: Wikipedia a volte è una
            # frase sola, altre volte più lunga dello standard. Accodato
            # qui, non nel gestore di standardizzazione stesso, perché
            # solo chi scrive sa se il testo appena scritto è fuori
            # standard — il gestore rilegge comunque il valore fresco
            # all'esecuzione, non si fida di questo controllo.
            for lingua, testo, _, _ in trovate:
                fuori_standard = (
                    len(testo) < catalogo_repository.SOGLIA_MINIMA_DESCRIZIONE
                    or len(testo) > catalogo_repository.SOGLIA_MASSIMA_DESCRIZIONE
                )
                if fuori_standard:
                    lavoro_repository.accoda(
                        connessione,
                        "standardizzazione_descrizione",
                        f"{libro_id}:{lingua}",
                        {"libro_id": libro_id, "lingua": lingua},
                    )

            # Issue #24: questo lavoro è l'ultimo scrittore della pipeline
            # quando Wikidata aveva sitelink per il libro — un'asimmetria
            # fra le due lingue dell'interfaccia che `crea_scheda` non ha
            # potuto chiudere (perché questa lingua era ancora in attesa
            # di un tentativo Wikipedia) va richiusa qui una volta che il
            # tentativo è avvenuto, trovato o no. Rilettura a fresco e non
            # `trovate`: la lingua mancante può essere quella che Google
            # Books aveva già scritto alla nascita della scheda.
            presenti = catalogo_repository.leggi_descrizioni(connessione, libro_id, LINGUE)
            for lingua in LINGUE:
                altra = LINGUE[1] if lingua == LINGUE[0] else LINGUE[0]
                if presenti.get(lingua) and not presenti.get(altra):
                    lavoro_repository.accoda(
                        connessione,
                        "traduzione_descrizione",
                        f"{libro_id}:{altra}",
                        {
                            "libro_id": libro_id,
                            "lingua_mancante": altra,
                            "lingua_sorgente": lingua,
                        },
                    )

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuno stato da scrivere: una descrizione mancante non è uno stato
    del prodotto, è semplicemente una descrizione in meno — e quella di
    Google, quando c'è, è già stata scritta alla nascita della scheda."""
    logger.warning("Descrizione di %s non recuperata: %s", payload.get("libro_id"), errore)
