"""Dipendenza di autenticazione: verifica locale del JWT di sessione.

Le chiavi pubbliche vengono scaricate e cachate dall'endpoint JWKS del
progetto Supabase (docs/adr/0012): nessun segreto condiviso, nessuna
chiamata di rete a Supabase per richiesta autenticata a regime — solo un
refresh periodico della cache delle chiavi, già gestito da PyJWKClient,
rotazione di chiave compresa (su un `kid` sconosciuto rifà il fetch una
volta prima di arrendersi).
"""

from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.schemas.auth import AuthenticatedUser

_bearer_scheme = HTTPBearer(auto_error=False)

# Costante della piattaforma Supabase (tutte le richieste di utenti finali
# portano questa audience), non del progetto: non merita una variabile
# d'ambiente.
_EXPECTED_AUDIENCE = "authenticated"


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    settings = get_settings()
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),  # noqa: B008
) -> AuthenticatedUser:
    """Estrae e verifica il token dall'header Authorization.

    Unico punto in cui l'identità dell'utente entra nell'applicazione
    (AGENTS.md: "L'identità utente arriva SEMPRE da una dipendenza che
    verifica il token, MAI dal body o dalla query string.").
    """
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token di accesso mancante.")

    token = credentials.credentials
    settings = get_settings()

    try:
        signing_key = await run_in_threadpool(_jwks_client().get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=[signing_key.algorithm_name],
            audience=_EXPECTED_AUDIENCE,
            issuer=settings.jwt_issuer,
        )
        user_id = UUID(claims["sub"])
    except jwt.PyJWKClientConnectionError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Servizio di autenticazione non raggiungibile.",
        ) from error
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token non valido o scaduto.") from error

    return AuthenticatedUser(id=user_id, email=claims.get("email"), access_token=token)
