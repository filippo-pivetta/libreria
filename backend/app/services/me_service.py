"""Orchestrazione di GET/POST /me: composizione di `utente` +
`utente_privato`, gestione del caso "non ancora provisionato" e del
completamento dell'account dopo l'invito del Manutentore (docs/adr/0013).
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import utente_repository


class NomeUtenteInUsoError(Exception):
    """Il nome utente scelto è già assegnato a un altro account
    (vincolo `uq_utente_nome_utente`)."""


class AccountGiaCompletatoError(Exception):
    """Questo utente ha già una riga `public.utente` (vincolo
    `utente_pkey`): probabile doppio invio dello stesso completamento."""


async def get_me(access_token: str, utente_id: UUID) -> dict[str, Any] | None:
    # RLS valutata con l'identità dell'utente, mai con la chiave di
    # servizio, per le richieste di utenti (docs/adr/0001).
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        return None

    utente_privato = await run_in_threadpool(
        utente_repository.get_utente_privato, client, utente_id
    )
    if utente_privato is None:
        # Le due righe nascono sempre insieme dentro completa_registrazione
        # (docs/adr/0013): se manca la seconda, il completamento non è mai
        # arrivato in fondo. Stesso trattamento del caso "nessuna riga
        # utente".
        return None

    return {**utente, **utente_privato}


async def complete_account(access_token: str, nome_utente: str) -> dict[str, Any]:
    # RLS valutata con l'identità dell'utente, mai con la chiave di
    # servizio, per le richieste di utenti (docs/adr/0001).
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(utente_repository.complete_registration, client, nome_utente)
    except APIError as error:
        if error.code == "23505":
            message = error.message or ""
            if "uq_utente_nome_utente" in message:
                raise NomeUtenteInUsoError from error
            if "utente_pkey" in message:
                raise AccountGiaCompletatoError from error
        raise
