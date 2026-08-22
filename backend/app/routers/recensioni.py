"""Route di `/voci/{id}/recensione`: scrivere (upsert) e cancellare la
recensione della propria Voce (issue #5)."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.recensioni import RecensioneRequest, RecensioneResponse
from app.services import recensioni_service

router = APIRouter(tags=["recensioni"])


@router.put("/voci/{voce_id}/recensione", response_model=RecensioneResponse)
async def put_recensione(
    voce_id: UUID,
    body: RecensioneRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    recensione = await recensioni_service.scrivi(
        current_user.access_token, current_user.id, voce_id, body.testo, body.visibilita
    )
    if recensione is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return recensione


@router.delete("/voci/{voce_id}/recensione", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recensione(
    voce_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    cancellata = await recensioni_service.cancella(current_user.access_token, voce_id)
    if not cancellata:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recensione non trovata.")
