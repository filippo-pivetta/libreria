"""Logica dietro l'health check: nessuna regola di dominio, solo infrastruttura."""

from fastapi.concurrency import run_in_threadpool

from app.repositories import database as database_repository


async def get_health_status(con_database: bool = False) -> dict[str, str]:
    """Lo stato del servizio. Tocca il database solo se glielo si chiede.

    `database.ping` apre una connessione NUOVA a ogni chiamata: al ritmo
    del controllo di Fly (uno al minuto, backend/fly.toml) erano 1.440
    connessioni al giorno verso Supabase aperte e chiuse per un dato che
    Fly non guarda — la risposta è comunque 200, e a quel controllo serve
    sapere che il processo risponde, non che Postgres è raggiungibile.

    La domanda sul database resta, perché è utile a chi la fa a mano
    mentre indaga: `GET /health?database=1`.
    """
    if not con_database:
        return {"status": "ok"}
    raggiungibile = await run_in_threadpool(database_repository.ping)
    return {"status": "ok", "database": "ok" if raggiungibile else "unreachable"}
