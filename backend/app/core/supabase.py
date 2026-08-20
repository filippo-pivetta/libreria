"""Factory dei client Supabase.

Coerenti con docs/adr/0001-back-end-unico-con-regole-di-riga.md: le richieste
che originano da un utente vanno eseguite con la sua identità, cosi che le
regole di riga (RLS) restino sempre valutate. La chiave di servizio resta
riservata ai lavori in background, che non servono richieste di utenti.
"""

from supabase import Client, create_client

from app.core.config import get_settings


def get_user_client(access_token: str) -> Client:
    """Client che opera con l'identità dell'utente autenticato."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
