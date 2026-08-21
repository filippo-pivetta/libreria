"""Test per /voci: isolati sia dalla verifica JWT (dependency override)
sia da Supabase (voci_service monkeypatchato), stesso pattern di
test_me.py."""

from collections.abc import Iterator
from datetime import date
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import voci_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_LIBRO_ID = UUID("00000000-0000-0000-0000-0000000000b1")

_VOCE: dict[str, Any] = {
    "id": str(_VOCE_ID),
    "utente_id": str(_USER_ID),
    "libro_id": str(_LIBRO_ID),
    "stato": "da_leggere",
    "pagine_adottate": None,
    "voto": None,
    "nota_intenzione": None,
    "creato_at": "2026-08-20T00:00:00Z",
    "aggiornato_at": "2026-08-20T00:00:00Z",
}

_LIBRO: dict[str, Any] = {
    "id": str(_LIBRO_ID),
    "titolo_canonico": "Prova",
    "anno_prima_pubblicazione": 1980,
    "anno_dedotto": False,
    "lingua_originale": "it",
    "lingua_dedotta": False,
    "generi": [{"id": "literary_fiction", "etichetta": "Narrativa contemporanea"}],
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
    "autori": [{"id": "00000000-0000-0000-0000-0000000000a9", "nome_canonico": "Autrice Prova"}],
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


# --- GET /voci ---------------------------------------------------------


def test_get_voci_returns_list(authenticated: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_elenco(access_token: str, utente_id: UUID) -> list[dict[str, Any]]:
        assert access_token == "test-token"
        # Il router passa esplicitamente l'id di chi chiama al service
        # (issue #3, fix del bug latente: GET /voci non deve mai
        # mescolare la propria libreria con quella di un collegato).
        assert utente_id == _USER_ID
        return [{**_VOCE, "libro": _LIBRO}]

    monkeypatch.setattr(voci_service, "elenco_libreria", _fake_elenco)

    response = authenticated.get("/voci")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["libro"]["titolo_canonico"] == "Prova"


def test_get_voci_requires_authentication(client: TestClient) -> None:
    response = client.get("/voci")

    assert response.status_code == 401


# --- POST /voci ----------------------------------------------------------


def test_post_voci_creates_new_returns_201(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_aggiungi(
        access_token: str, utente_id: UUID, libro_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert libro_id == _LIBRO_ID
        return _VOCE, False

    monkeypatch.setattr(voci_service, "aggiungi_libro", _fake_aggiungi)

    response = authenticated.post("/voci", json={"libro_id": str(_LIBRO_ID)})

    assert response.status_code == 201
    body = response.json()
    assert body["already_existed"] is False
    assert body["voce"]["id"] == str(_VOCE_ID)


def test_post_voci_returns_200_when_already_existing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_aggiungi(
        access_token: str, utente_id: UUID, libro_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        return _VOCE, True

    monkeypatch.setattr(voci_service, "aggiungi_libro", _fake_aggiungi)

    response = authenticated.post("/voci", json={"libro_id": str(_LIBRO_ID)})

    assert response.status_code == 200
    assert response.json()["already_existed"] is True


def test_post_voci_returns_404_on_libro_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_aggiungi(
        access_token: str, utente_id: UUID, libro_id: UUID
    ) -> tuple[dict[str, Any], bool]:
        raise voci_service.LibroInesistenteError

    monkeypatch.setattr(voci_service, "aggiungi_libro", _fake_aggiungi)

    response = authenticated.post("/voci", json={"libro_id": str(_LIBRO_ID)})

    assert response.status_code == 404
    assert response.json()["detail"]["error_code"] == "libro_inesistente"


def test_post_voci_requires_authentication(client: TestClient) -> None:
    response = client.post("/voci", json={"libro_id": str(_LIBRO_ID)})

    assert response.status_code == 401


# --- GET /voci/{id} ------------------------------------------------------


def test_get_voce_returns_detail(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_dettaglio(access_token: str, voce_id: UUID) -> dict[str, Any] | None:
        assert voce_id == _VOCE_ID
        return {
            **_VOCE,
            "libro": _LIBRO,
            "letture": [
                {
                    "id": "00000000-0000-0000-0000-0000000000c1",
                    "data_inizio": "2026-08-15",
                    "data_fine": None,
                    "esito": None,
                    "avanzamenti": [
                        {
                            "id": "00000000-0000-0000-0000-0000000000d1",
                            "pagina": 40,
                            "data": "2026-08-16",
                            "generato_automaticamente": False,
                        }
                    ],
                }
            ],
        }

    monkeypatch.setattr(voci_service, "dettaglio", _fake_dettaglio)

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(_VOCE_ID)
    assert len(body["letture"]) == 1
    assert body["letture"][0]["avanzamenti"][0]["pagina"] == 40


def test_get_voce_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_dettaglio(access_token: str, voce_id: UUID) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(voci_service, "dettaglio", _fake_dettaglio)

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 404


def test_get_voce_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 401


# --- PATCH /voci/{id}/stato -----------------------------------------------


def test_patch_stato_returns_updated_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str, voce_id: UUID, nuovo_stato: str, data: date | None
    ) -> dict[str, Any]:
        assert voce_id == _VOCE_ID
        assert nuovo_stato == "in_lettura"
        assert data is None
        return {**_VOCE, "stato": "in_lettura"}

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "in_lettura"})

    assert response.status_code == 200
    assert response.json()["stato"] == "in_lettura"


def test_patch_stato_returns_404_when_voce_not_found(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str, voce_id: UUID, nuovo_stato: str, data: date | None
    ) -> dict[str, Any]:
        raise voci_service.VoceNonTrovataError

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "in_lettura"})

    assert response.status_code == 404


def test_patch_stato_returns_409_on_transizione_non_ammessa(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str, voce_id: UUID, nuovo_stato: str, data: date | None
    ) -> dict[str, Any]:
        raise voci_service.TransizioneNonAmmessaError

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "letto"})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "transizione_stato_non_ammessa"


