"""I client HTTP verso le fonti esterne, tenuti aperti per tutta la vita
del processo.

Prima ogni funzione costruiva il proprio `httpx.AsyncClient` dentro un
`async with`, e lo chiudeva subito dopo: con lui se ne andavano la
connessione TCP e l'handshake TLS, da rifare alla chiamata successiva.
Sono 100-300ms per chiamata pagati *dentro* il tempo di risposta, e la
catena di risoluzione di un'aggiunta ne fa quattro o cinque di fila
(Google Books, Open Library una o più volte, Wikidata, Wikipedia).
Riusare il client li paga una volta sola.

È lo stesso ragionamento — e lo stesso rimedio — già applicato al pool
verso PostgREST in `app/core/supabase.py`. La differenza è che lì il
pool è uno solo, perché l'host è uno solo; qui serve un client per
fonte, perché timeout, intestazioni e redirect sono scelte diverse per
ciascuna e vivono nel modulo che conosce quella fonte.

**Nessun `async with` sul client restituito da qui.** Uscire dal blocco
lo chiuderebbe per sempre, e `httpx.AsyncClient` non si riapre: da quel
momento ogni chiamata a quella fonte fallirebbe con "client is closed"
finché la macchina non riparte. `cliente()` sotto se ne accorge e ne
costruisce uno nuovo (`is_closed`), ma è una rete di sicurezza, non un
permesso: chi vuole davvero terminare le connessioni chiama
`chiudi_tutti()`, che il lifespan invoca allo spegnimento.
"""

from collections.abc import Callable

import httpx

# Un tetto basso di proposito: la macchina è una shared-cpu-1x da 512MB
# (backend/fly.toml) e le fonti sono quattro host, non un ventaglio.
LIMITI = httpx.Limits(max_keepalive_connections=10, max_connections=20)

_CLIENTI: dict[str, httpx.AsyncClient] = {}


def cliente(nome: str, costruisci: Callable[[], httpx.AsyncClient]) -> httpx.AsyncClient:
    """Il client condiviso di `nome`, costruito alla prima richiesta.

    `costruisci` è una funzione e non un client già fatto perché la
    costruzione deve avvenire pigramente: `agente.intestazioni()` legge
    le impostazioni, e valutarle all'import legherebbe il `User-Agent`
    al momento dell'import invece che a quello del primo uso — lo stesso
    motivo per cui `agente.intestazioni` è una funzione e non una
    costante. Ed è la funzione a costruire, non questo modulo, perché
    timeout e intestazioni sono scelte della fonte: qui resta solo il
    fatto che il client è uno e dura.
    """
    esistente = _CLIENTI.get(nome)
    if esistente is None or esistente.is_closed:
        esistente = costruisci()
        _CLIENTI[nome] = esistente
    return esistente


async def chiudi_tutti() -> None:
    """Chiude i client aperti. Chiamata dal lifespan allo spegnimento,
    dopo che il worker si è fermato: prima sarebbe un client chiuso
    sotto i piedi di un lavoro ancora in corso."""
    for client in list(_CLIENTI.values()):
        try:
            await client.aclose()
        except Exception:  # noqa: BLE001  # sulla via dello spegnimento nulla deve bloccare
            pass
    _CLIENTI.clear()


def dimentica() -> None:
    """Solo per i test: i client sono di processo e sopravviverebbero tra
    casi, portandosi dietro il `MockTransport` del caso precedente."""
    _CLIENTI.clear()
