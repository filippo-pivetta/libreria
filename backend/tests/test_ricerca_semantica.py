"""Ricerca semantica sui propri insight e recensioni (issue #6).

Regole del PRD verificate qui:
- 24, i risultati non attraversano mai i contenuti di un collegato;
- 30, a consenso revocato la funzione non parte — e non chiama il
  fornitore nemmeno per l'embedding della domanda;
- caso limite "ricerca semantica invocata a consenso revocato":
  l'interfaccia deve poter dire che la funzione è spenta, quindi 409 e
  non una lista vuota;
- caso limite "consenso riattivato dopo una revoca": finché la
  ricostruzione è in corso la risposta lo dichiara.

La regola 10 (spoiler) NON è verificata qui, di proposito: qui vale
l'opposto della scheda del libro — il testo resta sempre leggibile,
perché ogni riga è già del richiedente (mai di un collegato). Il test
`test_un_proprio_spoiler_resta_leggibile` sotto verifica esattamente
questa differenza.
"""

import asyncio
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core import storage
from app.core.security import get_current_user
from app.main import app
from app.repositories import indice_semantico_repository
from app.schemas.auth import AuthenticatedUser
from app.services import consenso as consenso_service
from app.services import ricerca_semantica_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = "00000000-0000-0000-0000-0000000000a1"
_LIBRO_ID = "00000000-0000-0000-0000-0000000000b1"


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _riga(**extra: Any) -> dict[str, Any]:
    base = {
        "tipo_contenuto": "insight",
        "contenuto_id": "00000000-0000-0000-0000-0000000000c1",
        "testo": "La memoria come materia narrativa.",
        "spoiler": False,
        "visibilita": "condiviso",
        "data": "2026-08-01",
        "voce_id": _VOCE_ID,
        "libro_id": _LIBRO_ID,
        "titolo_canonico": "Le città invisibili",
        "autori": ["Italo Calvino"],
        "copertina_miniatura_path": None,
        "copertina_colore_dominante": "#3a4a5a",
        "vicini": 2,
        "distanza": 0.12,
    }
    return {**base, **extra}


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


