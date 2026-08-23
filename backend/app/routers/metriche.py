"""Route di `/metriche`: le proprie metriche di lettura (issue #7,
aggregato su anno solare — PRD, entità "Metrica di lettura"). La
libreria di un collegato ha la rotta gemella, `GET /utenti/{id}/metriche`
(stesso payload), in `app/routers/utenti.py`."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.lingua import lingua_interfaccia
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.metriche import MetricheResponse
from app.services import metriche_service

router = APIRouter(tags=["metriche"])


@router.get("/metriche", response_model=MetricheResponse)
async def get_metriche(
    anno: int | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await metriche_service.metriche_di(
            current_user.access_token, current_user.id, anno, lingua
        )
    except metriche_service.AnnoFuturoError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {"error_code": "anno_futuro", "message": "Gli anni futuri non sono selezionabili."},
        ) from error
