"""Indicizzazione semantica di un singolo insight o di una singola
recensione (issue #6).

Accodato da `insight_service` e `recensioni_service` ogni volta che un
testo nasce o cambia, e solo se il consenso è acceso: un embedding è una
chiamata al fornitore, e la regola 30 vieta di farla a consenso revocato.

Un lavoro per contenuto e non un lavoro per utente a ogni salvataggio:
`uq_lavoro_pendente` è su `(tipo, chiave)`, quindi con la chiave del
contenuto tre correzioni rapide dello stesso insight collassano in un
solo lavoro pendente, mentre insight diversi restano indipendenti.

Il consenso si rilegge **all'esecuzione** e non ci si fida del fatto che
fosse acceso all'accodamento: fra le due cose l'Utente può averlo
revocato, e in quel caso il lavoro deve morire in silenzio invece di
ricreare il vettore che la revoca aveva appena cancellato.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.cataloghi.openai_client import chiama_embedding
from app.lavori.errori import ErroreTransitorio
from app.repositories import database, indicizzazione_repository

logger = logging.getLogger("app.lavori.indicizzazione_semantica")


async def esegui(payload: dict[str, Any]) -> None:
    utente_id = UUID(str(payload["utente_id"]))
    tipo = str(payload["tipo"])
    contenuto_id = UUID(str(payload["contenuto_id"]))

    def _leggi() -> tuple[bool | None, str | None]:
        with database.apri_connessione() as connessione:
            consenso = indicizzazione_repository.consenso_attivo(connessione, utente_id)
            if consenso is not True:
                return consenso, None
            testo = indicizzazione_repository.testo_contenuto(
                connessione, tipo, contenuto_id, utente_id
            )
        return consenso, testo

    consenso, testo = await run_in_threadpool(_leggi)

    if consenso is None:
        # Account cancellato fra l'accodamento e l'esecuzione: nulla da
        # indicizzare e nulla da scrivere su un account che non esiste
        # più (PRD, "le richieste pendenti al fornitore di modelli non
        # devono poter scrivere dati su un account che non esiste più").
        return
    if not consenso:
        # Consenso revocato nel frattempo: la revoca ha già cancellato
        # tutto, e ricreare un vettore ora sarebbe la violazione esatta
        # della regola 30. Non è un fallimento: non c'è più nulla da fare.
        return
    if testo is None:
        # Contenuto cancellato o corretto in modo da non esistere più con
        # quell'id. La FK composita ha già portato via il vettore.
        return

    try:
        vettori = await chiama_embedding([testo])
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            # Riletto qui dentro: fra la chiamata al fornitore e la
            # scrittura passano secondi, ed è la finestra in cui una
            # revoca può cadere.
            if indicizzazione_repository.consenso_attivo(connessione, utente_id) is not True:
                return
            indicizzazione_repository.scrivi_embedding(
                connessione, utente_id, tipo, contenuto_id, vettori[0]
            )

    await run_in_threadpool(_scrivi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuno stato osservabile da scrivere: un contenuto non indicizzato
    non è distinguibile per l'Utente da uno indicizzato male, e la ricerca
    semantica non promette completezza fuori dalla ricostruzione in blocco
    — che ha invece il suo stato. Resta il log."""
    logger.warning(
        "Indicizzazione di %s %s non riuscita: %s",
        payload.get("tipo"),
        payload.get("contenuto_id"),
        errore,
    )
