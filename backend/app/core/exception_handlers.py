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
"""

import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse

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
    )
