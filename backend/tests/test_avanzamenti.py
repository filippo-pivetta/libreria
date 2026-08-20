"""Test per /letture/{id}/avanzamenti e /avanzamenti: isolati sia dalla
verifica JWT (dependency override) sia da Supabase
(avanzamenti_service monkeypatchato)."""

from collections.abc import Iterator
from datetime import date
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import avanzamenti_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_LETTURA_ID = UUID("00000000-0000-0000-0000-0000000000c1")
_AVANZAMENTO_ID = UUID("00000000-0000-0000-0000-0000000000d1")

_AVANZAMENTO: dict[str, Any] = {
    "id": str(_AVANZAMENTO_ID),
    "lettura_id": str(_LETTURA_ID),
    "pagina": 50,
    "data": "2026-08-20",
    "generato_automaticamente": False,
    "creato_at": "2026-08-20T00:00:00Z",
}


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


# --- POST /letture/{id}/avanzamenti --------------------------------------


def test_post_avanzamento_returns_201(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_registra(
        access_token: str, utente_id: UUID, lettura_id: UUID, pagina: int, data: date | None
    ) -> dict[str, Any]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert lettura_id == _LETTURA_ID
        assert pagina == 50
        return _AVANZAMENTO

    monkeypatch.setattr(avanzamenti_service, "registra", _fake_registra)

    response = authenticated.post(f"/letture/{_LETTURA_ID}/avanzamenti", json={"pagina": 50})

    assert response.status_code == 201
    assert response.json()["pagina"] == 50


@pytest.mark.parametrize(
    "error_code",
    [
        "avanzamento_data_futura",
        "avanzamento_data_regressiva",
        "avanzamento_pagina_regressiva",
        "avanzamento_pagina_supera_successivo",
        "avanzamento_data_supera_successivo",
        "avanzamento_oltre_pagine_adottate",
    ],
)
def test_post_avanzamento_returns_409_on_domain_errors(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch, error_code: str
) -> None:
    async def _fake_registra(
        access_token: str, utente_id: UUID, lettura_id: UUID, pagina: int, data: date | None
    ) -> dict[str, Any]:
        raise avanzamenti_service.AvanzamentoNonValidoError(error_code)

    monkeypatch.setattr(avanzamenti_service, "registra", _fake_registra)

    response = authenticated.post(f"/letture/{_LETTURA_ID}/avanzamenti", json={"pagina": 50})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == error_code


def test_post_avanzamento_requires_authentication(client: TestClient) -> None:
    response = client.post(f"/letture/{_LETTURA_ID}/avanzamenti", json={"pagina": 50})

    assert response.status_code == 401


# --- PATCH /avanzamenti/{id} -----------------------------------------------


def test_patch_avanzamento_returns_updated(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, avanzamento_id: UUID, pagina: int | None, data: date | None
    ) -> dict[str, Any] | None:
        assert avanzamento_id == _AVANZAMENTO_ID
        assert pagina == 60
        return {**_AVANZAMENTO, "pagina": 60}

    monkeypatch.setattr(avanzamenti_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/avanzamenti/{_AVANZAMENTO_ID}", json={"pagina": 60})

    assert response.status_code == 200
    assert response.json()["pagina"] == 60


def test_patch_avanzamento_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, avanzamento_id: UUID, pagina: int | None, data: date | None
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(avanzamenti_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/avanzamenti/{_AVANZAMENTO_ID}", json={"pagina": 60})

    assert response.status_code == 404


def test_patch_avanzamento_returns_409_on_domain_error(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, avanzamento_id: UUID, pagina: int | None, data: date | None
    ) -> dict[str, Any] | None:
        raise avanzamenti_service.AvanzamentoNonValidoError("avanzamento_pagina_regressiva")

    monkeypatch.setattr(avanzamenti_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/avanzamenti/{_AVANZAMENTO_ID}", json={"pagina": 10})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "avanzamento_pagina_regressiva"


def test_patch_avanzamento_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/avanzamenti/{_AVANZAMENTO_ID}", json={"pagina": 60})

    assert response.status_code == 401


# --- DELETE /avanzamenti/{id} ----------------------------------------------


def test_delete_avanzamento_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, avanzamento_id: UUID) -> bool:
        assert avanzamento_id == _AVANZAMENTO_ID
        return True

    monkeypatch.setattr(avanzamenti_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/avanzamenti/{_AVANZAMENTO_ID}")

    assert response.status_code == 204


def test_delete_avanzamento_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, avanzamento_id: UUID) -> bool:
        return False

    monkeypatch.setattr(avanzamenti_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/avanzamenti/{_AVANZAMENTO_ID}")

    assert response.status_code == 404


def test_delete_avanzamento_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/avanzamenti/{_AVANZAMENTO_ID}")

    assert response.status_code == 401
