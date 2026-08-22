"""Test per /voci/{id}/recensione: isolati sia dalla verifica JWT
(dependency override) sia da Supabase (recensioni_service monkeypatchato),
stesso pattern di test_voci.py."""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import recensioni_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000a1")

_RECENSIONE: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-0000000000e1",
    "voce_id": str(_VOCE_ID),
    "testo": "Un libro che resta addosso.",
    "visibilita": "condiviso",
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


# --- PUT /voci/{id}/recensione ---------------------------------------------


def test_put_recensione_crea_con_visibilita_di_default(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_scrivi(
        access_token: str, utente_id: UUID, voce_id: UUID, testo: str, visibilita: str
    ) -> dict[str, Any]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert voce_id == _VOCE_ID
        assert testo == "Un libro che resta addosso."
        # PRD regola 2: nasce condivisa se non specificato.
        assert visibilita == "condiviso"
        return _RECENSIONE

    monkeypatch.setattr(recensioni_service, "scrivi", _fake_scrivi)

    response = authenticated.put(
        f"/voci/{_VOCE_ID}/recensione", json={"testo": "Un libro che resta addosso."}
    )

    assert response.status_code == 200
    assert response.json()["visibilita"] == "condiviso"


def test_put_recensione_aggiorna_sostituendo_il_testo_precedente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_scrivi(
        access_token: str, utente_id: UUID, voce_id: UUID, testo: str, visibilita: str
    ) -> dict[str, Any]:
        assert testo == "Cambio idea."
        assert visibilita == "privato"
        return {**_RECENSIONE, "testo": "Cambio idea.", "visibilita": "privato"}

    monkeypatch.setattr(recensioni_service, "scrivi", _fake_scrivi)

    response = authenticated.put(
        f"/voci/{_VOCE_ID}/recensione",
        json={"testo": "Cambio idea.", "visibilita": "privato"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["testo"] == "Cambio idea."
    assert body["visibilita"] == "privato"


def test_put_recensione_returns_404_su_voce_altrui_o_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # `recensioni_service.scrivi` restituisce `None` sulla violazione della
    # FK composita voce_di_libreria(id, utente_id) — regola 5, nessun
    # utente scrive contenuti altrui.
    async def _fake_scrivi(
        access_token: str, utente_id: UUID, voce_id: UUID, testo: str, visibilita: str
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(recensioni_service, "scrivi", _fake_scrivi)

    response = authenticated.put(f"/voci/{_VOCE_ID}/recensione", json={"testo": "x"})

    assert response.status_code == 404


def test_put_recensione_rejects_invalid_visibilita(authenticated: TestClient) -> None:
    response = authenticated.put(
        f"/voci/{_VOCE_ID}/recensione", json={"testo": "x", "visibilita": "pubblico"}
    )

    assert response.status_code == 422


def test_put_recensione_requires_authentication(client: TestClient) -> None:
    response = client.put(f"/voci/{_VOCE_ID}/recensione", json={"testo": "x"})

    assert response.status_code == 401


# --- DELETE /voci/{id}/recensione -------------------------------------------


def test_delete_recensione_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, voce_id: UUID) -> bool:
        assert voce_id == _VOCE_ID
        return True

    monkeypatch.setattr(recensioni_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/voci/{_VOCE_ID}/recensione")

    assert response.status_code == 204


def test_delete_recensione_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, voce_id: UUID) -> bool:
        return False

    monkeypatch.setattr(recensioni_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/voci/{_VOCE_ID}/recensione")

    assert response.status_code == 404


def test_delete_recensione_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/voci/{_VOCE_ID}/recensione")

    assert response.status_code == 401
