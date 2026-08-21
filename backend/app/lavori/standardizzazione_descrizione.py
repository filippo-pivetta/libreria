"""Standardizzazione assistita delle descrizioni fuori standard
(design-frontend.md §24, emendamento 21 agosto 2026).

Misurato dal vivo: alcune voci Wikipedia si riducono a una sola frase
("Le notti bianche è un racconto giovanile di Fëdor Dostoevskij."), sotto
lo standard di prosa breve della scheda del libro; altre — soprattutto le
trame di Google Books, scritte per vendere non per informare — lo
superano abbondantemente. Questo lavoro riformula a 400-600 caratteri le
sole descrizioni fuori da `catalogo_repository.SOGLIA_MINIMA_DESCRIZIONE`/
`SOGLIA_MASSIMA_DESCRIZIONE`, espandendo o accorciando secondo il caso —
accodato da `catalogo_repository.crea_scheda` (per la descrizione Google
Books scritta alla nascita) e da `app/lavori/descrizioni.py` (per la
versione Wikipedia, quando la sostituisce).

Non è "invenzione di dati" nel senso vietato dal design doc: il modello
riceve solo il testo sorgente reale e i fatti già verificati in database
(titolo/autori/anno/generi), mai la sua conoscenza generale dell'opera —
la regola "mai inventato" resta sui fatti, non sulla formulazione. Il
nome "standardizzazione" e non "arricchimento": un nome che promette
solo di espandere sarebbe disonesto per un lavoro che accorcia
altrettanto spesso.
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database

logger = logging.getLogger("app.lavori.standardizzazione_descrizione")


async def esegui(payload: dict[str, Any]) -> None:
    libro_id = str(payload["libro_id"])
    lingua = str(payload["lingua"])

    def _leggi() -> tuple[str | None, str, list[str], int | None, list[str]]:
        with database.apri_connessione() as connessione:
            testo = catalogo_repository.leggi_descrizione(connessione, libro_id, lingua)
            titolo, autori, anno, generi = catalogo_repository.contesto_bibliografico(
                connessione, libro_id
            )
        return testo, titolo, autori, anno, generi

    testo_corrente, titolo, autori, anno, generi = await run_in_threadpool(_leggi)

    if testo_corrente is None:
        # La riga non esiste più (fusione/deduplicazione fuori banda nel
        # frattempo?): nulla da riformulare.
        return

    troppo_corta = len(testo_corrente) < catalogo_repository.SOGLIA_MINIMA_DESCRIZIONE
    troppo_lunga = len(testo_corrente) > catalogo_repository.SOGLIA_MASSIMA_DESCRIZIONE
    if not troppo_corta and not troppo_lunga:
        # Un'altra fonte l'ha già sostituita con una versione nella
        # fascia giusta fra l'accodamento e l'esecuzione (es. Wikipedia
        # dopo Google Books): non c'è più nulla da fare, non è un
        # fallimento.
        return

    riformula = llm.espandi_descrizione if troppo_corta else llm.accorcia_descrizione
    try:
        testo_riformulato = await riformula(
            titolo=titolo,
            autori=autori,
            anno_prima_pubblicazione=anno,
            generi=generi,
            testo_originale=testo_corrente,
            fonte_originale="wikipedia/google_books",
        )
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.scrivi_descrizione_riformulata(
                connessione, libro_id, lingua, testo_riformulato
            )

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuna scrittura: la descrizione originale, per quanto fuori
    standard, resta quella della fonte — mai un vuoto al posto suo (PRD,
    "senza ulteriori tentativi automatici" applicato per analogia: una
    standardizzazione fallita non deve peggiorare ciò che già c'è)."""
    logger.warning(
        "Standardizzazione descrizione di %s (%s) non riuscita: %s",
        payload.get("libro_id"),
        payload.get("lingua"),
        errore,
    )
