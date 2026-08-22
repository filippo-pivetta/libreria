"""Ricostruzione in blocco degli indici semantici di un Utente, dopo che
ha riacceso il consenso all'elaborazione assistita (issue #6).

Il PRD la richiede alla lettera — "riattivandolo si ricostruiscono in
blocco" — e aggiunge la condizione che la rende onesta: "finché non sono
pronti la ricerca semantica è incompleta e lo dichiara". Lo stato che la
ricerca legge è `utente_privato.indici_stato`, scritto da qui: sta
sull'entità e non sulla coda, come impone ADR 0016.

Un solo lavoro per Utente (`chiave = utente_id`, `uq_lavoro_pendente`):
riaccendere e rispegnere l'interruttore due volte non produce due
ricostruzioni concorrenti sugli stessi contenuti.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.cataloghi.openai_client import chiama_embedding
from app.lavori.errori import ErroreTransitorio
from app.repositories import database, indicizzazione_repository
from app.services.consenso import INDICI_PRONTI, INDICI_SPENTI

logger = logging.getLogger("app.lavori.ricostruzione_indici")

LOTTO = 64
"""Quanti testi per chiamata al fornitore. L'API degli embedding accetta
un elenco, e una libreria di anni può avere centinaia di insight: una
chiamata per testo pagherebbe centinaia di round trip per un lavoro che
l'Utente sta aspettando."""


async def esegui(payload: dict[str, Any]) -> None:
    utente_id = UUID(str(payload["utente_id"]))

    def _leggi() -> tuple[bool | None, list[tuple[str, UUID, str]]]:
        with database.apri_connessione() as connessione:
            consenso = indicizzazione_repository.consenso_attivo(connessione, utente_id)
            if consenso is not True:
                return consenso, []
            # Si riparte da zero e non si aggiorna l'esistente: dopo una
            # revoca la tabella è vuota per costruzione, e una
            # ricostruzione che trovasse residui li lascerebbe orfani di
            # un modello magari diverso.
            indicizzazione_repository.cancella_indici(connessione, utente_id)
            return consenso, indicizzazione_repository.contenuti_da_indicizzare(
                connessione, utente_id
            )

    consenso, contenuti = await run_in_threadpool(_leggi)

    if consenso is None:
        # Account cancellato: niente da ricostruire, niente da scrivere.
        return
    if not consenso:
        # Rispento fra l'accodamento e l'esecuzione. La revoca ha già
        # messo 'spenti' e cancellato tutto: qui non resta nulla da fare.
        return

    for inizio in range(0, len(contenuti), LOTTO):
        lotto = contenuti[inizio : inizio + LOTTO]
        try:
            vettori = await chiama_embedding([testo for _, _, testo in lotto])
        except FonteNonRaggiungibileError as errore:
            raise ErroreTransitorio(errore.motivo) from errore

        def _scrivi(
            lotto: list[tuple[str, UUID, str]] = lotto, vettori: list[list[float]] = vettori
        ) -> bool:
            with database.apri_connessione() as connessione:
                if indicizzazione_repository.consenso_attivo(connessione, utente_id) is not True:
                    return False
                for (tipo, contenuto_id, _), vettore in zip(lotto, vettori, strict=True):
                    indicizzazione_repository.scrivi_embedding(
                        connessione, utente_id, tipo, contenuto_id, vettore
                    )
            return True

        if not await run_in_threadpool(_scrivi):
            # Revocato a metà ricostruzione: si ferma e non si scrive
            # 'pronti'. La revoca ha già cancellato ciò che c'era e messo
            # 'spenti'; i vettori scritti dai lotti precedenti li toglie
            # lei, non questo lavoro.
            return

    def _concludi() -> None:
        with database.apri_connessione() as connessione:
            if indicizzazione_repository.consenso_attivo(connessione, utente_id) is True:
                indicizzazione_repository.imposta_indici_stato(
                    connessione, utente_id, INDICI_PRONTI
                )

    await run_in_threadpool(_concludi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Mai lasciare `in_ricostruzione` appeso.

    È la divergenza che ADR 0016 chiede di evitare: la coda direbbe
    "fallito" mentre la ricerca continuerebbe a promettere che gli indici
    stanno arrivando, per sempre. Si scrive `spenti`, che è la verità —
    gli indici non ci sono — e l'Utente può farli ricostruire spegnendo e
    riaccendendo l'interruttore.
    """
    utente_id = UUID(str(payload["utente_id"]))

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            indicizzazione_repository.imposta_indici_stato(connessione, utente_id, INDICI_SPENTI)

    await run_in_threadpool(_scrivi)
    logger.warning("Ricostruzione degli indici di %s non riuscita: %s", utente_id, errore)