def test_patch_stato_returns_409_on_chiusura_precede_ultimo_avanzamento(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str, voce_id: UUID, nuovo_stato: str, data: date | None
    ) -> dict[str, Any]:
        raise voci_service.ChiusuraPrecedeUltimoAvanzamentoError

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/stato", json={"stato": "letto", "data": "2020-01-01"}
    )

    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["error_code"] == "lettura_chiusura_precede_ultimo_avanzamento"


def test_patch_stato_rejects_invalid_stato_value(authenticated: TestClient) -> None:
    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "non_esiste"})

    assert response.status_code == 422


def test_patch_stato_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "in_lettura"})

    assert response.status_code == 401


# --- PATCH /voci/{id}/pagine-adottate -------------------------------------


def test_patch_pagine_adottate_returns_updated_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, pagine_adottate: int | None
    ) -> dict[str, Any] | None:
        assert pagine_adottate == 320
        return {**_VOCE, "pagine_adottate": 320}

    monkeypatch.setattr(voci_service, "correggi_pagine", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/pagine-adottate", json={"pagine_adottate": 320}
    )

    assert response.status_code == 200
    assert response.json()["pagine_adottate"] == 320


def test_patch_pagine_adottate_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, pagine_adottate: int | None
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(voci_service, "correggi_pagine", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/pagine-adottate", json={"pagine_adottate": 320}
    )

    assert response.status_code == 404


def test_patch_pagine_adottate_returns_409_below_existing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, pagine_adottate: int | None
    ) -> dict[str, Any] | None:
        raise voci_service.PagineSottoAvanzamentoEsistenteError

    monkeypatch.setattr(voci_service, "correggi_pagine", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/pagine-adottate", json={"pagine_adottate": 10}
    )

    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["error_code"] == "pagine_adottate_sotto_avanzamento_esistente"


def test_patch_pagine_adottate_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/voci/{_VOCE_ID}/pagine-adottate", json={"pagine_adottate": 10})

    assert response.status_code == 401


# --- PATCH /voci/{id}/voto -------------------------------------------------


def test_patch_voto_returns_updated_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, voto: float | None
    ) -> dict[str, Any] | None:
        assert voto == 4
        return {**_VOCE, "voto": 4}

    monkeypatch.setattr(voci_service, "correggi_voto", _fake_correggi)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 4})

    assert response.status_code == 200
    assert response.json()["voto"] == 4


def test_patch_voto_accepts_null_to_clear(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, voto: float | None
    ) -> dict[str, Any] | None:
        assert voto is None
        return {**_VOCE, "voto": None}

    monkeypatch.setattr(voci_service, "correggi_voto", _fake_correggi)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": None})

    assert response.status_code == 200
    assert response.json()["voto"] is None


def test_patch_voto_rejects_out_of_range(authenticated: TestClient) -> None:
    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 6})

    assert response.status_code == 422


def test_patch_voto_accepts_half_star(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, voto: float | None
    ) -> dict[str, Any] | None:
        assert voto == 3.5
        return {**_VOCE, "voto": 3.5}

    monkeypatch.setattr(voci_service, "correggi_voto", _fake_correggi)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 3.5})

    assert response.status_code == 200
    assert response.json()["voto"] == 3.5


def test_patch_voto_rejects_non_half_star(authenticated: TestClient) -> None:
    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 3.3})

    assert response.status_code == 422


def test_patch_voto_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, voce_id: UUID, voto: float | None
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(voci_service, "correggi_voto", _fake_correggi)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 4})

    assert response.status_code == 404


def test_patch_voto_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/voci/{_VOCE_ID}/voto", json={"voto": 4})

    assert response.status_code == 401


# --- PATCH /voci/{id}/nota-intenzione --------------------------------------


def test_patch_nota_intenzione_returns_updated_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, utente_id: UUID, voce_id: UUID, nota_intenzione: str | None
    ) -> dict[str, Any] | None:
        assert utente_id == _USER_ID
        assert nota_intenzione == "Consigliato da Giulia."
        return {**_VOCE, "nota_intenzione": "Consigliato da Giulia."}

    monkeypatch.setattr(voci_service, "correggi_nota_intenzione", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/nota-intenzione", json={"nota_intenzione": "Consigliato da Giulia."}
    )

    assert response.status_code == 200
    assert response.json()["nota_intenzione"] == "Consigliato da Giulia."


def test_patch_nota_intenzione_accepts_null_to_clear(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, utente_id: UUID, voce_id: UUID, nota_intenzione: str | None
    ) -> dict[str, Any] | None:
        assert nota_intenzione is None
        return {**_VOCE, "nota_intenzione": None}

    monkeypatch.setattr(voci_service, "correggi_nota_intenzione", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/nota-intenzione", json={"nota_intenzione": None}
    )

    assert response.status_code == 200
    assert response.json()["nota_intenzione"] is None


def test_patch_nota_intenzione_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str, utente_id: UUID, voce_id: UUID, nota_intenzione: str | None
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(voci_service, "correggi_nota_intenzione", _fake_correggi)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/nota-intenzione", json={"nota_intenzione": "x"}
    )

    assert response.status_code == 404


def test_patch_nota_intenzione_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/voci/{_VOCE_ID}/nota-intenzione", json={"nota_intenzione": "x"})

    assert response.status_code == 401
