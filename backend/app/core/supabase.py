"""Factory dei client Supabase.

Coerenti con docs/adr/0001-back-end-unico-con-regole-di-riga.md: le richieste
che originano da un utente vanno eseguite con la sua identità, cosi che le
regole di riga (RLS) restino sempre valutate.

La chiave di servizio bypassa la RLS per definizione della piattaforma, e in
questo backend ha un solo uso ammesso: lo spazio file delle copertine. Non
tocca mai una riga — nemmeno una riga di catalogo, che pure non appartiene a
un Utente. Il confine e le sue ragioni stanno in docs/adr/0016.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


def get_user_client(access_token: str) -> Client:
    """Client che opera con l'identità dell'utente autenticato."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client


@lru_cache
def get_service_client() -> Client:
    """Client con la chiave di servizio, ammesso **solo** per lo spazio file
    delle copertine (app/core/storage.py).

    Non è la via per scrivere il catalogo, benché il catalogo sia dato
    condiviso senza proprietario: quelle scritture passano da
    app/repositories/catalogo_repository.py su connessione diretta, perché
    devono essere transazionali su più tabelle (una scheda con
    l'identificativo scritto ma gli autori no verrebbe ritrovata per sempre
    dal primo passo della risoluzione) e perché `service_role` non ha
    comunque i privilegi SQL sulle tabelle `public` — verificato:
    solo REFERENCES, TRIGGER e TRUNCATE, nessun INSERT né SELECT.

    Cache: il client non porta stato per richiesta, a differenza di
    get_user_client che vi lega un token.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
