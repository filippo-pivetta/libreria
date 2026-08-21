"""Route di /ricerca e POST /libri (pattern di tests/test_voci.py:
dependency override sull'identità, service monkeypatchato).

Il caso che conta più di tutti è la distinzione dei tre stati: nessun
risultato, fonte irraggiungibile, e caricamento. Se il back end non li
distingue il frontend non può inventarli, e chi cerca conclude che il
libro non esiste mentre è solo il catalogo che non risponde
(docs/design-frontend.md §13).
"""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import ricerca_service

_USER_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_LIBRO_ID = UUID("00000000-0000-0000-0000-0000000000b1")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000c1")

_LOCALE: dict[str, Any] = {
    "libro_id": str(_LIBRO_ID),
    "titolo": "Le città invisibili",
    "autori": ["Italo Calvino"],
    "anno_prima_pubblicazione": 1972,
    "copertina_url": None,
    "copertina_colore_dominante": None,
    "copertina_stato": "assente",
    "voce": None,
}

_ESTERNO: dict[str, Any] = {
    "volume_id": "abc123",
    "volumi_alternativi": ["def456"],
    "titolo": "Il nome della rosa",
    "autori": ["Umberto Eco"],
    "anno_pubblicazione": 2019,
    "copertina_url": "https://books.google.com/x",
    "libro_id": None,
    "voce": None,
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


# --- GET /ricerca/catalogo --------------------------------------------------


def test_ricerca_locale_restituisce_le_schede_del_sistema(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(
        access_token: str, termine: str, lingua: str = "it", limite: int = 20
    ) -> list[dict[str, Any]]:
        assert access_token == "test-token"
        assert termine == "calvino"
        return [_LOCALE]

    monkeypatch.setattr(ricerca_service, "cerca_locale", _fake)

    risposta = authenticated.get("/ricerca/catalogo", params={"q": "calvino"})

    assert risposta.status_code == 200
    assert risposta.json()[0]["titolo"] == "Le città invisibili"


def test_il_termine_viene_ripulito_dagli_spazi(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(
        access_token: str, termine: str, lingua: str = "it", limite: int = 20
    ) -> list[dict[str, Any]]:
        assert termine == "calvino"
        return []

    monkeypatch.setattr(ricerca_service, "cerca_locale", _fake)
    assert authenticated.get("/ricerca/catalogo", params={"q": "  calvino  "}).status_code == 200


def test_un_termine_troppo_corto_non_interroga_nulla(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "il" non deve costare una chiamata a un catalogo esterno."""

    async def _mai_chiamata(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        raise AssertionError("non doveva interrogare nulla")

    monkeypatch.setattr(ricerca_service, "cerca_locale", _mai_chiamata)
    monkeypatch.setattr(ricerca_service, "cerca_esterna", _mai_chiamata)

    assert authenticated.get("/ricerca/catalogo", params={"q": "i"}).json() == []
    assert authenticated.get("/ricerca/cataloghi", params={"q": "i"}).json() == []


def test_ricerca_locale_requires_authentication(client: TestClient) -> None:
    assert client.get("/ricerca/catalogo", params={"q": "calvino"}).status_code == 401


# --- GET /ricerca/cataloghi -------------------------------------------------


def test_ricerca_esterna_restituisce_le_opere(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(
        access_token: str, utente_id: UUID, termine: str, limite: int = 20
    ) -> list[dict[str, Any]]:
        assert utente_id == _USER_ID
        return [_ESTERNO]

    monkeypatch.setattr(ricerca_service, "cerca_esterna", _fake)

    corpo = authenticated.get("/ricerca/cataloghi", params={"q": "il nome della rosa"}).json()

    assert corpo[0]["volume_id"] == "abc123"
    # Gli alternativi tornano indietro all'aggiunta: più ISBN da provare
    # significa più probabilità che l'identità dell'opera si chiuda.
    assert corpo[0]["volumi_alternativi"] == ["def456"]


def test_nessun_risultato_e_una_lista_vuota_non_un_errore(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La fonte ha risposto e non ha nulla: 200. È lo stato "vicolo cieco"
    del design §13, e va distinto dal successivo."""

    async def _fake(
        access_token: str, utente_id: UUID, termine: str, limite: int = 20
    ) -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr(ricerca_service, "cerca_esterna", _fake)
    risposta = authenticated.get("/ricerca/cataloghi", params={"q": "zzzzqqq"})

    assert risposta.status_code == 200
    assert risposta.json() == []


def test_fonte_irraggiungibile_e_uno_stato_distinto_da_nessun_risultato(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """503 con un error_code riconoscibile, mai 500 e mai 200 vuoto: senza
    questa distinzione chi cerca conclude che il libro non esiste mentre è
    solo il catalogo che non risponde."""

    async def _fake(
        access_token: str, utente_id: UUID, termine: str, limite: int = 20
    ) -> list[dict[str, Any]]:
        raise FonteNonRaggiungibileError("google_books", "quota esaurita")

    monkeypatch.setattr(ricerca_service, "cerca_esterna", _fake)
    risposta = authenticated.get("/ricerca/cataloghi", params={"q": "qualcosa"})

    assert risposta.status_code == 503
    assert risposta.json()["detail"]["error_code"] == "fonte_irraggiungibile"


def test_ricerca_esterna_requires_authentication(client: TestClient) -> None:
    assert client.get("/ricerca/cataloghi", params={"q": "calvino"}).status_code == 401


# --- POST /libri ------------------------------------------------------------


def test_aggiunta_da_catalogo_crea_la_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(
        access_token: str, utente_id: UUID, volume_id: str, alternativi: list[str]
    ) -> tuple[UUID, dict[str, Any], bool]:
        assert volume_id == "abc123"
        assert alternativi == ["def456"]
        return _LIBRO_ID, {"id": str(_VOCE_ID)}, False

    monkeypatch.setattr(ricerca_service, "aggiungi_da_catalogo", _fake)

    risposta = authenticated.post(
        "/libri", json={"volume_id": "abc123", "volumi_alternativi": ["def456"]}
    )

    assert risposta.status_code == 201
    assert risposta.json()["gia_in_libreria"] is False


def test_una_voce_gia_esistente_non_viene_duplicata(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PRD comportamento #3: "Se il Libro è già in libreria, l'app non lo
    duplica". 200 e non 201, perché non è stato scritto nulla."""

    async def _fake(
        access_token: str, utente_id: UUID, volume_id: str, alternativi: list[str]
    ) -> tuple[UUID, dict[str, Any], bool]:
        return _LIBRO_ID, {"id": str(_VOCE_ID)}, True

    monkeypatch.setattr(ricerca_service, "aggiungi_da_catalogo", _fake)
    risposta = authenticated.post("/libri", json={"volume_id": "abc123"})

    assert risposta.status_code == 200
    assert risposta.json()["gia_in_libreria"] is True


def test_un_risultato_scaduto_lo_dice_invece_di_fallire_oscuramente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La ricerca lasciata aperta oltre la durata della cache: senza il
    termine originale non c'è modo di ritrovare quel volume, e l'unica
    cosa onesta è chiedere di rifare la ricerca."""

    async def _fake(
        access_token: str, utente_id: UUID, volume_id: str, alternativi: list[str]
    ) -> tuple[UUID, dict[str, Any], bool]:
        raise ricerca_service.VolumeInesistenteError(volume_id)

    monkeypatch.setattr(ricerca_service, "aggiungi_da_catalogo", _fake)
    risposta = authenticated.post("/libri", json={"volume_id": "scaduto"})

    assert risposta.status_code == 409
    assert risposta.json()["detail"]["error_code"] == "risultato_scaduto"


def test_nessun_id_utente_nel_corpo_della_richiesta(authenticated: TestClient) -> None:
    """AGENTS.md: nessun modello di input contiene id, user_id o campi di
    ruolo. Un campo in più viene ignorato, non accettato."""
    from app.schemas.ricerca import AggiungiDaCatalogoRequest

    assert "utente_id" not in AggiungiDaCatalogoRequest.model_fields
    assert "libro_id" not in AggiungiDaCatalogoRequest.model_fields


def test_aggiunta_requires_authentication(client: TestClient) -> None:
    assert client.post("/libri", json={"volume_id": "abc123"}).status_code == 401
