"""Il corpus dei Quaderni e le sue lenti (design-frontend.md §22).

La regola che questi test difendono, e che è l'unica ragione per cui
questo endpoint esiste separato dagli altri quattro delle funzioni
assistite personali:

    ciò che l'Utente ha scritto ESISTE anche a consenso revocato, ed è
    solo il modo di interrogarlo che si spegne (§5).

Concretamente: `GET /scritti` e `GET /scritti/che-torna` non rispondono
mai 409 e non chiamano mai il fornitore, mentre
`GET /scritti/{id}/vicini` 409 come le altre — non per il costo (è
l'unica funzione assistita che non costa nulla: l'embedding è già in
tabella) ma perché la revoca cancella gli indici e non resta nulla da
confrontare.

L'altra regola bloccata qui riguarda il conteggio dei vicini: a indici
spenti dev'essere `None` e non `0`. Uno zero affermerebbe che quel
pensiero non ha compagnia, cosa che in quel momento nessuno è in grado
di sapere.
"""

import asyncio
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import scritto_repository
from app.schemas.auth import AuthenticatedUser
from app.services import consenso as consenso_service
from app.services import quaderni_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = "00000000-0000-0000-0000-0000000000a1"
_LIBRO_ID = "00000000-0000-0000-0000-0000000000b1"
_CONTENUTO_ID = "00000000-0000-0000-0000-0000000000c1"


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _riga(**extra: Any) -> dict[str, Any]:
    base = {
        "tipo_contenuto": "insight",
        "contenuto_id": _CONTENUTO_ID,
        "testo": "La memoria come materia narrativa.",
        "spoiler": False,
        "visibilita": "condiviso",
        "data": "2024-03-03",
        "voce_id": _VOCE_ID,
        "libro_id": _LIBRO_ID,
        "titolo_canonico": "Le città invisibili",
        "autori": ["Italo Calvino"],
        "copertina_miniatura_path": None,
        "copertina_colore_dominante": "#3a4a5a",
        "vicini": 3,
        "totale": 7,
        "libri_distinti": 4,
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
    """Il service col database finto. `argomenti` registra cosa è
    arrivato alla funzione SQL, che è il modo di verificare che il
    consenso decida `p_con_vicini` invece di bloccare la pagina."""
    registro: dict[str, Any] = {
        "consenso": True,
        "indici_stato": consenso_service.INDICI_PRONTI,
        "righe": [_riga()],
        "argomenti": {},
        "pensiero": _riga(),
        "vicini": [_riga(contenuto_id="00000000-0000-0000-0000-0000000000c2")],
        "sfaccettature": [
            {"tipo": "anno", "chiave": "2024", "etichetta": "2024", "n": 3},
            {"tipo": "anno", "chiave": "2026", "etichetta": "2026", "n": 5},
            {"tipo": "libro", "chiave": _VOCE_ID, "etichetta": "Le città invisibili", "n": 2},
            {"tipo": "libro", "chiave": "altra", "etichetta": "Austerlitz", "n": 6},
        ],
    }

    async def _stato(access_token: str, utente_id: UUID) -> tuple[bool, str]:
        return bool(registro["consenso"]), str(registro["indici_stato"])

    async def _esigi(access_token: str, utente_id: UUID) -> str:
        if not registro["consenso"]:
            raise consenso_service.ConsensoRevocatoError
        return str(registro["indici_stato"])

    def _elenco(client: Any, **argomenti: Any) -> list[dict[str, Any]]:
        registro["argomenti"] = argomenti
        return list(registro["righe"])

    monkeypatch.setattr(consenso_service, "stato", _stato)
    monkeypatch.setattr(consenso_service, "esigi_consenso", _esigi)
    monkeypatch.setattr(quaderni_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(scritto_repository, "elenco", _elenco)
    monkeypatch.setattr(
        scritto_repository, "pensiero_che_torna", lambda c, scarto: registro["pensiero"]
    )
    monkeypatch.setattr(
        scritto_repository, "vicini", lambda c, cid, limite: list(registro["vicini"])
    )
    monkeypatch.setattr(
        scritto_repository, "sfaccettature", lambda c: list(registro["sfaccettature"])
    )
    return registro


# --- la lente "sfoglia" ------------------------------------------------------


def test_elenco_restituisce_il_corpus_coi_suoi_conteggi(servizio: dict[str, Any]) -> None:
    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert [s["testo"] for s in esito["scritti"]] == ["La memoria come materia narrativa."]
    assert esito["scritti"][0]["titolo"] == "Le città invisibili"
    # I due conteggi valgono per l'intera selezione, non per la pagina:
    # sono ciò che le pastiglie decidono (§7).
    assert esito["totale"] == 7
    assert esito["libri_distinti"] == 4
    assert esito["indici_spenti"] is False


def test_elenco_a_pagina_vuota_conta_zero(servizio: dict[str, Any]) -> None:
    """I conteggi viaggiano sulle righe: senza righe non c'è nessuna
    riga da cui leggerli, e valgono zero per definizione invece di far
    esplodere l'indice."""
    servizio["righe"] = []

    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert esito == {
        "scritti": [],
        "totale": 0,
        "libri_distinti": 0,
        "indici_spenti": False,
        "indici_incompleti": False,
    }


def test_elenco_passa_i_filtri_alla_funzione_sql(servizio: dict[str, Any]) -> None:
    _run(
        quaderni_service.elenco(
            "t",
            _USER_ID,
            tipo="recensione",
            solo_spoiler=True,
            anno=2026,
            voce_ids=[UUID(_VOCE_ID)],
            limite=10,
            scarto=30,
        )
    )

    assert servizio["argomenti"]["tipo"] == "recensione"
    assert servizio["argomenti"]["solo_spoiler"] is True
    assert servizio["argomenti"]["anno"] == 2026
    assert servizio["argomenti"]["voce_ids"] == [UUID(_VOCE_ID)]
    assert servizio["argomenti"]["limite"] == 10
    assert servizio["argomenti"]["scarto"] == 30


# --- il consenso: un interruttore su una parte, non un cancello --------------


def test_a_consenso_revocato_il_corpus_resta_leggibile(servizio: dict[str, Any]) -> None:
    """§5: "i propri scritti esistono anche a consenso revocato, ed è
    solo il modo di interrogarli che si spegne". Nessun 409 e nessun
    elenco vuoto — la pagina resta piena e lo dichiara."""
    servizio["consenso"] = False

    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert len(esito["scritti"]) == 1
    assert esito["indici_spenti"] is True
    assert servizio["argomenti"]["con_vicini"] is False


def test_a_indici_spenti_i_vicini_sono_none_non_zero(servizio: dict[str, Any]) -> None:
    """Uno `0` direbbe "questo pensiero non ha compagnia", che a indici
    cancellati nessuno è in grado di affermare. `None` dice "non lo so",
    e il piede della carta non mostra nulla."""
    servizio["consenso"] = False

    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert esito["scritti"][0]["vicini"] is None


def test_a_consenso_acceso_i_vicini_sono_contati(servizio: dict[str, Any]) -> None:
    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert servizio["argomenti"]["con_vicini"] is True
    assert esito["scritti"][0]["vicini"] == 3


def test_durante_la_ricostruzione_lo_dichiara(servizio: dict[str, Any]) -> None:
    servizio["indici_stato"] = consenso_service.INDICI_IN_RICOSTRUZIONE

    esito = _run(quaderni_service.elenco("t", _USER_ID))

    assert esito["indici_incompleti"] is True
    assert esito["indici_spenti"] is False


# --- il pensiero che torna ---------------------------------------------------


def test_il_pensiero_che_torna_non_dipende_dal_consenso(servizio: dict[str, Any]) -> None:
    """È una riga già scritta, ripescata: nessun testo esce verso il
    fornitore e nessun vettore viene letto. È la ragione per cui lo slot
    resta in cima alla pagina quando tutto il resto è spento."""
    servizio["consenso"] = False

    esito = _run(quaderni_service.pensiero_che_torna("t", _USER_ID))

    assert esito["scritto"]["testo"] == "La memoria come materia narrativa."
    assert esito["giorni_fa"] is not None
    assert esito["giorni_fa"] > 0


def test_il_pensiero_che_torna_senza_scritti(servizio: dict[str, Any]) -> None:
    """Nessuno scritto: lo slot non c'è, e la pagina comincia dal campo.
    Non è un errore e non è un riquadro da riempire."""
    servizio["pensiero"] = None

    assert _run(quaderni_service.pensiero_che_torna("t", _USER_ID)) == {
        "scritto": None,
        "giorni_fa": None,
    }


def test_il_pensiero_che_torna_non_conta_i_vicini(servizio: dict[str, Any]) -> None:
    """Lo slot in cima non porta il conteggio dei vicini nel payload:
    quel numero costa un confronto vettoriale e lì non serve."""
    esito = _run(quaderni_service.pensiero_che_torna("t", _USER_ID))

    assert esito["scritto"]["vicini"] is None


# --- i vicini ----------------------------------------------------------------


def test_i_vicini_esigono_il_consenso(servizio: dict[str, Any]) -> None:
    """Non per il costo — questa è l'unica funzione assistita che non
    chiama il fornitore — ma perché la revoca cancella gli indici
    (regola 30) e senza vettori non c'è confronto possibile."""
    servizio["consenso"] = False

    with pytest.raises(consenso_service.ConsensoRevocatoError):
        _run(quaderni_service.vicini("t", _USER_ID, UUID(_CONTENUTO_ID)))


def test_i_vicini_tornano_nella_forma_di_uno_scritto(servizio: dict[str, Any]) -> None:
    esito = _run(quaderni_service.vicini("t", _USER_ID, UUID(_CONTENUTO_ID)))

    assert len(esito["vicini"]) == 1
    assert esito["vicini"][0]["titolo"] == "Le città invisibili"
    assert esito["indici_incompleti"] is False


# --- le sfaccettature --------------------------------------------------------


def test_le_sfaccettature_hanno_due_ordini_diversi(servizio: dict[str, Any]) -> None:
    """Gli anni dal più recente, come ogni elenco dell'app; i libri da
    quello su cui si è scritto di più, che è l'unico ordine utile in un
    menù che può avere decine di voci."""
    esito = _run(quaderni_service.sfaccettature("t"))

    assert [a["chiave"] for a in esito["anni"]] == ["2026", "2024"]
    assert [libro["etichetta"] for libro in esito["libri"]] == [
        "Austerlitz",
        "Le città invisibili",
    ]


# --- le rotte ----------------------------------------------------------------


def test_get_scritti_200(authenticated: TestClient, servizio: dict[str, Any]) -> None:
    response = authenticated.get("/scritti")

    assert response.status_code == 200
    body = response.json()
    assert body["totale"] == 7
    assert body["scritti"][0]["libro_id"] == _LIBRO_ID


def test_get_scritti_non_risponde_mai_409(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    """La differenza con le altre quattro funzioni personali, in una
    riga: qui il consenso spento non è un errore, è un'informazione."""
    servizio["consenso"] = False

    response = authenticated.get("/scritti")

    assert response.status_code == 200
    assert response.json()["indici_spenti"] is True
    assert response.json()["scritti"][0]["vicini"] is None


def test_get_scritti_rifiuta_un_tipo_inventato(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    assert authenticated.get("/scritti", params={"tipo": "nota"}).status_code == 422


def test_get_che_torna_200(authenticated: TestClient, servizio: dict[str, Any]) -> None:
    response = authenticated.get("/scritti/che-torna")

    assert response.status_code == 200
    assert response.json()["scritto"]["contenuto_id"] == _CONTENUTO_ID


def test_get_vicini_409_a_consenso_revocato(
    authenticated: TestClient, servizio: dict[str, Any]
) -> None:
    servizio["consenso"] = False

    response = authenticated.get(f"/scritti/{_CONTENUTO_ID}/vicini")

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "consenso_revocato"


def test_get_sfaccettature_200(authenticated: TestClient, servizio: dict[str, Any]) -> None:
    response = authenticated.get("/scritti/sfaccettature")

    assert response.status_code == 200
    assert len(response.json()["anni"]) == 2


def test_le_rotte_richiedono_autenticazione(client: TestClient) -> None:
    assert client.get("/scritti").status_code == 401
    assert client.get("/scritti/che-torna").status_code == 401
    assert client.get("/scritti/sfaccettature").status_code == 401
    assert client.get(f"/scritti/{_CONTENUTO_ID}/vicini").status_code == 401
