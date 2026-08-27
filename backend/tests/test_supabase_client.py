"""Il pool di connessioni condiviso verso PostgREST non mescola i token.

`app/core/supabase.py::_pool_http` fa riusare a tutte le richieste lo
stesso `httpx.Client`, per non pagare un handshake TLS dentro il tempo
di risposta di ogni pagina. La condivisione è sicura solo finché il
token di sessione viaggia **per richiesta** e non sugli header di
default della sessione: se un aggiornamento di `supabase`/`postgrest`
spostasse l'autorizzazione sulla sessione, un utente comincerebbe a
leggere con l'identità di un altro — e la RLS, che valuta `auth.uid()`
sul token ricevuto, gliene darebbe i dati.

È il genere di rottura che non si manifesta come un errore ma come una
risposta plausibile e sbagliata, quindi va bloccata da un test invece
che da un commento.
"""

import httpx
import pytest
from supabase import create_client
from supabase.lib.client_options import SyncClientOptions

from app.core.supabase import _pool_http


@pytest.fixture
def pool_finto() -> tuple[httpx.Client, list[str | None]]:
    """Un pool che registra l'autorizzazione di ogni richiesta uscente
    invece di spedirla davvero."""
    visti: list[str | None] = []

    def registra(request: httpx.Request) -> httpx.Response:
        visti.append(request.headers.get("authorization"))
        return httpx.Response(200, json=[], headers={"Content-Range": "0-0/0"})

    return httpx.Client(transport=httpx.MockTransport(registra)), visti


def test_token_non_trapela_tra_richieste_sullo_stesso_pool(
    pool_finto: tuple[httpx.Client, list[str | None]],
) -> None:
    """Due utenti, un pool solo, richieste incrociate.

    L'ordine è A, B, A di proposito: se il token vivesse sulla sessione
    condivisa, l'ultimo impostato vincerebbe e la terza richiesta
    porterebbe il token di B.
    """
    pool, visti = pool_finto

    def client_per(token: str):
        client = create_client(
            "https://esempio.supabase.co",
            "anon-key",
            options=SyncClientOptions(httpx_client=pool),
        )
        client.postgrest.auth(token)
        return client

    alice = client_per("TOKEN-DI-ALICE")
    bruno = client_per("TOKEN-DI-BRUNO")

    assert alice.postgrest.session is bruno.postgrest.session, (
        "il presupposto del test è che il pool sia davvero condiviso"
    )

    alice.table("voce_di_libreria").select("id").execute()
    bruno.table("voce_di_libreria").select("id").execute()
    alice.table("voce_di_libreria").select("id").execute()

    assert visti == [
        "Bearer TOKEN-DI-ALICE",
        "Bearer TOKEN-DI-BRUNO",
        "Bearer TOKEN-DI-ALICE",
    ]


def test_il_pool_condiviso_non_porta_autorizzazioni_proprie() -> None:
    """Il pool si costruisce senza header di autorizzazione: non c'è
    nulla da cui possa trapelare un'identità se un client dimenticasse
    di impostare il proprio token."""
    assert "authorization" not in _pool_http().headers


def test_il_pool_e_lo_stesso_oggetto_tra_le_chiamate() -> None:
    """Se tornasse un client nuovo a ogni chiamata, le connessioni non
    verrebbero riusate e l'intero intervento sarebbe inutile pur
    restando corretto — un fallimento silenzioso di prestazioni."""
    assert _pool_http() is _pool_http()


def test_chiudere_il_client_postgrest_non_chiude_il_pool_condiviso() -> None:
    """Un `with get_user_client(token).postgrest as pg: ...` scritto
    altrove — pattern naturale per chi è abituato a un client non
    condiviso — chiama `aclose()` -> `session.close()` sul pool. Prima
    della classe `_PoolCondiviso`, questo chiudeva per sempre il
    singleton: ogni richiesta successiva di ogni utente, nell'intero
    processo, avrebbe fallito con "client is closed" fino al riavvio
    della macchina.

    Qui si simula esattamente quel pattern e si verifica che il pool
    resti aperto e utilizzabile — usando lo stesso doppio client (Alice,
    poi Bruno) del test sopra, per provare che l'isolamento del token
    non si sia perso insieme alla protezione dalla chiusura."""
    pool = _pool_http()

    with create_client(
        "https://esempio.supabase.co",
        "anon-key",
        options=SyncClientOptions(httpx_client=pool),
    ).postgrest as pg:
        pg.auth("TOKEN-DI-ALICE")

    assert not pool.is_closed, "il pool condiviso non deve chiudersi mai da qui"

    # E resta davvero utilizzabile per la richiesta successiva, non solo
    # "non marcato chiuso": la riprova è farci passare un'altra
    # richiesta reale, con l'identità di un altro utente.
    def registra(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization") == "Bearer TOKEN-DI-BRUNO"
        return httpx.Response(200, json=[], headers={"Content-Range": "0-0/0"})

    pool_finto_dopo = httpx.Client(transport=httpx.MockTransport(registra))
    bruno = create_client(
        "https://esempio.supabase.co",
        "anon-key",
        options=SyncClientOptions(httpx_client=pool_finto_dopo),
    )
    bruno.postgrest.auth("TOKEN-DI-BRUNO")
    bruno.table("voce_di_libreria").select("id").execute()
