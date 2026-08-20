"""Orchestrazione di `/letture/{id}/avanzamenti` e `/avanzamenti`:
registrare, correggere, cancellare un Avanzamento.

Monotonia, tetto pagine e non-futuro (PRD, regole 14/15) sono imposti dal
trigger `trg_avanzamento_valida`
(supabase/migrations/20260820065144_ciclo_di_lettura.sql): questo service
traduce i suoi SQLSTATE personalizzati (MTG01-MTG06) in un'unica
eccezione di dominio che porta con sé il codice, così il router lo
restituisce al client 1:1 senza fare parsing di un messaggio in italiano.
"""

from datetime import date
from typing import Any, NoReturn
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import avanzamento_repository

_CODICI_REGOLA_AVANZAMENTO = {
    "MTG01": "avanzamento_data_futura",
    "MTG02": "avanzamento_data_regressiva",
    "MTG03": "avanzamento_pagina_regressiva",
    "MTG04": "avanzamento_pagina_supera_successivo",
    "MTG05": "avanzamento_data_supera_successivo",
    "MTG06": "avanzamento_oltre_pagine_adottate",
}


class AvanzamentoNonValidoError(Exception):
    """Una delle regole 14/15 (monotonia, tetto pagine, non-futuro) è
    stata violata. `error_code` è uno dei token della tabella sopra,
    stabile e indipendente dalla lingua del messaggio Postgres."""

    def __init__(self, error_code: str) -> None:
        self.error_code = error_code
        super().__init__(error_code)


def _rilancia_come_dominio(error: APIError) -> NoReturn:
    token = _CODICI_REGOLA_AVANZAMENTO.get(error.code or "")
    if token is not None:
        raise AvanzamentoNonValidoError(token) from error
    raise error


async def registra(
    access_token: str, utente_id: UUID, lettura_id: UUID, pagina: int, data: date | None
) -> dict[str, Any]:
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(
            avanzamento_repository.create, client, utente_id, lettura_id, pagina, data
        )
    except APIError as error:
        _rilancia_come_dominio(error)


async def correggi(
    access_token: str, avanzamento_id: UUID, pagina: int | None, data: date | None
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(
            avanzamento_repository.update, client, avanzamento_id, pagina, data
        )
    except APIError as error:
        _rilancia_come_dominio(error)


async def cancella(access_token: str, avanzamento_id: UUID) -> bool:
    client = get_user_client(access_token)
    return await run_in_threadpool(avanzamento_repository.delete, client, avanzamento_id)
