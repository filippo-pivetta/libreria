"""Il consenso all'elaborazione assistita: un solo posto che lo legge, un
solo posto che lo cambia (issue #6, docs/adr/0008).

Il PRD tiene le funzioni assistite su due lati di un confine e chiede a
ogni funzione futura di dichiarare da che parte sta:

    fuori dal consenso  classificazione dei generi, deduzione anno/lingua,
                        riconduzione degli autori, deduplicazione — solo
                        dato bibliografico condiviso, attive sempre, anche
                        a consenso revocato (regola 31)
    dentro il consenso  preview personalizzata, suggerimenti di lettura,
                        ricerca semantica, sintesi tematica, acquisizione
                        da foto — toccano testi dell'Utente (regola 30)

`esigi_consenso` è il cancello per le seconde. Un solo punto di lettura e
non un controllo ripetuto in ogni service: una funzione personale che si
dimenticasse di chiamarlo sarebbe una violazione della regola 30, e
concentrarlo rende la dimenticanza visibile in revisione.
"""

from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import utente_repository

INDICI_PRONTI = "pronti"
INDICI_SPENTI = "spenti"
INDICI_IN_RICOSTRUZIONE = "in_ricostruzione"


class ConsensoRevocatoError(Exception):
    """La funzione richiesta è fra le cinque che il consenso copre, e il
    consenso è spento.

    I router la mappano su 409 e non su 403: non è un problema di
    autorizzazione, è una funzione che l'Utente ha scelto di spegnere e
    che l'interfaccia deve poter dichiarare spenta invece di restituire
    zero risultati come se non ci fosse nulla da trovare (PRD, caso
    limite "ricerca semantica invocata a consenso revocato").
    """


class ProfiloAssenteError(Exception):
    """Nessuna riga `utente_privato`: l'account non è mai stato completato
    (docs/adr/0013). Distinto dal consenso revocato, perché la risposta è
    un 404, non un 409."""


async def stato(access_token: str, utente_id: UUID) -> tuple[bool, str]:
    """Consenso e stato degli indici, letti insieme perché ogni funzione
    personale ha bisogno di entrambi: il primo per partire, il secondo per
    dichiararsi incompleta durante una ricostruzione."""
    client = get_user_client(access_token)
    riga = await run_in_threadpool(utente_repository.get_utente_privato, client, utente_id)
    if riga is None:
        raise ProfiloAssenteError
    consenso = bool(riga["consenso_elaborazione_assistita"])
    return consenso, str(riga.get("indici_stato") or INDICI_PRONTI)


async def esigi_consenso(access_token: str, utente_id: UUID) -> str:
    """Solleva se il consenso è spento; altrimenti restituisce lo stato
    degli indici, che il chiamante userà per dichiararsi incompleto."""
    consenso, indici_stato = await stato(access_token, utente_id)
    if not consenso:
        raise ConsensoRevocatoError
    return indici_stato
