"""Test per il gestore globale delle eccezioni non gestite (issue #11):
verifica che un'eccezione imprevista in un servizio — non una
HTTPException esplicita — torni comunque una risposta 500 stabile, mai
un traceback o un dettaglio interno.
"""

from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from test_me import authenticated  # noqa: F401  (fixture riusata)

from app.core.exception_handlers import MESSAGGIO_GENERICO
from app.main import app
from app.services import me_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.mark.usefixtures("authenticated")
def test_unhandled_exception_returns_generic_500(monkeypatch: pytest.MonkeyPatch) -> None:
    # La fixture "authenticated" (di test_me.py, riusata per nome tramite
    # usefixtures — non come parametro, per non entrare in conflitto con
    # l'import sopra) serve solo per il suo effetto collaterale
    # (dependency_overrides su `app`, valido per qualunque client); la
    # richiesta vera parte da un client dedicato con
    # raise_server_exceptions=False, per ricevere la risposta HTTP che
    # arriverebbe a un client reale invece di far esplodere il test con
    # l'eccezione originale.
    async def _fake_get_me(access_token: str, utente_id: UUID) -> dict[str, Any]:
        raise RuntimeError("dettaglio interno che non deve mai arrivare al client")

    monkeypatch.setattr(me_service, "get_me", _fake_get_me)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/me")

    assert response.status_code == 500
    body = response.json()
    assert body == {"detail": MESSAGGIO_GENERICO}
    assert "RuntimeError" not in response.text
    assert "dettaglio interno" not in response.text
