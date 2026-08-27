"""Rete di sicurezza per le eccezioni che sfuggono alle `HTTPException`
esplicite delle route (issue #11). Senza questo handler, un'eccezione
non prevista torna al client con la risposta di default di
Starlette/FastAPI — nella migliore ipotesi un 500 senza la forma di
risposta che il frontend si aspetta, nella peggiore un traceback se il
debug non è disattivato correttamente in produzione.

Registrato su `Exception` (non su un codice di stato): è l'unico modo
per cui Starlette lo aggancia alla ServerErrorMiddleware, il livello
più esterno, che vede anche le eccezioni sollevate fuori da una route
riconosciuta (dependency, middleware).

Quel livello è anche **fuori dal CORSMiddleware**, e da qui la seconda
responsabilità di questo modulo: le intestazioni CORS le scrive lui,
perché nessuno le aggiungerà a valle. Senza, ogni 500 arriva al browser
senza `Access-Control-Allow-Origin`, e la console mostra un errore di
CORS al posto dell'errore vero — il messaggio che il frontend avrebbe
saputo leggere resta invisibile, e si finisce a cercare un problema di
configurazione che non esiste. Costato un'ora il 27 agosto 2026, su un
500 che era una violazione di CHECK in `crea_scheda`.
"""

import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger("app.errori_non_gestiti")

MESSAGGIO_GENERICO = "Qualcosa è andato storto. Riprova più tardi."
"""Testo in linea con `docs/montaigne-design-frontend.md` §17: cosa è
successo, non "ops" né scuse — l'unico dettaglio che può dare senza
rivelare l'interno del sistema."""


async def gestore_eccezioni_non_gestite(request: Request, exc: Exception) -> JSONResponse:
    # exc_info=exc, non solo `exc_info=True`: qui non siamo dentro un
    # blocco except, quindi non c'è un'eccezione "corrente" nel
    # contesto del logger da cui dedurre automaticamente il traceback.
    logger.error("Eccezione non gestita: %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        # Stessa forma ({"detail": ...}) delle HTTPException esplicite
        # (vedi app/routers/me.py): chi consuma l'API non deve distinguere
        # un errore previsto da uno imprevisto per leggere il messaggio.
        content={"detail": MESSAGGIO_GENERICO},
        headers=_intestazioni_cors(request),
    )


def _intestazioni_cors(request: Request) -> dict[str, str]:
    """Le stesse intestazioni che il CORSMiddleware metterebbe, se questa
    risposta gli passasse davanti — cosa che non accade (vedi il docstring
    del modulo).

    L'origine si rispecchia una per una e non con `*`: il middleware è
    montato con `allow_credentials=True` (app/main.py), e con le
    credenziali il carattere jolly non è ammesso dalla specifica. Un'origine
    non in elenco non riceve nulla, esattamente come dal middleware: qui si
    replica una decisione già presa altrove, non se ne prende una nuova.
    """
    origine = request.headers.get("origin")
    if not origine or origine not in get_settings().cors_origins_list:
        return {}
    return {
        "Access-Control-Allow-Origin": origine,
        "Access-Control-Allow-Credentials": "true",
        # La risposta dipende dall'origine: senza, una cache condivisa
        # potrebbe servirne una a un'origine diversa.
        "Vary": "Origin",
    }
