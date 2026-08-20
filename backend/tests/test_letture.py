"""Test per /letture: isolati sia dalla verifica JWT (dependency
override) sia da Supabase (letture_service monkeypatchato)."""

from collections.abc import Iterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import letture_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_LETTURA_ID = UUID("00000000-0000-0000-0000-0000000000c1")


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


def test_delete_lettura_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, lettura_id: UUID) -> bool:
        assert access_token == "test-token"
        assert lettura_id == _LETTURA_ID
        return True

    monkeypatch.setattr(letture_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/letture/{_LETTURA_ID}")

    assert response.status_code == 204


def test_delete_lettura_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, lettura_id: UUID) -> bool:
        return False

    monkeypatch.setattr(letture_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/letture/{_LETTURA_ID}")

    assert response.status_code == 404


def test_delete_lettura_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/letture/{_LETTURA_ID}")

    assert response.status_code == 401
