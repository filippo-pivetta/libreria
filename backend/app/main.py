from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.exception_handlers import gestore_eccezioni_non_gestite
from app.routers import avanzamenti, collegamenti, health, letture, me, utenti, voci


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
    )

    # Rete di sicurezza generica per richiesta/IP: nessun endpoint aveva
    # un limite, incluso POST /collegamenti (enumerabile per differenza
    # di risposta 404 vs 200/201 su utente_id altrui).
    limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
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
    )

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
    app.include_router(utenti.router)
    app.include_router(collegamenti.router)
    return app


app = create_app()
