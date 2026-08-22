"""Accesso dati grezzo a `insight`.

RLS (supabase/migrations/20260818115830_schema_montaigne.sql): proprietario
o collegato attivo se `visibilita = 'condiviso'`. Il contrassegno spoiler
(PRD regola 10) è presentazione, non accesso alla riga — il commento SQL
sopra `create table insight` lo dice esplicitamente: qui si restituisce
sempre il testo intero, il gating vive nel service layer
(`app/services/insight_service.py::_senza_spoiler`).
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = "id, voce_id, lettura_id, testo, spoiler, visibilita, data, creato_at"


def list_by_voce(client: Client, voce_id: UUID) -> list[dict[str, Any]]:
    response = (
        client.table("insight")
        .select(_SELECT)
        .eq("voce_id", str(voce_id))
        .order("data")
        .order("creato_at")
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)


def get_lettura_aperta_id(client: Client, voce_id: UUID) -> UUID | None:
    """La Lettura aperta corrente della Voce, se c'è: un nuovo insight vi si
    lega da solo (PRD, entità Insight), non è una scelta del chiamante.
    `None` sia se la Voce non ha alcuna Lettura aperta sia se `voce_id` non
    esiste o non è visibile a chi chiama — in quest'ultimo caso l'insert
    dell'insight fallirà comunque sulla FK composita verso
    `voce_di_libreria(id, utente_id)`."""
    response = (
        client.table("lettura")
        .select("id")
        .eq("voce_id", str(voce_id))
        .is_("data_fine", "null")
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return UUID(cast("dict[str, Any]", response.data)["id"])


def create(
    client: Client,
    utente_id: UUID,
    voce_id: UUID,
    lettura_id: UUID | None,
    testo: str,
    spoiler: bool,
    visibilita: str,
) -> dict[str, Any]:
    response = (
        client.table("insight")
        .insert(
            {
                "utente_id": str(utente_id),
                "voce_id": str(voce_id),
                "lettura_id": str(lettura_id) if lettura_id is not None else None,
                "testo": testo,
                "spoiler": spoiler,
                "visibilita": visibilita,
            }
        )
        .select(_SELECT)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0]


def update(
    client: Client,
    insight_id: UUID,
    testo: str | None,
    spoiler: bool | None,
    visibilita: str | None,
) -> dict[str, Any] | None:
    payload: dict[str, Any] = {}
    if testo is not None:
        payload["testo"] = testo
    if spoiler is not None:
        payload["spoiler"] = spoiler
    if visibilita is not None:
        payload["visibilita"] = visibilita
    response = (
        client.table("insight").update(payload).eq("id", str(insight_id)).select(_SELECT).execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0] if rows else None


def delete(client: Client, insight_id: UUID) -> bool:
    response = client.table("insight").delete().eq("id", str(insight_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0


def get_testo(client: Client, insight_id: UUID) -> str | None:
    """Il testo pieno di un insight, per il gesto esplicito di scoprire uno
    spoiler (`GET /insight/{id}/testo`) — nessun gating qui: la RLS ha già
    deciso se la riga è visibile a chi chiama, il gesto stesso è la
    richiesta esplicita che il PRD impone prima di mostrare il testo."""
    response = (
        client.table("insight").select("testo").eq("id", str(insight_id)).maybe_single().execute()
    )
    if response is None:
        return None
    return cast("str", cast("dict[str, Any]", response.data)["testo"])
