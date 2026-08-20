"""Orchestrazione di `/letture`: la sola cancellazione — qualunque
Lettura, aperta o chiusa (PRD: "l'Utente può... cancellare ogni contenuto
proprio... Letture aperte per errore", generalizzato dal caso limite a
qualunque Lettura). Apertura e chiusura vivono nella RPC
`cambia_stato_voce` (`voci_service.cambia_stato`, docs/adr/0015), non qui.
"""

from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import lettura_repository


async def cancella(access_token: str, lettura_id: UUID) -> bool:
    client = get_user_client(access_token)
    return await run_in_threadpool(lettura_repository.delete, client, lettura_id)
