"""Test per /collegamenti: isolati sia dalla verifica JWT (dependency
override) sia da Supabase (collegamenti_service monkeypatchato), stesso
pattern di test_voci.py."""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import collegamenti_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_ALTRO_ID = UUID("00000000-0000-0000-0000-000000000002")
_COLLEGAMENTO_ID = UUID("00000000-0000-0000-0000-0000000000e1")

_COLLEGAMENTO: dict[str, Any] = {
    "id": str(_COLLEGAMENTO_ID),
    "stato": "in_attesa",
    "richiesto_da_me": True,
    "altro": {"id": str(_ALTRO_ID), "nome_utente": "altra_persona"},
    "creato_at": "2026-08-20T00:00:00Z",
    "aggiornato_at": "2026-08-20T00:00:00Z",
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


# --- GET /collegamenti -----------------------------------------------------


def test_get_collegamenti_returns_list(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_elenco(access_token: str, self_id: UUID) -> list[dict[str, Any]]:
        assert access_token == "test-token"
        assert self_id == _USER_ID
        return [_COLLEGAMENTO]

    monkeypatch.setattr(collegamenti_service, "elenco", _fake_elenco)

    response = authenticated.get("/collegamenti")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["altro"]["nome_utente"] == "altra_persona"


def test_get_collegamenti_requires_authentication(client: TestClient) -> None:
    response = client.get("/collegamenti")

    assert response.status_code == 401


# --- POST /collegamenti -----------------------------------------------------


def test_post_collegamenti_creates_new_returns_201(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_invia(
        access_token: str, self_id: UUID, altro_utente_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        assert access_token == "test-token"
        assert self_id == _USER_ID
        assert altro_utente_id == _ALTRO_ID
        return _COLLEGAMENTO, False

    monkeypatch.setattr(collegamenti_service, "invia_richiesta", _fake_invia)

    response = authenticated.post("/collegamenti", json={"utente_id": str(_ALTRO_ID)})

    assert response.status_code == 201
    body = response.json()
    assert body["already_existed"] is False
    assert body["collegamento"]["id"] == str(_COLLEGAMENTO_ID)


def test_post_collegamenti_returns_200_when_already_existing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_invia(
        access_token: str, self_id: UUID, altro_utente_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        return _COLLEGAMENTO, True

    monkeypatch.setattr(collegamenti_service, "invia_richiesta", _fake_invia)

    response = authenticated.post("/collegamenti", json={"utente_id": str(_ALTRO_ID)})

    assert response.status_code == 200
    assert response.json()["already_existed"] is True


def test_post_collegamenti_returns_404_on_utente_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_invia(
        access_token: str, self_id: UUID, altro_utente_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        raise collegamenti_service.UtenteInesistenteError

    monkeypatch.setattr(collegamenti_service, "invia_richiesta", _fake_invia)

    response = authenticated.post("/collegamenti", json={"utente_id": str(_ALTRO_ID)})

    assert response.status_code == 404
    assert response.json()["detail"]["error_code"] == "utente_inesistente"


def test_post_collegamenti_returns_422_on_richiesta_a_se_stessi(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_invia(
        access_token: str, self_id: UUID, altro_utente_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        raise collegamenti_service.RichiestaASeStessiError

    monkeypatch.setattr(collegamenti_service, "invia_richiesta", _fake_invia)

    response = authenticated.post("/collegamenti", json={"utente_id": str(_USER_ID)})

    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "richiesta_a_se_stessi"


def test_post_collegamenti_rejects_missing_body(authenticated: TestClient) -> None:
    response = authenticated.post("/collegamenti", json={})

    assert response.status_code == 422


def test_post_collegamenti_requires_authentication(client: TestClient) -> None:
    response = client.post("/collegamenti", json={"utente_id": str(_ALTRO_ID)})

    assert response.status_code == 401


# --- PATCH /collegamenti/{id} -----------------------------------------------


def test_patch_collegamento_returns_updated_collegamento(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_accetta(
        access_token: str, self_id: UUID, collegamento_id: UUID
    ) -> dict[str, Any]:
        assert collegamento_id == _COLLEGAMENTO_ID
        return {**_COLLEGAMENTO, "stato": "attiva"}

    monkeypatch.setattr(collegamenti_service, "accetta", _fake_accetta)

    response = authenticated.patch(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 200
    assert response.json()["stato"] == "attiva"


def test_patch_collegamento_returns_404_when_not_found(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_accetta(
        access_token: str, self_id: UUID, collegamento_id: UUID
    ) -> dict[str, Any]:
        raise collegamenti_service.CollegamentoNonTrovatoError

    monkeypatch.setattr(collegamenti_service, "accetta", _fake_accetta)

    response = authenticated.patch(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 404


def test_patch_collegamento_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 401


# --- DELETE /collegamenti/{id} ----------------------------------------------


def test_delete_collegamento_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_termina(access_token: str, collegamento_id: UUID) -> bool:
        assert collegamento_id == _COLLEGAMENTO_ID
        return True

    monkeypatch.setattr(collegamenti_service, "termina", _fake_termina)

    response = authenticated.delete(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 204


def test_delete_collegamento_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_termina(access_token: str, collegamento_id: UUID) -> bool:
        return False

    monkeypatch.setattr(collegamenti_service, "termina", _fake_termina)

    response = authenticated.delete(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 404


def test_delete_collegamento_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/collegamenti/{_COLLEGAMENTO_ID}")

    assert response.status_code == 401
