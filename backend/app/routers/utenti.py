"""Route di `/utenti`: elenco membri, libreria e metriche di un
collegato (issue #3, metriche issue #7)."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.lingua import lingua_interfaccia
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.metriche import MetricheResponse
from app.schemas.utenti import LibreriaCollegatoResponse, MembroResponse
from app.services import metriche_service, utenti_service

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
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await utenti_service.libreria_di(
            current_user.access_token, current_user.id, utente_id, lingua
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


@router.get("/utenti/{utente_id}/metriche", response_model=MetricheResponse)
async def get_utente_metriche(
    utente_id: UUID,
    anno: int | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await utenti_service.metriche_di(
            current_user.access_token, current_user.id, utente_id, anno, lingua
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
    except metriche_service.AnnoFuturoError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {"error_code": "anno_futuro", "message": "Gli anni futuri non sono selezionabili."},
        ) from error
