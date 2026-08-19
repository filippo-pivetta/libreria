"""Verifica della dependency di autenticazione (app/core/security.py),
esercitata attraverso GET /me: `me_service.get_me` viene monkeypatchato
cosi da isolare il livello di verifica del token da Supabase.
"""

import time
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.core import security
from app.services import me_service

_PROFILE = {
    "id": "00000000-0000-0000-0000-000000000001",
    "nome_utente": "prova",
    "consenso_elaborazione_assistita": True,
    "consenso_aggiornato_at": "2026-08-18T00:00:00Z",
    "informativa_accettata_at": "2026-08-18T00:00:00Z",
}


@pytest.fixture(autouse=True)
def _stub_me_service(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_get_me(access_token: str, utente_id: Any) -> dict[str, Any]:
        return {**_PROFILE, "id": str(utente_id)}

    monkeypatch.setattr(me_service, "get_me", _fake_get_me)


def test_missing_token_returns_401(client: TestClient) -> None:
    response = client.get("/me")

    assert response.status_code == 401


def test_malformed_token_returns_401(client: TestClient, patch_jwks: None) -> None:
    response = client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 401


def test_wrong_signature_returns_401(
    client: TestClient,
    patch_jwks: None,
    make_access_token: Any,
) -> None:
    # Firmato con una chiave diversa da quella che il JWKS (patchato)
    # restituisce: la verifica della firma deve fallire.
    other_private_key = ec.generate_private_key(ec.SECP256R1())
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "http://127.0.0.1:54321/auth/v1",
            "sub": "00000000-0000-0000-0000-000000000001",
            "aud": "authenticated",
            "iat": now,
            "exp": now + 3600,
        },
        other_private_key,
        algorithm="ES256",
        headers={"kid": "test-kid"},
    )

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_expired_token_returns_401(
    client: TestClient, patch_jwks: None, make_access_token: Any
) -> None:
    now = int(time.time())
    token = make_access_token(
        "00000000-0000-0000-0000-000000000001", iat=now - 7200, exp=now - 3600
    )

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_wrong_audience_returns_401(
    client: TestClient, patch_jwks: None, make_access_token: Any
) -> None:
    token = make_access_token("00000000-0000-0000-0000-000000000001", aud="anon")

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_jwks_unreachable_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, make_access_token: Any
) -> None:
    def _raise_connection_error(token: str) -> None:
        raise jwt.PyJWKClientConnectionError("JWKS non raggiungibile")

    monkeypatch.setattr(
        security,
        "_jwks_client",
        lambda: SimpleNamespace(get_signing_key_from_jwt=_raise_connection_error),
    )
    token = make_access_token("00000000-0000-0000-0000-000000000001")

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 503


def test_valid_token_reaches_the_route(
    client: TestClient, patch_jwks: None, make_access_token: Any
) -> None:
    user_id = "11111111-1111-1111-1111-111111111111"
    token = make_access_token(user_id)

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["id"] == user_id
