"""Accesso dati grezzo a `utente`/`utente_privato`.

Il client passato in ingresso opera sempre con l'identità dell'utente
(`get_user_client`, docs/adr/0001): le RLS restano l'unico punto in cui
vive la regola "chi vede cosa". Nessuna regola di dominio qui.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client


def get_utente(client: Client, utente_id: UUID) -> dict[str, Any] | None:
    response = (
        client.table("utente")
        .select("id, nome_utente")
        .eq("id", str(utente_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    # `.data` è tipizzato in postgrest-py come JSON generico; una riga di
    # `select` restituisce sempre un oggetto, mai uno scalare o una lista.
    return cast("dict[str, Any]", response.data)


def list_altri(client: Client, self_id: UUID) -> list[dict[str, Any]]:
    """Elenco membri (design-frontend.md §16), tutti tranne chi guarda:
    non avrebbe senso mostrare a un Utente una relazione con se stesso."""
    response = (
        client.table("utente")
        .select("id, nome_utente")
        .neq("id", str(self_id))
        .order("nome_utente")
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)


def get_utente_privato(client: Client, utente_id: UUID) -> dict[str, Any] | None:
    response = (
        client.table("utente_privato")
        .select("consenso_elaborazione_assistita, consenso_aggiornato_at, informativa_accettata_at")
        .eq("utente_id", str(utente_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return cast("dict[str, Any]", response.data)


def complete_registration(client: Client, nome_utente: str) -> dict[str, Any]:
    """Crea insieme `utente`+`utente_privato` per l'utente del `client`
    (`public.completa_registrazione`, docs/adr/0013): una singola
    transazione lato database, non due insert separate da PostgREST che
    non sarebbero atomiche tra loro. Solleva `postgrest.APIError` (codice
    23505) su nome utente già in uso o account già completato — il
    servizio distingue i due casi dal vincolo violato."""
    response = client.rpc("completa_registrazione", {"p_nome_utente": nome_utente}).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0]
