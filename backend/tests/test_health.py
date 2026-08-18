"""Test di esempio: verifica che l'health check risponda 200.

Il repository di accesso al database viene sostituito con un doppio di
test, cosi che la suite non dipenda da un'istanza Postgres reale.
"""

import pytest
from fastapi.testclient import TestClient

from app.repositories import database as database_repository


def test_health_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(database_repository, "ping", lambda: True)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
