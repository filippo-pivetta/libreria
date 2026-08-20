"""Route di `/utenti`: elenco membri e libreria di un collegato
(issue #3)."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.utenti import LibreriaCollegatoResponse, MembroResponse
from app.services import utenti_service

router = APIRouter(tags=["utenti"])


@router.get("/utenti", response_model=list[MembroResponse])
async def get_utenti(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> list[dict[str, Any]]:
    return await utenti_service.elenco_membri(current_user.access_token, current_user.id)


@router.get("/utenti/{utente_id}/voci", response_model=LibreriaCollegatoResponse)
async def get_utente_voci(
    utente_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await utenti_service.libreria_di(
            current_user.access_token, current_user.id, utente_id
        )
    except utenti_service.UtenteInesistenteError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questo utente non esiste.") from error
    except utenti_service.NonCollegatoError as error:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            {
                "error_code": "non_collegato",
                "message": "Non sei collegato con questo utente.",
            },
        ) from error
