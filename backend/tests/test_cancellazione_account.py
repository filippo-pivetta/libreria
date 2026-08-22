"""Test per la cancellazione self-service dell'account (issue #8, PRD
regole 26-29): il cancello della conferma (`me_service.elimina_account`)
e l'ordine dei due passi — cascata su `public.utente` con l'identità
dell'utente, poi Auth Admin API con la chiave di servizio.

Stesso doppio livello di test_metriche.py/test_consenso.py:
- Router: isolato sia dalla verifica JWT (dependency override) sia dal
  service (`me_service.elimina_account` monkeypatchato).
- Servizio: `me_service.elimina_account` esercitato per davvero, con
  `utente_repository` e `get_service_client` monkeypatchati (nessuna
  rete/Supabase).
"""

import asyncio
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import utente_repository
from app.schemas.auth import AuthenticatedUser
from app.services import me_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


# --- Router: DELETE /me -------------------------------------------------


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


def test_delete_me_restituisce_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(access_token: str, utente_id: UUID, conferma_nome_utente: str) -> None:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert conferma_nome_utente == "prova"

    monkeypatch.setattr(me_service, "elimina_account", _fake)

    response = authenticated.request("DELETE", "/me", json={"conferma_nome_utente": "prova"})

    assert response.status_code == 204


def test_delete_me_conto_assente_restituisce_404(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(access_token: str, utente_id: UUID, conferma_nome_utente: str) -> None:
        raise me_service.ContoNonTrovatoError

    monkeypatch.setattr(me_service, "elimina_account", _fake)

    response = authenticated.request("DELETE", "/me", json={"conferma_nome_utente": "prova"})

    assert response.status_code == 404


def test_delete_me_conferma_sbagliata_restituisce_400(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(access_token: str, utente_id: UUID, conferma_nome_utente: str) -> None:
        raise me_service.ConfermaNonCorrispondenteError

    monkeypatch.setattr(me_service, "elimina_account", _fake)

    response = authenticated.request("DELETE", "/me", json={"conferma_nome_utente": "sbagliato"})

    assert response.status_code == 400
    assert response.json()["detail"]["error_code"] == "conferma_non_corrispondente"


def test_delete_me_conferma_vuota_restituisce_422(authenticated: TestClient) -> None:
    response = authenticated.request("DELETE", "/me", json={"conferma_nome_utente": "  "})

    assert response.status_code == 422


# --- Servizio -------------------------------------------------------------


class _AdminFinto:
    def __init__(self, solleva: bool = False) -> None:
        self.chiamate: list[str] = []
        self._solleva = solleva

    def delete_user(self, utente_id: str) -> None:
        self.chiamate.append(utente_id)
        if self._solleva:
            raise RuntimeError("Auth Admin API non raggiungibile")


class _ServiceClientFinto:
    """`client.auth.admin.delete_user(...)`: `.auth` porta un `.admin`,
    non è esso stesso l'oggetto admin."""

    def __init__(self, admin: _AdminFinto) -> None:
        self.auth = SimpleNamespace(admin=admin)


@pytest.fixture
def stato(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    finto: dict[str, Any] = {
        "utente": {"id": str(_USER_ID), "nome_utente": "prova"},
        "cancellazioni": [],
        "admin": _AdminFinto(),
    }

    monkeypatch.setattr(me_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(
        me_service, "get_service_client", lambda: _ServiceClientFinto(finto["admin"])
    )

    def _get_utente(client: Any, utente_id: UUID) -> dict[str, Any] | None:
        return finto["utente"]

    def _delete_utente(client: Any, utente_id: UUID) -> bool:
        finto["cancellazioni"].append(utente_id)
        return True

    monkeypatch.setattr(utente_repository, "get_utente", _get_utente)
    monkeypatch.setattr(utente_repository, "delete_utente", _delete_utente)
    return finto


def test_elimina_account_conferma_sbagliata_non_cancella_nulla(stato: dict[str, Any]) -> None:
    with pytest.raises(me_service.ConfermaNonCorrispondenteError):
        _run(me_service.elimina_account("t", _USER_ID, "non-e-prova"))

    assert stato["cancellazioni"] == []
    assert stato["admin"].chiamate == []


def test_elimina_account_conto_assente(
    stato: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(utente_repository, "get_utente", lambda c, i: None)

    with pytest.raises(me_service.ContoNonTrovatoError):
        _run(me_service.elimina_account("t", _USER_ID, "prova"))

    assert stato["cancellazioni"] == []


def test_elimina_account_cancella_utente_poi_auth_users(stato: dict[str, Any]) -> None:
    _run(me_service.elimina_account("t", _USER_ID, "prova"))

    assert stato["cancellazioni"] == [_USER_ID]
    assert stato["admin"].chiamate == [str(_USER_ID)]


def test_elimina_account_non_solleva_se_admin_api_fallisce(
    stato: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """I dati applicativi sono già cancellati al passo 1: un fallimento
    dell'Admin API non deve far fallire l'intera operazione (AGENTS.md,
    gotcha documentato)."""
    admin_che_fallisce = _AdminFinto(solleva=True)
    monkeypatch.setattr(
        me_service, "get_service_client", lambda: _ServiceClientFinto(admin_che_fallisce)
    )

    _run(me_service.elimina_account("t", _USER_ID, "prova"))

    assert stato["cancellazioni"] == [_USER_ID]
    assert admin_che_fallisce.chiamate == [str(_USER_ID)]
