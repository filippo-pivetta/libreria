import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.exception_handlers import gestore_eccezioni_non_gestite
from app.core.rate_limit import limiter
from app.lavori.worker import Worker
from app.routers import (
    avanzamenti,
    collegamenti,
    health,
    insight,
    letture,
    me,
    metriche,
    preview,
    quaderni,
    recensioni,
    ricerca,
    schede,
    sintesi,
    suggerimenti,
    utenti,
    voci,
)

logger = logging.getLogger("app.lavori")


@asynccontextmanager
async def _ciclo_di_vita(_app: FastAPI) -> AsyncIterator[None]:
    """Avvia e ferma il worker dei lavori in secondo piano (docs/adr/0016).

    Il worker gira nello stesso processo dell'API: la coda vive nel
    database, quindi più processi possono comunque spartirsela
    (`FOR UPDATE SKIP LOCKED`) senza coordinamento esterno.

    `worker_abilitato = false` copre due casi: il worker avviato come
    processo separato (`python -m app.lavori`), e i test — che pure oggi
    non eseguono il lifespan, perché `TestClient(app)` lo esegue solo se
    usato come context manager, ma è una protezione accidentale su cui non
    conviene appoggiarsi (vedi tests/conftest.py).
    """
    settings = get_settings()
    worker = Worker() if settings.worker_abilitato else None
    if worker is not None:
        await worker.avvia()
        logger.info("Worker dei lavori in secondo piano avviato.")
    try:
        yield
    finally:
        if worker is not None:
            await worker.ferma()
            logger.info("Worker dei lavori in secondo piano fermato.")


def create_app() -> FastAPI:
    settings = get_settings()
    # /docs, /redoc e /openapi.json espongono la mappa completa degli
    # endpoint interni: utile in sviluppo, non da lasciare raggiungibile
    # in produzione.
    docs_abilitati = settings.environment != "production"
    app = FastAPI(
        title="Montaigne API",
        docs_url="/docs" if docs_abilitati else None,
        redoc_url="/redoc" if docs_abilitati else None,
        openapi_url="/openapi.json" if docs_abilitati else None,
        lifespan=_ciclo_di_vita,
    )

    # Rete di sicurezza generica per richiesta/IP: nessun endpoint aveva
    # un limite, incluso POST /collegamenti (enumerabile per differenza
    # di risposta 404 vs 200/201 su utente_id altrui). Definito in
    # app/core/rate_limit.py perché i router possano stringerlo dove
    # serve (la ricerca esterna consuma quota).
    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        _rate_limit_exceeded_handler,  # type: ignore[arg-type]  # slowapi non ha stub precisi
    )
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Senza, il browser non lascia leggere Content-Disposition da una
        # risposta cross-origin (frontend su Vercel, backend altrove):
        # GET /me/export/libri-letti lo usa per il nome del file scaricato
        # (issue #8).
        expose_headers=["Content-Disposition"],
    )

    # Nessuno comprimeva le risposte: né questo processo né il proxy di
    # Fly, che inoltra il corpo così com'è. Lo scaffale di una libreria
    # popolata è JSON con molte ripetizioni (nomi di stato, chiavi,
    # etichette di genere) — il materiale su cui gzip rende di più.
    #
    # `minimum_size`: sotto il chilobyte comprimere costa più CPU di
    # quanta banda risparmi, e le risposte piccole qui sono la
    # maggioranza (un cambio di stato, un avanzamento).
    #
    # `compresslevel=6` e non il 9 di default: su una shared-cpu-1x
    # (fly.toml) il livello 9 costa parecchia CPU per una manciata di
    # punti percentuali di rapporto in più. Il 6 è il ginocchio della
    # curva.
    app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)

    # Rete di sicurezza per tutto ciò che sfugge alle HTTPException
    # esplicite delle route (issue #11) — va registrato su Exception,
    # non su un codice di stato, altrimenti Starlette non lo aggancia
    # alla ServerErrorMiddleware più esterna.
    app.add_exception_handler(Exception, gestore_eccezioni_non_gestite)

    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(voci.router)
    app.include_router(letture.router)
    app.include_router(avanzamenti.router)
    app.include_router(recensioni.router)
    app.include_router(insight.router)
    app.include_router(utenti.router)
    app.include_router(collegamenti.router)
    app.include_router(metriche.router)
    app.include_router(ricerca.router)
    app.include_router(preview.router)
    app.include_router(schede.router)
    app.include_router(sintesi.router)
    app.include_router(quaderni.router)
    app.include_router(suggerimenti.router)
    return app


app = create_app()
