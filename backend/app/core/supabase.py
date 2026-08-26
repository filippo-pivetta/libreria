"""Factory dei client Supabase.

Coerenti con docs/adr/0001-back-end-unico-con-regole-di-riga.md: le richieste
che originano da un utente vanno eseguite con la sua identità, cosi che le
regole di riga (RLS) restino sempre valutate.

La chiave di servizio bypassa la RLS per definizione della piattaforma, e in
questo backend ha due soli usi ammessi:

    1. lo spazio file delle copertine (app/core/storage.py). Non tocca mai
       una riga — nemmeno una riga di catalogo, che pure non appartiene a un
       Utente. Il confine e le sue ragioni stanno in docs/adr/0016.
    2. la cancellazione dell'account (app/services/me_service.py,
       `elimina_account`, issue #8): `auth.admin.delete_user`, l'unico modo
       di rimuovere una riga in `auth.users`, schema su cui un ruolo
       `authenticated` non ha alcun privilegio. Arriva sempre *dopo* che la
       riga `public.utente` è già stata cancellata con l'identità
       dell'utente (RLS, `utente_delete_owner`): la chiave di servizio non
       decide mai da sola se un account va cancellato, si limita a
       completare fuori dallo schema `public` una cancellazione già
       avvenuta lì.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings

CODICE_FK_VIOLATA = "23503"
"""Violazione di una FK composita `(id, utente_id)`: la riga bersaglio non
esiste, oppure non è di chi scrive. I service la mappano su 404."""

CODICE_RLS_NEGATA = "42501"
"""Riga esistente ma di un altro Utente, su una scrittura che passa da un
upsert.

Un `insert` che viola la sola `with check` di una policy si ferma sulla FK
composita e restituisce 23503; ma quando l'upsert trova il conflitto,
Postgres passa al ramo `do update`, e lì è la `using` della policy di
update a rifiutare — con 42501, non con 23503. Sono due codici per la
stessa risposta ("quella riga non è tua"), e distinguerli nella risposta
HTTP fa trapelare quale dei due percorsi è stato imboccato: cioè se la
riga esiste. Vedi `recensioni_service.scrivi` e
`voci_service.correggi_nota_intenzione`, gli unici due upsert su tabelle
con RLS."""


def get_user_client(access_token: str) -> Client:
    """Client che opera con l'identità dell'utente autenticato."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client


@lru_cache
def get_service_client() -> Client:
    """Client con la chiave di servizio, ammesso solo per lo spazio file
    delle copertine (app/core/storage.py) e per la cancellazione
    dell'account (app/services/me_service.py::elimina_account, issue #8).

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
