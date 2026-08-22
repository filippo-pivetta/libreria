"""Orchestrazione di `/voci/{id}/recensione`: scrittura (upsert) e
cancellazione (issue #5)."""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import recensione_repository
from app.services import indicizzazione


async def scrivi(
    access_token: str, utente_id: UUID, voce_id: UUID, testo: str, visibilita: str
) -> dict[str, Any] | None:
    """Upsert su `voce_id`: crea se assente, sostituisce se già presente —
    non conserva la versione precedente (PRD, entità Recensione). `None` se
    `voce_id` non esiste o non è di `utente_id` (FK composita verso
    voce_di_libreria(id, utente_id), 23503) — stesso stile di
    `voci_service.correggi_nota_intenzione`."""
    client = get_user_client(access_token)
    try:
        scritta = await run_in_threadpool(
            recensione_repository.upsert, client, voce_id, utente_id, testo, visibilita
        )
    except APIError as error:
        if error.code == "23503":
            return None
        raise
    await indicizzazione.accoda(access_token, utente_id, "recensione", UUID(str(scritta["id"])))
    return scritta


async def cancella(access_token: str, voce_id: UUID) -> bool:
    client = get_user_client(access_token)
    return await run_in_threadpool(recensione_repository.delete_by_voce, client, voce_id)
