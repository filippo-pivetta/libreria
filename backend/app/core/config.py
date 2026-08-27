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

    # --- Cataloghi bibliografici ---
    contatto_operatore: str | None = None
    """URL o indirizzo email di chi ospita questa istanza, messo nel
    `User-Agent` di ogni richiesta verso una fonte esterna
    (`app/cataloghi/agente.py`). Non è una cortesia: la policy Wikimedia
    esige un contatto e blocca senza preavviso chi non lo dà, Open Library
    triplica il limite di frequenza a chi si identifica. Vuoto ricade
    sull'indirizzo pubblico del progetto, che resta un contatto valido ma
    non raggiunge chi ospita QUESTA istanza."""

    google_books_api_key: str | None = None
    """Fonte primaria della ricerca (PRD). Senza chiave l'API non risponde
    affatto: restituisce 429 con `quota_limit_value: "0"`, non un limite
    ridotto. Opzionale qui perché la sua assenza è uno stato che
    l'interfaccia deve saper dichiarare ("fonte irraggiungibile",
    docs/design-frontend.md §13), non un errore di avvio."""

    # --- Fornitore di modelli (docs/adr/0017, docs/adr/0018) ---
    openai_api_key: str | None = None
    """Unica chiave del fornitore, condivisa da tutte le funzioni
    assistite: le bibliografiche (`app/cataloghi/llm.py`, sempre
    attive) e le personali (`app/cataloghi/llm_personale.py` e gli
    embedding, subordinate al consenso dell'Utente). Opzionale come
    google_books_api_key, e per lo stesso motivo: la sua assenza è uno
    stato che l'interfaccia deve saper dichiarare — il PRD vuole che
    "la funzione assistita fallisca senza bloccare il flusso" — non un
    errore di avvio."""

    # --- Lavori in secondo piano (docs/adr/0016) ---
    worker_abilitato: bool = True
    """Avvia il worker dei lavori in secondo piano dentro il processo
    FastAPI (app/lavori/worker.py). A false quando il worker gira come
    processo separato (`python -m app.lavori`) e nei test."""

    worker_intervallo_secondi: float = 2.0
    """Attesa tra due passaggi sulla coda quando non c'è nulla da fare."""

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
