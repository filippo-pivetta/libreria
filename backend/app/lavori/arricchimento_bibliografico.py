"""Classificazione genere e deduzione anno/lingua assistite dal modello
(issue #20, punti 1+2, accorpati in un solo lavoro).

Gira solo quando la mappatura deterministica (mappatura_generi.py) e la
catena catalogo/Wikidata (risoluzione.py) non hanno già deciso — vedi il
trigger in `catalogo_repository.crea_scheda`, che accoda questo lavoro
solo con ciò che manca davvero. Non è mai nel percorso critico di
POST /libri: la scheda nasce comunque, "non classificato" o senza
anno/lingua se questo lavoro fallisce o il modello stesso non decide
(PRD, "l'aggiunta del libro procede comunque").

Un solo tipo di lavoro per i due punti dell'issue, non due: la stessa
chiamata al modello risponde con genere, anno e lingua insieme, riusando
il contesto (titolo/autori/soggetti) già raccolto in risoluzione.py —
dimezza le chiamate, e "nessun tetto di spesa impostato nel sistema" (PRD)
è un motivo in più per essere parsimoniosi.
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database
from app.services.mappatura_generi import MASSIMO_GENERI

logger = logging.getLogger("app.lavori.arricchimento_bibliografico")


async def esegui(payload: dict[str, Any]) -> None:
    libro_id = str(payload["libro_id"])
    titolo = str(payload.get("titolo") or "")
    autori: list[str] = list(payload.get("autori") or [])
    soggetti: list[str] = list(payload.get("soggetti") or [])
    necessita: dict[str, bool] = dict(payload.get("necessita") or {})

    def _leggi_generi_ammessi() -> list[tuple[str, str]]:
        with database.apri_connessione() as connessione:
            return catalogo_repository.generi_ammessi(connessione)

    # Solo se il genere è fra ciò che manca: quando il lavoro è stato
    # accodato per il solo anno o la sola lingua, l'elenco chiuso non
    # entra nel prompt (vedi `llm.classifica_e_deduci`) e leggerlo era una
    # connessione aperta per niente.
    generi_ammessi = (
        await run_in_threadpool(_leggi_generi_ammessi) if necessita.get("genere") else []
    )

    try:
        risposta = await llm.classifica_e_deduci(
            titolo=titolo,
            autori=autori,
            soggetti=soggetti,
            generi_ammessi=generi_ammessi,
            necessita_genere=bool(necessita.get("genere")),
            necessita_anno=bool(necessita.get("anno")),
            necessita_lingua=bool(necessita.get("lingua")),
        )
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    # Difesa contro un id inventato dal modello, oltre al vincolo del
    # database (libro_genere.genere_id references genere on delete
    # restrict): scartare qui evita di far fallire l'intero lavoro per un
    # solo genere fuori dall'elenco chiuso.
    ammessi = {id_ for id_, _ in generi_ammessi}
    generi = [g for g in risposta.generi if g in ammessi][:MASSIMO_GENERI]
    if len(generi) != len(risposta.generi):
        logger.info(
            "Generi scartati per %s perché fuori dall'elenco chiuso: %s",
            libro_id,
            set(risposta.generi) - ammessi,
        )

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.scrivi_arricchimento_bibliografico(
                connessione,
                libro_id,
                generi,
                risposta.anno_prima_pubblicazione,
                risposta.lingua_originale,
            )

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuna scrittura. "Non tentato" e "tentato e fallito" sono
    intenzionalmente indistinguibili qui: "non classificato" è già lo
    stato terminale visibile in entrambi i casi (PRD, "il genere resta
    'non classificato' e la funzione assistita fallisce senza bloccare il
    flusso") — a differenza della copertina, dove l'assenza di uno stato
    osservabile lascerebbe un vuoto che il PRD vieta esplicitamente."""
    logger.warning(
        "Arricchimento bibliografico di %s non riuscito: %s", payload.get("libro_id"), errore
    )