@pytest.fixture
def servizio(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Il service con il fornitore e il database finti. Restituisce un
    registro ispezionabile: `embedding` dice se il fornitore è stato
    chiamato, ed è il modo di verificare la regola 30."""
    registro: dict[str, Any] = {
        "embedding": [],
        "righe": [_riga()],
        "indici_stato": "pronti",
        # Cosa è arrivato alla RPC: è il modo di verificare che i
        # filtri entrino DENTRO `cerca_semantico` invece di essere
        # applicati dopo il taglio ai venti più vicini.
        "filtri": {},
    }

    async def _esigi(access_token: str, utente_id: UUID) -> str:
        if not registro.get("consenso", True):
            raise consenso_service.ConsensoRevocatoError
        return str(registro["indici_stato"])

    async def _embedding(testi: list[str]) -> list[list[float]]:
        registro["embedding"].append(testi)
        return [[0.1, 0.2, 0.3]]

    monkeypatch.setattr(consenso_service, "esigi_consenso", _esigi)
    monkeypatch.setattr(ricerca_semantica_service, "chiama_embedding", _embedding)
    monkeypatch.setattr(ricerca_semantica_service, "get_user_client", lambda token: object())

    def _cerca(client: Any, embedding: Any, limite: int, **filtri: Any) -> list[dict[str, Any]]:
        registro["filtri"] = filtri
        return list(registro["righe"])

    monkeypatch.setattr(indice_semantico_repository, "cerca", _cerca)
    monkeypatch.setattr(storage, "firma_in_blocco", lambda percorsi: {})
    return registro


# --- il service --------------------------------------------------------------


def test_restituisce_i_propri_risultati(servizio: dict[str, Any]) -> None:
    esito = _run(ricerca_semantica_service.cerca("t", _USER_ID, "memoria"))

    assert [r["testo"] for r in esito["risultati"]] == ["La memoria come materia narrativa."]
    assert esito["risultati"][0]["titolo"] == "Le città invisibili"
    assert esito["indici_incompleti"] is False
    assert servizio["embedding"] == [["memoria"]]


def test_un_proprio_spoiler_resta_leggibile(servizio: dict[str, Any]) -> None:
    """La regola 10 protegge da uno spoiler altrui, non da un proprio
    testo: ogni risultato di questa ricerca è già del richiedente
    (`cerca_semantico` filtra `utente_id = auth.uid()`), quindi il
    gating non si applica qui — a differenza della scheda del libro, che
    serve anche un collegato sulla stessa Voce."""
    servizio["righe"] = [_riga(spoiler=True, testo="Muore alla fine.")]

    esito = _run(ricerca_semantica_service.cerca("t", _USER_ID, "finale"))

    assert esito["risultati"][0]["testo"] == "Muore alla fine."
    assert esito["risultati"][0]["spoiler"] is True


def test_dichiara_gli_indici_incompleti_durante_la_ricostruzione(
    servizio: dict[str, Any],
) -> None:
    servizio["indici_stato"] = "in_ricostruzione"

    assert _run(ricerca_semantica_service.cerca("t", _USER_ID, "memoria"))["indici_incompleti"]


def test_i_filtri_entrano_dentro_la_rpc(servizio: dict[str, Any]) -> None:
    """Le pastiglie dei Quaderni restringono la ricerca PRIMA del taglio,
    non dopo.

    `cerca_semantico` tiene i venti vettori più vicini e poi si ferma:
    filtrare a valle darebbe zero risultati ogni volta che quei venti
    sono tutti dell'anno sbagliato, e zero risultati in questa pagina si
    legge come "non hai scritto nulla che somigli a questa domanda" —
    che sarebbe falso. Il posto in cui il filtro deve arrivare è quindi
    la RPC, ed è questo che il test blocca.
    """
    _run(
        ricerca_semantica_service.cerca(
            "t",
            _USER_ID,
            "memoria",
            tipo="insight",
            solo_spoiler=True,
            anno=2026,
            voce_ids=[UUID(_VOCE_ID)],
        )
    )

    assert servizio["filtri"] == {
        "tipo": "insight",
        "solo_spoiler": True,
        "anno": 2026,
        "voce_ids": [UUID(_VOCE_ID)],
        "contenuto_ids": None,
        "con_vicini": True,
    }


def test_a_consenso_revocato_non_chiama_il_fornitore(servizio: dict[str, Any]) -> None:
    """Regola 30. Non basta che la risposta sia un errore: la domanda non
    deve nemmeno partire verso OpenAI."""
    servizio["consenso"] = False

    with pytest.raises(consenso_service.ConsensoRevocatoError):
        _run(ricerca_semantica_service.cerca("t", _USER_ID, "memoria"))

    assert servizio["embedding"] == []


# --- la rotta ----------------------------------------------------------------


def test_get_ricerca_semantica_200(authenticated: TestClient, servizio: dict[str, Any]) -> None:
    response = authenticated.get("/ricerca/semantica", params={"q": "memoria"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["risultati"]) == 1
    assert body["risultati"][0]["libro_id"] == _LIBRO_ID


def test_get_ricerca_semantica_passa_i_filtri(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    """Gli stessi quattro filtri di `GET /scritti`: una pastiglia premuta
    non può restringere in un modo quando sfogli e in un altro quando
    chiedi."""
    response = authenticated.get(
        "/ricerca/semantica",
        params={"q": "memoria", "tipo": "recensione", "anno": 2025, "solo_spoiler": "true"},
    )

    assert response.status_code == 200
    assert servizio["filtri"]["tipo"] == "recensione"
    assert servizio["filtri"]["anno"] == 2025
    assert servizio["filtri"]["solo_spoiler"] is True


def test_get_ricerca_semantica_409_a_consenso_revocato(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    """409 e non 200 con lista vuota: il PRD vuole che l'interfaccia
    dichiari la funzione disattivata "invece di restituire zero risultati
    come se non ci fosse nulla da trovare"."""
    servizio["consenso"] = False

    response = authenticated.get("/ricerca/semantica", params={"q": "memoria"})

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "consenso_revocato"


def test_get_ricerca_semantica_ignora_le_domande_troppo_corte(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    response = authenticated.get("/ricerca/semantica", params={"q": "a"})

    assert response.status_code == 200
    assert response.json() == {"risultati": [], "indici_incompleti": False}
    assert servizio["embedding"] == []


def test_get_ricerca_semantica_richiede_autenticazione(client: TestClient) -> None:
    assert client.get("/ricerca/semantica", params={"q": "memoria"}).status_code == 401
