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

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

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


class _PoolCondiviso(httpx.Client):
    """Lo stesso `httpx.Client`, con `close()`/`aclose()` disattivate.

    Trovato in review (27 agosto 2026): niente nel codice di oggi chiude
    mai questo pool, ma non c'era nulla a impedirlo domani. `postgrest`
    espone `SyncPostgrestClient.aclose()` — che chiama esattamente
    `self.session.close()` — anche come `__exit__` di un `with`: un
    `with get_user_client(token).postgrest as pg:` scritto altrove,
    magari per abitudine presa su un client non condiviso, chiuderebbe
    per sempre QUESTO oggetto. `httpx.Client` non si riapre: da quel
    momento ogni richiesta di ogni utente fallirebbe con "client is
    closed" finché la macchina non riparte — un'interruzione totale,
    silenziosa all'origine (l'errore comparirebbe lontano dalla riga che
    l'ha causata), che nessun test avrebbe intercettato.

    Chi vuole davvero terminare le connessioni del processo chiama
    `chiudi_pool_http()` sotto, esplicito e cercabile."""

    def close(self) -> None:
        # `httpx.Client` (sincrono) non ha `aclose`: solo `AsyncClient` ce
        # l'ha. `SyncPostgrestClient.aclose()` (postgrest, vedi sopra)
        # chiama comunque `session.close()`, quindi questa sola
        # sovrascrittura basta a coprire la via che preoccupa.
        pass


@lru_cache
def _pool_http() -> _PoolCondiviso:
    """Il pool di connessioni verso PostgREST, condiviso da tutte le
    richieste.

    Senza, `get_user_client` sotto costruiva un `httpx.Client` nuovo a
    ogni richiesta HTTP servita, e con esso una connessione TCP e un
    handshake TLS nuovi verso Supabase — pagati *dentro* il tempo di
    risposta di ogni pagina. Riusare il pool li paga una volta sola,
    all'avvio della macchina.

    **Perché è sicuro condividerlo, benché ogni richiesta porti il token
    di un utente diverso.** Il token NON vive qui. `postgrest.auth()`
    scrive l'header su `self.headers` del client postgrest — che resta
    uno per richiesta — e `from_()` lo passa alla singola richiesta
    accanto alla sessione, invece di appoggiarsi agli header di
    default della sessione (postgrest `from_`: `SyncRequestBuilder(
    self.session, ..., self.headers, ...)`). Questo pool viene
    costruito senza alcun header di autorizzazione proprio, quindi non
    c'è nulla che possa trapelare da una richiesta all'altra.
    Verificato da `tests/test_supabase_client.py`, che incrocia
    deliberatamente due token sullo stesso pool.

    `http2=True` per non discostarsi dal client che postgrest si
    costruirebbe da sé (postgrest `SyncPostgrestClient.__init__`).
    """
    return _PoolCondiviso(
        http2=True,
        follow_redirects=True,
        # Il tetto alle connessioni tenute aperte è basso di proposito:
        # la macchina è una shared-cpu-1x da 512MB (fly.toml) e serve
        # un'istanza sola di Supabase, non un ventaglio di host.
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        # `connect` corto perché una connessione che non si apre in
        # cinque secondi non si aprirà; `read` più lungo perché alcune
        # query di elenco sono legittimamente lente.
        timeout=httpx.Timeout(15.0, connect=5.0),
    )


def chiudi_pool_http() -> None:
    """Chiude davvero il pool — l'unica via, ora che `close()` sull'oggetto
    stesso non fa nulla. Da chiamare nello shutdown del processo, se mai
    servirà liberare le connessioni esplicitamente invece di lasciarle
    al sistema operativo alla terminazione."""
    if _pool_http.cache_info().currsize:
        httpx.Client.close(_pool_http())
        _pool_http.cache_clear()


def get_user_client(access_token: str) -> Client:
    """Client che opera con l'identità dell'utente autenticato.

    L'oggetto è nuovo a ogni chiamata — deve esserlo, perché è dove vive
    il token — ma le connessioni sottostanti sono quelle già aperte del
    pool condiviso (`_pool_http`).
    """
    settings = get_settings()
    client = create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=SyncClientOptions(httpx_client=_pool_http()),
    )
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
