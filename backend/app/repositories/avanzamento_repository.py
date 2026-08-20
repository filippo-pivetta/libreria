"""Accesso dati grezzo ad `avanzamento`.

Monotonia, tetto pagine e non-futuro (PRD, regole 14/15) sono imposti dal
trigger `trg_avanzamento_valida`
(supabase/migrations/20260820065144_ciclo_di_lettura.sql): nessuna regola
di dominio qui.
"""

from datetime import date
from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = "id, lettura_id, pagina, data, generato_automaticamente, creato_at"


def create(
    client: Client, utente_id: UUID, lettura_id: UUID, pagina: int, data: date | None
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "utente_id": str(utente_id),
        "lettura_id": str(lettura_id),
        "pagina": pagina,
    }
    if data is not None:
        payload["data"] = data.isoformat()
    response = client.table("avanzamento").insert(payload).select(_SELECT).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0]


def update(
    client: Client, avanzamento_id: UUID, pagina: int | None, data: date | None
) -> dict[str, Any] | None:
    payload: dict[str, Any] = {}
    if pagina is not None:
        payload["pagina"] = pagina
    if data is not None:
        payload["data"] = data.isoformat()
    response = (
        client.table("avanzamento")
        .update(payload)
        .eq("id", str(avanzamento_id))
        .select(_SELECT)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0] if rows else None


def delete(client: Client, avanzamento_id: UUID) -> bool:
    response = client.table("avanzamento").delete().eq("id", str(avanzamento_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0
