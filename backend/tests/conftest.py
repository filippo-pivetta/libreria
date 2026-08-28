"""Bootstrap dei test: valorizza le variabili d'ambiente richieste da
Settings PRIMA di importare l'app, cosi che la suite giri senza un file
.env reale ne' un progetto Supabase raggiungibile.
"""

import os

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:54322/postgres")

# Il worker dei lavori in secondo piano non deve mai partire nella suite:
# tenterebbe di connettersi a un database che i test non hanno. Oggi
# basterebbe il fatto che `TestClient(app)` non esegue il lifespan se non
# usato come context manager, ma è una protezione accidentale: il primo
# `with TestClient(app)` scritto per un test futuro la farebbe cadere
# senza che nulla lo segnali.
os.environ.setdefault("WORKER_ABILITATO", "false")

import time  # noqa: E402
from collections.abc import Iterator  # noqa: E402
from types import SimpleNamespace  # noqa: E402
from typing import Any  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.cataloghi import trasporto  # noqa: E402
from app.core import security  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

_TEST_KID = "test-kid"


@pytest.fixture(autouse=True)
def _clienti_http_puliti() -> Iterator[None]:
    """I client verso le fonti esterne sono condivisi per tutto il
    processo (app/cataloghi/trasporto.py): senza questa pulizia, il primo
    test che ne costruisce uno col proprio `MockTransport` lo lascerebbe
    in piedi per tutti quelli dopo, che si vedrebbero rispondere dal
    doppio del caso precedente.

    Autouse e non a richiesta: dimenticarla in un test nuovo non lo farebbe
    fallire, farebbe fallire un altro test — il modo peggiore in cui una
    suite possa rompersi."""
    trasporto.dimentica()
    yield
    trasporto.dimentica()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def es256_keypair() -> tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
    """Coppia di chiavi ES256 generata al volo, mai le chiavi reali del
    progetto: i test di verifica JWT non devono dipendere da una rete o da
    un'istanza Supabase raggiungibile."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key()


@pytest.fixture
def patch_jwks(
    monkeypatch: pytest.MonkeyPatch,
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> Iterator[None]:
    """Sostituisce il client JWKS con uno che restituisce direttamente la
    chiave pubblica di test, cosi che `get_current_user` eserciti la vera
    logica di `jwt.decode` (firma/issuer/audience/scadenza) senza alcuna
    chiamata di rete."""
    _, public_key = es256_keypair
    signing_key = SimpleNamespace(key=public_key, algorithm_name="ES256")
    fake_client = SimpleNamespace(get_signing_key_from_jwt=lambda token: signing_key)
    monkeypatch.setattr(security, "_jwks_client", lambda: fake_client)
    yield


@pytest.fixture
def make_access_token(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> Any:
    """Firma un JWT di sessione con la chiave privata di test, con claim
    di default coerenti con un token reale emesso da GoTrue (verificati
    empiricamente su un'istanza Supabase locale: iss = SUPABASE_URL +
    "/auth/v1", aud = "authenticated")."""
    private_key, _ = es256_keypair
    settings = get_settings()

    def _make(sub: str, **overrides: Any) -> str:
        now = int(time.time())
        claims: dict[str, Any] = {
            "iss": settings.jwt_issuer,
            "sub": sub,
            "aud": "authenticated",
            "role": "authenticated",
            "iat": now,
            "exp": now + 3600,
            **overrides,
        }
        return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": _TEST_KID})

    return _make
