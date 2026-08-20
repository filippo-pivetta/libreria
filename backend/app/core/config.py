"""Configurazione applicativa letta dalle variabili d'ambiente.

Vedi backend/.env.example per l'elenco commentato di tutte le variabili.
"""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # --- Supabase / database ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    """Riservata ai lavori in background: non deve mai servire richieste
    che originano da un utente (docs/adr/0001)."""
    database_url: str
    """Stringa di connessione diretta a Postgres, usata dal repository
    per verifiche di raggiungibilità (es. health check)."""

    # --- Autenticazione ---
    supabase_jwt_issuer: str | None = None
    """Override esplicito dell'issuer atteso nei JWT di sessione
    (docs/adr/0012). Se assente, si deriva da supabase_url
    (`${SUPABASE_URL}/auth/v1`), il default sia in locale sia sul
    progetto hosted."""

    @property
    def jwt_issuer(self) -> str:
        return self.supabase_jwt_issuer or f"{self.supabase_url}/auth/v1"

    # --- HTTP ---
    cors_origins: str = "http://localhost:3000"
    """Origini ammesse per il CORS, separate da virgola."""

    # --- Funzioni assistite (non ancora implementate, vedi docs/prd.md) ---
    google_books_api_key: str | None = None
    openai_api_key: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _rifiuta_wildcard_cors(self) -> "Settings":
        # main.py monta CORSMiddleware con allow_credentials=True sempre
        # attivo: con "*" tra le origini, Starlette riflette l'Origin
        # della richiesta invece del wildcard letterale, autorizzando di
        # fatto richieste autenticate da qualunque sito. Fail-fast
        # all'avvio invece di un errore di configurazione silenzioso.
        if "*" in self.cors_origins_list:
            raise ValueError(
                "CORS_ORIGINS non può contenere '*': con allow_credentials=True "
                "(main.py) equivarrebbe ad autorizzare qualunque origine a fare "
                "richieste autenticate. Elenca le origini ammesse esplicitamente."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # i valori arrivano dall'ambiente/.env
