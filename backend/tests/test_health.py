"""L'health check: due domande diverse dietro la stessa rotta.

Il repository di accesso al database viene sostituito con un doppio di
test, cosi che la suite non dipenda da un'istanza Postgres reale.
"""

import pytest
from fastapi.testclient import TestClient

from app.repositories import database as database_repository


def test_health_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Il controllo che interroga Fly (backend/fly.toml) non tocca il
    database: `ping` qui esplode proprio per dimostrare che non viene
    chiamato. Prima erano 1.440 connessioni al giorno a Supabase aperte
    per un campo che quel controllo non guarda."""

    def _vietato() -> bool:
        raise AssertionError("liveness: non deve aprire una connessione al database")

    monkeypatch.setattr(database_repository, "ping", _vietato)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_con_database_riporta_la_raggiungibilita(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(database_repository, "ping", lambda: True)

    response = client.get("/health", params={"database": "1"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_con_database_irraggiungibile_resta_200(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un database giù non è il processo giù: `status` resta "ok" e la
    distinzione vive nel campo, come prima."""
    monkeypatch.setattr(database_repository, "ping", lambda: False)

    response = client.get("/health", params={"database": "1"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "unreachable"}
