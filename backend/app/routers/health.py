from fastapi import APIRouter

from app.schemas.health import HealthResponse
from app.services import health_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    result = await health_service.get_health_status()
    return HealthResponse(**result)
