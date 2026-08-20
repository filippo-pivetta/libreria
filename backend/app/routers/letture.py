"""Route di `/letture`: la sola cancellazione, di qualunque Lettura —
aperta o chiusa (PRD, vedi `app/services/letture_service.py`). Apertura e
chiusura vivono in `PATCH /voci/{id}/stato` (`app/routers/voci.py`)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.services import letture_service

router = APIRouter(tags=["letture"])


@router.delete("/letture/{lettura_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lettura(
    lettura_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    cancellata = await letture_service.cancella(current_user.access_token, lettura_id)
    if not cancellata:
        # Non trovata o non di proprietà: stessa risposta, RLS le rende
        # indistinguibili (PRD, casi limite).
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lettura non trovata.")
