"""Logica dietro l'health check: nessuna regola di dominio, solo infrastruttura."""

from fastapi.concurrency import run_in_threadpool

from app.repositories import database as database_repository


async def get_health_status() -> dict[str, str]:
    database_reachable = await run_in_threadpool(database_repository.ping)
    return {
        "status": "ok",
        "database": "ok" if database_reachable else "unreachable",
    }
