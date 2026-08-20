"""Route di `/letture/{id}/avanzamenti` e `/avanzamenti`: registrare,
correggere, cancellare un Avanzamento."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.avanzamenti import (
    AvanzamentoResponse,
    CorreggiAvanzamentoRequest,
    RegistraAvanzamentoRequest,
)
from app.services import avanzamenti_service

router = APIRouter(tags=["avanzamenti"])

# Messaggi in italiano per gli `error_code` sollevati dal trigger
# trg_avanzamento_valida (docs/adr/0015): l'`error_code` stesso è il
# contratto stabile per il frontend, il messaggio è solo un ripiego per
# chi consuma l'API senza tradurlo (es. Swagger).
_MESSAGGI_ERRORE = {
    "avanzamento_data_futura": "La data non può essere nel futuro.",
    "avanzamento_data_regressiva": "La data precede l'avanzamento precedente della stessa Lettura.",
    "avanzamento_pagina_regressiva": "La pagina è inferiore a quella già raggiunta.",
    "avanzamento_pagina_supera_successivo": (
        "La pagina supera l'avanzamento successivo della stessa Lettura."
    ),
    "avanzamento_data_supera_successivo": (
        "La data supera l'avanzamento successivo della stessa Lettura."
    ),
    "avanzamento_oltre_pagine_adottate": "La pagina supera le pagine adottate per la Voce.",
}


def _http_error(error: avanzamenti_service.AvanzamentoNonValidoError) -> HTTPException:
    messaggio = _MESSAGGI_ERRORE.get(error.error_code, "Avanzamento non valido.")
    return HTTPException(
        status.HTTP_409_CONFLICT,
        {"error_code": error.error_code, "message": messaggio},
    )


@router.post(
    "/letture/{lettura_id}/avanzamenti",
    response_model=AvanzamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_avanzamento(
    lettura_id: UUID,
    body: RegistraAvanzamentoRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await avanzamenti_service.registra(
            current_user.access_token, current_user.id, lettura_id, body.pagina, body.data
        )
    except avanzamenti_service.AvanzamentoNonValidoError as error:
        raise _http_error(error) from error


@router.patch("/avanzamenti/{avanzamento_id}", response_model=AvanzamentoResponse)
async def patch_avanzamento(
    avanzamento_id: UUID,
    body: CorreggiAvanzamentoRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        avanzamento = await avanzamenti_service.correggi(
            current_user.access_token, avanzamento_id, body.pagina, body.data
        )
    except avanzamenti_service.AvanzamentoNonValidoError as error:
        raise _http_error(error) from error
    if avanzamento is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avanzamento non trovato.")
    return avanzamento


@router.delete("/avanzamenti/{avanzamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_avanzamento(
    avanzamento_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    cancellato = await avanzamenti_service.cancella(current_user.access_token, avanzamento_id)
    if not cancellato:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avanzamento non trovato.")
