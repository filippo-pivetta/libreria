"""Test per /utenti: isolati sia dalla verifica JWT (dependency
override) sia da Supabase (utenti_service monkeypatchato), stesso
pattern di test_voci.py."""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import utenti_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_ALTRO_ID = UUID("00000000-0000-0000-0000-000000000002")

_MEMBRO: dict[str, Any] = {
    "id": str(_ALTRO_ID),
    "nome_utente": "altra_persona",
    "stato_relazione": "attiva",
    "richiesta_ricevuta": False,
}

_VOCE: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-0000000000a1",
    "utente_id": str(_ALTRO_ID),
    "libro_id": "00000000-0000-0000-0000-0000000000b1",
    "stato": "da_leggere",
    "pagine_adottate": None,
    "voto": None,
    "nota_intenzione": None,
    "creato_at": "2026-08-20T00:00:00Z",
    "aggiornato_at": "2026-08-20T00:00:00Z",
}

_LIBRO: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-0000000000b1",
    "titolo_canonico": "Prova",
    "anno_prima_pubblicazione": 1980,
    "anno_dedotto": False,
    "lingua_originale": "it",
    "lingua_dedotta": False,
    "generi": [],
    "descrizione": None,
    "descrizione_riformulata": False,
    # URL firmati e non percorsi interni: il bucket è privato (PRD regola
    # 6) e un percorso da solo non apre nulla. `copertina_stato` è ciò che
    # lo scaffale osserva mentre il recupero è in corso.
    "copertina_miniatura_url": None,
    "copertina_grande_url": None,
    "copertina_colore_dominante": None,
    "copertina_colore_dominante_scuro": None,
    "copertina_stato": "assente",
    "autori": [],
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


# --- GET /utenti -------------------------------------------------------


def test_get_utenti_returns_list_with_stato_relazione(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_elenco(access_token: str, self_id: UUID) -> list[dict[str, Any]]:
        assert access_token == "test-token"
        assert self_id == _USER_ID
        return [_MEMBRO]

    monkeypatch.setattr(utenti_service, "elenco_membri", _fake_elenco)

    response = authenticated.get("/utenti")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["stato_relazione"] == "attiva"
    assert body[0]["richiesta_ricevuta"] is False


def test_get_utenti_requires_authentication(client: TestClient) -> None:
    response = client.get("/utenti")

    assert response.status_code == 401


# --- GET /utenti/{id}/voci ----------------------------------------------


def test_get_utente_voci_returns_dettaglio_con_utente_e_voci(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID
    ) -> dict[str, Any]:
        assert utente_id == _ALTRO_ID
        return {
            "utente": {"id": str(_ALTRO_ID), "nome_utente": "altra_persona"},
            "voci": [{**_VOCE, "libro": _LIBRO}],
        }

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 200
    body = response.json()
    assert body["utente"]["nome_utente"] == "altra_persona"
    assert len(body["voci"]) == 1


def test_get_utente_voci_returns_404_when_utente_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID
    ) -> dict[str, Any]:
        raise utenti_service.UtenteInesistenteError

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 404


def test_get_utente_voci_returns_403_when_non_collegato(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID
    ) -> dict[str, Any]:
        raise utenti_service.NonCollegatoError

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "non_collegato"


def test_get_utente_voci_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 401
