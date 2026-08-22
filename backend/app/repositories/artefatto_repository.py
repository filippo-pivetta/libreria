"""Accesso dati grezzo a `artefatto_generato` (preview personalizzate e,
in prospettiva, sintesi tematiche).

Nessuna funzione di aggiornamento: dalla migrazione 20260822090000 la
tabella non concede più UPDATE a `authenticated`. Un artefatto è la
fotografia di ciò che il modello ha risposto in un momento preciso —
esiste o sparisce, non si riscrive; rigenerarlo crea una riga nuova.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = "id, tipo, voce_id, testo, creato_at"


def ultimo_per_voce(client: Client, voce_id: UUID, tipo: str) -> dict[str, Any] | None:
    """Il più recente, non l'unico: il PRD non limita a uno gli artefatti
    per Voce, e una preview vecchia resta un contenuto dell'Utente che la
    revoca del consenso non può toccare (regola 32). L'interfaccia ne
    mostra uno, il più recente."""
    response = (
        client.table("artefatto_generato")
        .select(_SELECT)
        .eq("voce_id", str(voce_id))
        .eq("tipo", tipo)
        .order("creato_at", desc=True)
        .limit(1)
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return righe[0] if righe else None


def create(
    client: Client, utente_id: UUID, tipo: str, voce_id: UUID | None, testo: str
) -> dict[str, Any]:
    response = (
        client.table("artefatto_generato")
        .insert(
            {
                "utente_id": str(utente_id),
                "tipo": tipo,
                "voce_id": str(voce_id) if voce_id else None,
                "testo": testo,
            }
        )
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return righe[0]


def delete(client: Client, artefatto_id: UUID) -> bool:
    response = client.table("artefatto_generato").delete().eq("id", str(artefatto_id)).execute()
    return len(cast("list[dict[str, Any]]", response.data)) > 0
