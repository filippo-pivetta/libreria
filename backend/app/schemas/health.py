from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str | None = None
    """Presente solo se richiesto esplicitamente (`GET /health?database=1`).

    Assente nella risposta che serve al controllo di Fly, che è una
    domanda diversa — "il processo è vivo?" — e a cui la
    raggiungibilità del database non partecipa: `status` è "ok" in
    entrambi i casi, quindi calcolarla lì significava aprire una
    connessione a Postgres per un dato che nessuno leggeva."""
