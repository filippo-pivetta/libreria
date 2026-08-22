"""Test per /voci/{id}/insight e /insight/{id}: isolati sia dalla verifica
JWT (dependency override) sia da Supabase (insight_service monkeypatchato),
stesso pattern di test_voci.py."""

import asyncio
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import insight_repository
from app.schemas.auth import AuthenticatedUser
from app.services import insight_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_INSIGHT_ID = UUID("00000000-0000-0000-0000-0000000000f1")
_LETTURA_APERTA_ID = UUID("00000000-0000-0000-0000-0000000000c1")

_INSIGHT: dict[str, Any] = {
    "id": str(_INSIGHT_ID),
    "voce_id": str(_VOCE_ID),
    "lettura_id": str(_LETTURA_APERTA_ID),
    "testo": "Uno stile secco, quasi giornalistico.",
    "spoiler": False,
    "visibilita": "condiviso",
    "data": "2026-08-16",
    "creato_at": "2026-08-16T00:00:00Z",
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


# --- POST /voci/{id}/insight -------------------------------------------


def test_post_insight_returns_201_with_defaults(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_crea(
        access_token: str,
        utente_id: UUID,
        voce_id: UUID,
        testo: str,
        spoiler: bool,
        visibilita: str,
    ) -> dict[str, Any]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert voce_id == _VOCE_ID
        assert testo == "Prima impressione."
        # PRD: condiviso e non-spoiler sono i due default.
        assert spoiler is False
        assert visibilita == "condiviso"
        return {**_INSIGHT, "testo": "Prima impressione."}

    monkeypatch.setattr(insight_service, "crea", _fake_crea)

    response = authenticated.post(f"/voci/{_VOCE_ID}/insight", json={"testo": "Prima impressione."})

    assert response.status_code == 201
    assert response.json()["testo"] == "Prima impressione."


def test_post_insight_accepts_explicit_spoiler_e_visibilita(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_crea(
        access_token: str,
        utente_id: UUID,
        voce_id: UUID,
        testo: str,
        spoiler: bool,
        visibilita: str,
    ) -> dict[str, Any]:
        assert spoiler is True
        assert visibilita == "privato"
        return {**_INSIGHT, "spoiler": True, "visibilita": "privato"}

    monkeypatch.setattr(insight_service, "crea", _fake_crea)

    response = authenticated.post(
        f"/voci/{_VOCE_ID}/insight",
        json={"testo": "x", "spoiler": True, "visibilita": "privato"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["spoiler"] is True
    assert body["visibilita"] == "privato"


def test_post_insight_ignora_un_lettura_id_nel_body(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Nessun campo `lettura_id` in ingresso (AGENTS.md: nessun id assegnato
    dal client): il server lo deduce dalla Lettura aperta corrente. Un
    corpo che lo include comunque non viene rifiutato (Pydantic scarta i
    campi extra in silenzio) — la richiesta resta valida, il valore
    aggiuntivo semplicemente non raggiunge il service."""

    async def _fake_crea(
        access_token: str,
        utente_id: UUID,
        voce_id: UUID,
        testo: str,
        spoiler: bool,
        visibilita: str,
    ) -> dict[str, Any]:
        return _INSIGHT

    monkeypatch.setattr(insight_service, "crea", _fake_crea)

    response = authenticated.post(
        f"/voci/{_VOCE_ID}/insight", json={"testo": "x", "lettura_id": str(_LETTURA_APERTA_ID)}
    )

    assert response.status_code == 201


def test_post_insight_returns_404_su_voce_altrui_o_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_crea(
        access_token: str,
        utente_id: UUID,
        voce_id: UUID,
        testo: str,
        spoiler: bool,
        visibilita: str,
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(insight_service, "crea", _fake_crea)

    response = authenticated.post(f"/voci/{_VOCE_ID}/insight", json={"testo": "x"})

    assert response.status_code == 404


def test_post_insight_requires_authentication(client: TestClient) -> None:
    response = client.post(f"/voci/{_VOCE_ID}/insight", json={"testo": "x"})

    assert response.status_code == 401


# --- PATCH /insight/{id} -------------------------------------------------


def test_patch_insight_returns_updated_insight(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str,
        utente_id: UUID,
        insight_id: UUID,
        testo: str | None,
        spoiler: bool | None,
        visibilita: str | None,
    ) -> dict[str, Any]:
        assert insight_id == _INSIGHT_ID
        assert testo is None
        assert spoiler is True
        assert visibilita is None
        return {**_INSIGHT, "spoiler": True}

    monkeypatch.setattr(insight_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/insight/{_INSIGHT_ID}", json={"spoiler": True})

    assert response.status_code == 200
    assert response.json()["spoiler"] is True


def test_patch_insight_effetto_immediato_sulla_visibilita(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 9 (PRD): un cambio di visibilità ha effetto immediato. A
    livello di service non c'è coda né ritardo — un solo UPDATE sincrono
    per chiamata — quindi la risposta della stessa richiesta riflette già
    il nuovo valore."""

    async def _fake_correggi(
        access_token: str,
        utente_id: UUID,
        insight_id: UUID,
        testo: str | None,
        spoiler: bool | None,
        visibilita: str | None,
    ) -> dict[str, Any]:
        assert visibilita == "privato"
        return {**_INSIGHT, "visibilita": "privato"}

    monkeypatch.setattr(insight_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/insight/{_INSIGHT_ID}", json={"visibilita": "privato"})

    assert response.json()["visibilita"] == "privato"


def test_patch_insight_toggle_rapido_converge_sull_ultimo_valore(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Caso limite del PRD: "Insight reso privato e poi di nuovo condiviso
    in rapida successione: stato finale deterministico". Due PATCH in
    sequenza sulla stessa mutazione mockata bastano a documentarlo: ogni
    chiamata è un solo UPDATE sincrono, quindi la seconda vince sempre
    senza bisogno di logica applicativa aggiuntiva (Postgres serializza gli
    UPDATE sulla stessa riga)."""
    stato = {"visibilita": "condiviso"}

    async def _fake_correggi(
        access_token: str,
        utente_id: UUID,
        insight_id: UUID,
        testo: str | None,
        spoiler: bool | None,
        visibilita: str | None,
    ) -> dict[str, Any]:
        if visibilita is not None:
            stato["visibilita"] = visibilita
        return {**_INSIGHT, **stato}

    monkeypatch.setattr(insight_service, "correggi", _fake_correggi)

    authenticated.patch(f"/insight/{_INSIGHT_ID}", json={"visibilita": "privato"})
    ultima = authenticated.patch(f"/insight/{_INSIGHT_ID}", json={"visibilita": "condiviso"})

    assert ultima.json()["visibilita"] == "condiviso"


def test_patch_insight_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_correggi(
        access_token: str,
        utente_id: UUID,
        insight_id: UUID,
        testo: str | None,
        spoiler: bool | None,
        visibilita: str | None,
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(insight_service, "correggi", _fake_correggi)

    response = authenticated.patch(f"/insight/{_INSIGHT_ID}", json={"testo": "x"})

    assert response.status_code == 404


def test_patch_insight_requires_authentication(client: TestClient) -> None:
    response = client.patch(f"/insight/{_INSIGHT_ID}", json={"testo": "x"})

    assert response.status_code == 401


# --- DELETE /insight/{id} -------------------------------------------------


def test_delete_insight_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, insight_id: UUID) -> bool:
        assert insight_id == _INSIGHT_ID
        return True

    monkeypatch.setattr(insight_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/insight/{_INSIGHT_ID}")

    assert response.status_code == 204


def test_delete_insight_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, insight_id: UUID) -> bool:
        return False

    monkeypatch.setattr(insight_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/insight/{_INSIGHT_ID}")

    assert response.status_code == 404


def test_delete_insight_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/insight/{_INSIGHT_ID}")

    assert response.status_code == 401


# --- GET /insight/{id}/testo ----------------------------------------------


def test_get_insight_testo_rivela_il_contenuto_di_uno_spoiler(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_rivela(access_token: str, insight_id: UUID) -> str | None:
        assert insight_id == _INSIGHT_ID
        return "Il finale mi ha sorpreso."

    monkeypatch.setattr(insight_service, "rivela_testo", _fake_rivela)

    response = authenticated.get(f"/insight/{_INSIGHT_ID}/testo")

    assert response.status_code == 200
    assert response.json()["testo"] == "Il finale mi ha sorpreso."


def test_get_insight_testo_su_riga_non_visibile_restituisce_404(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 1/4 (PRD): un contenuto privato o di un utente non collegato
    non è mai restituito. La RLS nasconde la riga (nessun risultato dal
    repository), il service la vede come `None` e il router la mappa a 404,
    indistinguibile da "non esiste"."""

    async def _fake_rivela(access_token: str, insight_id: UUID) -> str | None:
        return None

    monkeypatch.setattr(insight_service, "rivela_testo", _fake_rivela)

    response = authenticated.get(f"/insight/{_INSIGHT_ID}/testo")

    assert response.status_code == 404


def test_get_insight_testo_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/insight/{_INSIGHT_ID}/testo")

    assert response.status_code == 401


# --- insight_service.raggruppati_per_lettura: gating spoiler, unità -------
#
# Test diretto della logica di composizione/gating (issue #5, regola 10),
# non solo del contratto HTTP: mocka il solo repository, lascia girare la
# vera funzione di servizio.


def _run(coro: Any) -> Any:
    """`asyncio.run`: pytest-asyncio non è tra le dipendenze [dev], stesso
    motivo di test_lavori_worker.py/test_llm.py."""
    return asyncio.run(coro)


def test_raggruppati_per_lettura_azzera_il_testo_degli_spoiler_per_un_collegato(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        insight_repository,
        "list_by_voce",
        lambda client, voce_id: [
            {**_INSIGHT, "spoiler": True, "testo": "segreto"},
            {**_INSIGHT, "id": "00000000-0000-0000-0000-0000000000f2", "spoiler": False},
        ],
    )

    per_lettura, senza_lettura = _run(
        insight_service.raggruppati_per_lettura(
            "test-token", _VOCE_ID, {_LETTURA_APERTA_ID}, is_owner=False
        )
    )

    assert senza_lettura == []
    righe = per_lettura[_LETTURA_APERTA_ID]
    spoiler = next(r for r in righe if r["spoiler"])
    non_spoiler = next(r for r in righe if not r["spoiler"])
    assert spoiler["testo"] is None
    assert non_spoiler["testo"] == "Uno stile secco, quasi giornalistico."


def test_raggruppati_per_lettura_lascia_il_testo_al_proprietario(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La regola 10 protegge da uno spoiler altrui, non da un proprio
    testo (issue #6): con `is_owner=True` nessuna riga viene tagliata,
    nemmeno quella marcata spoiler."""
    monkeypatch.setattr(
        insight_repository,
        "list_by_voce",
        lambda client, voce_id: [{**_INSIGHT, "spoiler": True, "testo": "segreto"}],
    )

    per_lettura, _ = _run(
        insight_service.raggruppati_per_lettura(
            "test-token", _VOCE_ID, {_LETTURA_APERTA_ID}, is_owner=True
        )
    )

    assert per_lettura[_LETTURA_APERTA_ID][0]["testo"] == "segreto"


def test_raggruppati_per_lettura_mette_gli_orfani_senza_lettura(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lettura_cancellata = UUID("00000000-0000-0000-0000-0000000000c9")
    monkeypatch.setattr(
        insight_repository,
        "list_by_voce",
        lambda client, voce_id: [
            {**_INSIGHT, "lettura_id": str(lettura_cancellata)},
            {**_INSIGHT, "id": "00000000-0000-0000-0000-0000000000f3", "lettura_id": None},
        ],
    )

    per_lettura, senza_lettura = _run(
        insight_service.raggruppati_per_lettura(
            "test-token", _VOCE_ID, {_LETTURA_APERTA_ID}, is_owner=False
        )
    )

    assert per_lettura == {}
    assert len(senza_lettura) == 2
