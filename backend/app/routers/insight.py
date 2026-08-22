"""Route di `/voci/{id}/insight` e `/insight/{id}`: creare, correggere,
cancellare un Insight, e rivelarne il testo se contrassegnato spoiler
(issue #5)."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.insight import (
    InsightCreateRequest,
    InsightResponse,
    InsightUpdateRequest,
    RivelaInsightResponse,
)
from app.services import insight_service

router = APIRouter(tags=["insight"])


@router.post(
    "/voci/{voce_id}/insight",
    response_model=InsightResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_insight(
    voce_id: UUID,
    body: InsightCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    insight = await insight_service.crea(
        current_user.access_token,
        current_user.id,
        voce_id,
        body.testo,
        body.spoiler,
        body.visibilita,
    )
    if insight is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return insight


@router.patch("/insight/{insight_id}", response_model=InsightResponse)
async def patch_insight(
    insight_id: UUID,
    body: InsightUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    insight = await insight_service.correggi(
        current_user.access_token,
        current_user.id,
        insight_id,
        body.testo,
        body.spoiler,
        body.visibilita,
    )
    if insight is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insight non trovato.")
    return insight


@router.delete("/insight/{insight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insight(
    insight_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    cancellato = await insight_service.cancella(current_user.access_token, insight_id)
    if not cancellato:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insight non trovato.")


@router.get("/insight/{insight_id}/testo", response_model=RivelaInsightResponse)
async def get_insight_testo(
    insight_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    testo = await insight_service.rivela_testo(current_user.access_token, insight_id)
    if testo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insight non trovato.")
    return {"testo": testo}
