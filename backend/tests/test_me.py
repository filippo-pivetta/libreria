"""Test per GET /me: isolati sia dalla verifica JWT (dependency override,
vedi test_security.py per quella) sia da Supabase (me_service
monkeypatchato), sullo stesso spirito di isolamento di test_health.py.
"""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import me_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


def test_me_returns_profile_when_provisioned(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_get_me(access_token: str, utente_id: UUID) -> dict[str, Any]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        return {
            "id": str(utente_id),
            "nome_utente": "prova",
            "consenso_elaborazione_assistita": True,
            "consenso_aggiornato_at": "2026-08-18T00:00:00Z",
            "informativa_accettata_at": None,
        }

    monkeypatch.setattr(me_service, "get_me", _fake_get_me)

    response = authenticated.get("/me")

    assert response.status_code == 200
    body = response.json()
    assert body["nome_utente"] == "prova"
    assert body["informativa_accettata_at"] is None
    # Vincolo PRD: "le email non esistono nel prodotto".
    assert "email" not in body


def test_me_returns_404_when_not_provisioned(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_get_me(access_token: str, utente_id: UUID) -> None:
        return None

    monkeypatch.setattr(me_service, "get_me", _fake_get_me)

    response = authenticated.get("/me")

    assert response.status_code == 404


def test_me_requires_authentication(client: TestClient) -> None:
    # Nessun override: verifica che la dependency reale sia agganciata
    # alla route, non solo esercitata nei test isolati sopra.
    response = client.get("/me")

    assert response.status_code == 401


def test_complete_account_returns_created_profile(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_complete_account(access_token: str, nome_utente: str) -> dict[str, Any]:
        assert access_token == "test-token"
        assert nome_utente == "prova"
        return {
            "id": str(_USER_ID),
            "nome_utente": nome_utente,
            "consenso_elaborazione_assistita": True,
            "consenso_aggiornato_at": "2026-08-19T00:00:00Z",
            "informativa_accettata_at": "2026-08-19T00:00:00Z",
        }

    monkeypatch.setattr(me_service, "complete_account", _fake_complete_account)

    response = authenticated.post("/me", json={"nome_utente": "  prova  "})

    assert response.status_code == 201
    assert response.json()["nome_utente"] == "prova"


def test_complete_account_rejects_blank_nome_utente(authenticated: TestClient) -> None:
    response = authenticated.post("/me", json={"nome_utente": "   "})

    assert response.status_code == 422


def test_complete_account_returns_409_on_nome_utente_in_uso(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_complete_account(access_token: str, nome_utente: str) -> dict[str, Any]:
        raise me_service.NomeUtenteInUsoError

    monkeypatch.setattr(me_service, "complete_account", _fake_complete_account)

    response = authenticated.post("/me", json={"nome_utente": "già_preso"})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "nome_utente_in_uso"


def test_complete_account_returns_409_on_account_gia_completato(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_complete_account(access_token: str, nome_utente: str) -> dict[str, Any]:
        raise me_service.AccountGiaCompletatoError

    monkeypatch.setattr(me_service, "complete_account", _fake_complete_account)

    response = authenticated.post("/me", json={"nome_utente": "prova"})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "account_gia_completato"


def test_complete_account_requires_authentication(client: TestClient) -> None:
    response = client.post("/me", json={"nome_utente": "prova"})

    assert response.status_code == 401
