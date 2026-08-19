from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exception_handlers import gestore_eccezioni_non_gestite
from app.routers import health, me


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Montaigne API")

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
    return app


app = create_app()
