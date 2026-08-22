"""Accesso dati grezzo a `recensione`.

Una sola recensione per Voce (`uq_recensione_voce`): scrivere è sempre un
upsert su `voce_id`, mai un insert/update distinti a carico del chiamante.
RLS (supabase/migrations/20260818115830_schema_montaigne.sql): proprietario
o collegato attivo se `visibilita = 'condiviso'`.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = "id, voce_id, testo, visibilita, creato_at, aggiornato_at"


def get_by_voce(client: Client, voce_id: UUID) -> dict[str, Any] | None:
    response = (
        client.table("recensione")
        .select(_SELECT)
        .eq("voce_id", str(voce_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return cast("dict[str, Any]", response.data)


def upsert(
    client: Client, voce_id: UUID, utente_id: UUID, testo: str, visibilita: str
) -> dict[str, Any]:
    """`on_conflict="voce_id"`: crea se assente, sostituisce se già presente.
    Nessuna `.select()` incatenata dopo l'upsert (a differenza di `insert`):
    stesso stile di `voce_repository.update_nota_intenzione`, una query
    separata per la riga risultante — non serve fare affidamento su come
    PostgREST valorizza `Prefer: return=representation` su un upsert."""
    client.table("recensione").upsert(
        {
            "voce_id": str(voce_id),
            "utente_id": str(utente_id),
            "testo": testo,
            "visibilita": visibilita,
        },
        on_conflict="voce_id",
    ).execute()
    response = (
        client.table("recensione").select(_SELECT).eq("voce_id", str(voce_id)).single().execute()
    )
    return cast("dict[str, Any]", response.data)


def delete_by_voce(client: Client, voce_id: UUID) -> bool:
    response = client.table("recensione").delete().eq("voce_id", str(voce_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0
