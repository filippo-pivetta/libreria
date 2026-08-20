"""Orchestrazione di `/collegamenti`: richiesta, accettazione,
interruzione (issue #3).

Le eccezioni di dominio qui sotto traducono gli errori Postgres (FK
violata, vincolo di unicità sulla coppia) e le condizioni RLS in un
vocabolario che il router può mappare a `HTTPException` senza conoscere
Postgres — stesso schema di `voci_service.py`.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import collegamento_repository


class UtenteInesistenteError(Exception):
    """`utente_id` del destinatario non esiste (violazione della FK, 23503)."""


class RichiestaASeStessiError(Exception):
    """Il destinatario della richiesta è chi la invia."""


class CollegamentoNonTrovatoError(Exception):
    """Nessun collegamento con questo id, o non tuo, o sei il
    richiedente e stai provando ad accettare la tua stessa richiesta
    (RLS, indistinguibili — MTG-style, come voci_service)."""


async def elenco(access_token: str, self_id: UUID) -> list[dict[str, Any]]:
    client = get_user_client(access_token)
    return await run_in_threadpool(collegamento_repository.list_per_utente, client, self_id)


async def invia_richiesta(
    access_token: str, self_id: UUID, altro_utente_id: UUID
) -> tuple[dict[str, Any], bool]:
    """Normalizza la coppia (utente_a_id < utente_b_id, responsabilità
    applicativa per il vincolo `chk_collegamento_ordine`) e crea la
    richiesta. Su violazione del vincolo di unicità della coppia
    (23505 — richiesta doppia o inviata da entrambi in contemporanea,
    PRD casi limite) restituisce la riga già esistente as-is, con
    `already_existed=True`: non forza mai un'accettazione, "nasce una
    sola relazione" non vuol dire "nasce già attiva"."""
    if altro_utente_id == self_id:
        raise RichiestaASeStessiError

    client = get_user_client(access_token)
    utente_a_id, utente_b_id = sorted((self_id, altro_utente_id))

    try:
        creato = await run_in_threadpool(
            collegamento_repository.create, client, utente_a_id, utente_b_id, self_id
        )
    except APIError as error:
        if error.code == "23505":
            esistente = await run_in_threadpool(
                collegamento_repository.get_by_coppia, client, utente_a_id, utente_b_id, self_id
            )
            if esistente is not None:
                return esistente, True
            raise
        if error.code == "23503":
            raise UtenteInesistenteError from error
        raise
    return creato, False


async def accetta(access_token: str, self_id: UUID, collegamento_id: UUID) -> dict[str, Any]:
    client = get_user_client(access_token)
    risultato = await run_in_threadpool(
        collegamento_repository.accetta, client, collegamento_id, self_id
    )
    if risultato is None:
        raise CollegamentoNonTrovatoError
    return risultato


async def termina(access_token: str, collegamento_id: UUID) -> bool:
    """Copre rifiuto, ritiro e interruzione — sono tutte una DELETE
    (vedi collegamento_repository.delete)."""
    client = get_user_client(access_token)
    return await run_in_threadpool(collegamento_repository.delete, client, collegamento_id)
