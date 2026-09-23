from fastapi import APIRouter, Query

from app.schemas.health import HealthResponse
from app.services import health_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
async def health(
    database: bool = Query(
        default=False,
        description="Verifica anche che il database sia raggiungibile. Fuori dal "
        "default perché il controllo automatico di Fly non usa la risposta e "
        "ogni verifica apre una connessione nuova a Postgres.",
    ),
) -> HealthResponse:
    result = await health_service.get_health_status(con_database=database)
    return HealthResponse(**result)
