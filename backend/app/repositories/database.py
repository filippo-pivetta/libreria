"""Accesso diretto a Postgres, al di fuori del client Supabase.

Due usi, entrambi fuori dalla portata di PostgREST: la verifica di
raggiungibilità dell'health check, e l'apertura di connessioni per i
percorsi che hanno bisogno di una transazione su più tabelle o di
costrutti SQL che PostgREST non esprime (`FOR UPDATE SKIP LOCKED` della
coda dei lavori). Nessuna query di dominio qui: quelle stanno nei
repository che ricevono la connessione.

**`connessione_dal_pool()` contro `apri_connessione()`.** Misurato dal
vivo il 23 settembre 2026, dalla macchina Fly (Amsterdam) verso il
progetto Supabase (Irlanda): il solo giro di rete è sui 20ms, ma aprire
una connessione — TCP più handshake TLS più autenticazione — ne costa
~170ms, otto volte tanto, perché servono più andate e ritorni in
sequenza prima che possa partire anche solo la prima query. Prima
`apri_connessione()` era l'unica via, chiamata a ogni `with` da un
gestore di lavoro o da un service: ogni ricerca esterna, ogni libro
aggiunto pagava quel costo una o due volte, dentro il tempo di risposta.
Lo stesso ragionamento — e lo stesso rimedio — già applicato al pool
verso PostgREST in `app/core/supabase.py` e ai client verso le fonti
esterne in `app/cataloghi/trasporto.py`: `connessione_dal_pool()` pesca
da un pool di connessioni tenute aperte per tutta la vita del processo,
e chi la usa con `with database.connessione_dal_pool() as connessione:`
la restituisce al pool invece di chiuderla. È la via per ogni chiamata
dentro un gestore di lavoro o un service.

`apri_connessione()` resta per l'unico caso che non vuole un pool: il
worker (`app/lavori/worker.py`) apre una connessione dedicata una sola
volta all'avvio e la tiene per tutto il proprio ciclo di vita — non
c'è un'apertura per chiamata da risparmiare, e tenerla fuori dal pool
condiviso libera quegli slot per le richieste web.
"""

from contextlib import AbstractContextManager
from functools import lru_cache
from typing import Any

import psycopg
from psycopg_pool import ConnectionPool

from app.core.config import get_settings


def ping() -> bool:
    """Esegue una query minima per verificare che il database sia raggiungibile."""
    settings = get_settings()
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return True
    except psycopg.Error:
        return False


def apri_connessione() -> psycopg.Connection[Any]:
    """Connessione diretta a Postgres, con l'identità del ruolo della
    stringa di connessione (non quella di un Utente: qui non passa alcun
    dato di proprietà di un Utente, docs/adr/0016).

    Chi la apre la chiude. `autocommit=True` perché le transazioni le
    apre esplicitamente chi ne ha bisogno, con `connection.transaction()`:
    la coda dei lavori vuole che ogni istruzione di presa in carico sia
    visibile subito agli altri worker, non trattenuta in una transazione
    implicita aperta a tempo indeterminato dal ciclo.

    Solo per il worker (vedi il modulo). Ogni altro chiamante vuole
    `connessione_dal_pool()`.
    """
    settings = get_settings()
    return psycopg.connect(settings.database_url, autocommit=True)


@lru_cache
def _pool() -> ConnectionPool:
    # Tetto basso di proposito, come per gli altri pool del backend: la
    # macchina è una shared-cpu-1x da 512MB (fly.toml), condivisa fra le
    # richieste web e il lotto di lavori del worker (WORKER_LOTTO=3, che
    # non passa da qui). `autocommit=True` per lo stesso motivo di
    # `apri_connessione`: chi vuole una transazione la apre da sé con
    # `connection.transaction()`.
    settings = get_settings()
    return ConnectionPool(
        settings.database_url,
        min_size=1,
        max_size=5,
        kwargs={"autocommit": True},
        open=True,
    )


def connessione_dal_pool() -> AbstractContextManager[psycopg.Connection[Any]]:
    """La connessione da usare in ogni gestore di lavoro e ogni service:
    pescata da un pool tenuto aperto per tutta la vita del processo
    invece che aperta e chiusa a ogni chiamata (vedi il modulo per i
    numeri). Si usa come prima: `with database.connessione_dal_pool() as
    connessione:` — solo che uscire dal blocco la restituisce al pool
    invece di chiuderla per sempre."""
    return _pool().connection()


def chiudi_pool_db() -> None:
    """Chiude davvero il pool. Da chiamare nello shutdown del processo, se
    mai servirà liberare le connessioni esplicitamente invece di
    lasciarle al sistema operativo alla terminazione — lo stesso
    compromesso di `chiudi_pool_http` in `app/core/supabase.py`. Utile
    anche ai test, per non portarsi dietro fra un caso e l'altro
    connessioni aperte verso un'istanza di Postgres già chiusa."""
    if _pool.cache_info().currsize:
        _pool().close()
        _pool.cache_clear()
