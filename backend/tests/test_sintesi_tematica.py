"""La sintesi tematica trasversale, a temi (issue #27, riscritta il 22
agosto 2026 — vedi il docstring di `app/services/sintesi_service.py`).

Regole verificate qui:
- 19, nessun contenuto di un altro Utente esce verso il fornitore, mai la
  nota di intenzione — verificata sul corpo HTTP reale, come per la
  preview;
- disciplina di forma analoga alla regola 20 su `nome` e `sintesi` di
  ogni tema, tetto di parole diverso e per riga, non per l'intero testo;
- soglia "trasversale ... tra libri diversi": un tema sostenuto da un
  solo libro non sopravvive, in nessuno dei due modi in cui può accadere
  (tutto il materiale è di un libro solo, oppure il modello propone un
  tema debole che il service scarta);
- 30, a interruttore spento non parte;
- 32, una sintesi già generata resta leggibile a interruttore spento;
- sostituzione: una seconda generazione riuscita cancella la precedente,
  ma un fallimento non tocca quella esistente.
"""

import asyncio
import json
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import artefatto_repository, preview_repository
from app.schemas.auth import AuthenticatedUser
from app.services import consenso as consenso_service
from app.services import sintesi_service
from tests.openai_finto import con_chiave, con_risposta, risposta_chat

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_ARTEFATTO_ID = "00000000-0000-0000-0000-0000000000e1"
_ARTEFATTO_PRECEDENTE_ID = "00000000-0000-0000-0000-0000000000e0"
_VOCE_A = "00000000-0000-0000-0000-0000000000a1"
_VOCE_B = "00000000-0000-0000-0000-0000000000a2"

_NOTA_DI_INTENZIONE = "Me lo ha consigliato Marta, la vicina di casa."
_TESTO_DI_UN_ALTRO = "Recensione scritta da un collegato, non mia."

_RIFERIMENTI = [
    {
        "contenuto_id": "00000000-0000-0000-0000-0000000000c1",
        "tipo": "insight",
        "testo": "Torno sempre al tema della memoria.",
        "data": "2026-08-20",
        "voce_id": _VOCE_A,
        "titolo": "Le città invisibili",
    },
    {
        "contenuto_id": "00000000-0000-0000-0000-0000000000c2",
        "tipo": "insight",
        "testo": "La testimonianza come dovere morale.",
        "data": "2026-08-19",
        "voce_id": _VOCE_B,
        "titolo": "Se questo è un uomo",
    },
]

_RIFERIMENTI_UN_SOLO_LIBRO = [
    {**_RIFERIMENTI[0], "contenuto_id": "00000000-0000-0000-0000-0000000000c3"},
    {
        **_RIFERIMENTI[0],
        "contenuto_id": "00000000-0000-0000-0000-0000000000c4",
        "data": "2026-08-01",
    },
]


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _tema(
    nome: str = "Memoria",
    sintesi: str = "Torni sempre a chi porta il peso del ricordo.",
    indici: list[int] | None = None,
) -> dict[str, Any]:
    return {"nome": nome, "sintesi": sintesi, "indici": indici if indici is not None else [0, 1]}


def _risposta_temi(*temi: dict[str, Any]) -> Any:
    return risposta_chat({"temi": list(temi)})


def _tema_salvato(nome: str = "Tema di ieri") -> dict[str, Any]:
    """La forma già validata e risolta con cui un tema vive dentro
    `artefatto_generato.testo` — non la forma grezza che il modello
    restituisce (`_tema`), che ha `indici` e non `riferimenti`."""
    return {
        "nome": nome,
        "sintesi": "Torni sempre a chi porta il peso del ricordo.",
        "riferimenti": [
            {
                "voce_id": _VOCE_A,
                "titolo": "Le città invisibili",
                "tipo": "insight",
                "testo": "Torno sempre al tema della memoria.",
                "data": "2026-08-20",
            },
            {
                "voce_id": _VOCE_B,
                "titolo": "Se questo è un uomo",
                "tipo": "insight",
                "testo": "La testimonianza come dovere morale.",
                "data": "2026-08-19",
            },
        ],
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


@pytest.fixture
def dati(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {
        "consenso": True,
        "riferimenti": _RIFERIMENTI,
        "precedente": None,
        "cancellati": [],
        "salvati": [],
    }

    async def _esigi(access_token: str, utente_id: UUID) -> str:
        if not registro["consenso"]:
            raise consenso_service.ConsensoRevocatoError
        return "pronti"

    monkeypatch.setattr(consenso_service, "esigi_consenso", _esigi)
    monkeypatch.setattr(sintesi_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(
        preview_repository, "testi_propri_con_riferimenti", lambda c, u: registro["riferimenti"]
    )
    monkeypatch.setattr(
        artefatto_repository, "ultimo_per_utente_e_tipo", lambda c, u, t: registro["precedente"]
    )

    def _delete(client: Any, artefatto_id: UUID) -> bool:
        registro["cancellati"].append(str(artefatto_id))
        return True

    def _create(
        client: Any, utente_id: UUID, tipo: str, voce_id: UUID | None, testo: str
    ) -> dict[str, Any]:
        registro["salvati"].append(testo)
        return {
            "id": _ARTEFATTO_ID,
            "tipo": tipo,
            "voce_id": voce_id,
            "testo": testo,
            "creato_at": "2026-08-22T09:00:00Z",
        }

    monkeypatch.setattr(artefatto_repository, "delete", _delete)
    monkeypatch.setattr(artefatto_repository, "create", _create)
    return registro


# --- generazione -------------------------------------------------------------


def test_genera_e_salva_temi_validi(dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema()))

    artefatto = _run(sintesi_service.genera("t", _USER_ID))

    assert artefatto["avviso"] == sintesi_service.AVVISO
    assert len(artefatto["temi"]) == 1
    assert artefatto["temi"][0]["nome"] == "Memoria"
    titoli = {r["titolo"] for r in artefatto["temi"][0]["riferimenti"]}
    assert titoli == {"Le città invisibili", "Se questo è un uomo"}
    assert len(dati["salvati"]) == 1


def test_niente_esce_che_non_sia_del_richiedente(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 19, verificata sul corpo HTTP realmente inviato. `_RIFERIMENTI`
    è già, per costruzione del repository reale, privo di nota di
    intenzione e di contenuti altrui: questa asserzione documenta
    l'invariante."""
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, _risposta_temi(_tema()))

    _run(sintesi_service.genera("t", _USER_ID))

    corpo = inviate[0].content.decode()
    assert _NOTA_DI_INTENZIONE not in corpo
    assert _TESTO_DI_UN_ALTRO not in corpo
    assert "Le città invisibili" in corpo
    assert "Torno sempre al tema della memoria." in corpo


def test_tema_su_un_solo_libro_viene_scartato(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Trasversale ... tra libri diversi": un tema con un solo indice (o
    due indici dello stesso libro) non è trasversale, indipendentemente
    da quanto il modello insista."""
    con_chiave(monkeypatch)
    inviate = con_risposta(
        monkeypatch,
        _risposta_temi(_tema(indici=[0])),
        _risposta_temi(_tema(indici=[0])),
    )

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))

    assert len(inviate) == 2  # un solo secondo tentativo, non un ciclo
    assert dati["salvati"] == []


def test_tema_su_un_solo_libro_di_verita_scartato_anche_se_gli_indici_ripetono_lo_stesso_voce(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Due indici diversi ma dello stesso libro (voce_id uguale) non
    bastano: la soglia conta i libri distinti, non gli indici."""
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema(indici=[0, 0])))

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))


def test_indici_fuori_intervallo_vengono_ignorati(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un indice inventato dal modello (fuori dall'elenco che ha ricevuto)
    si scarta silenziosamente invece di far fallire l'intera risposta."""
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema(indici=[0, 1, 99, -1])))

    artefatto = _run(sintesi_service.genera("t", _USER_ID))

    assert len(artefatto["temi"][0]["riferimenti"]) == 2


def test_un_tema_con_virgolette_viene_scartato_senza_bocciare_gli_altri(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(
        monkeypatch,
        _risposta_temi(
            _tema(nome="Memoria", sintesi='Un tema che torna è "la memoria" dei personaggi.'),
            _tema(nome="Solitudine", sintesi="Chi resta solo per scelta, non per sconfitta."),
        ),
    )

    artefatto = _run(sintesi_service.genera("t", _USER_ID))

    nomi = [t["nome"] for t in artefatto["temi"]]
    assert nomi == ["Solitudine"]


def test_un_tema_con_nome_troppo_lungo_viene_scartato(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(
        monkeypatch,
        _risposta_temi(_tema(nome="Un nome di tema decisamente troppo lungo per la soglia")),
    )

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))


def test_una_sintesi_troppo_lunga_viene_scartata(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    lunga = " ".join(["parola"] * 26)
    con_risposta(monkeypatch, _risposta_temi(_tema(sintesi=lunga)))

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))


def test_a_consenso_revocato_non_parte(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 30."""
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, _risposta_temi(_tema()))
    dati["consenso"] = False

    with pytest.raises(consenso_service.ConsensoRevocatoError):
        _run(sintesi_service.genera("t", _USER_ID))

    assert inviate == []


def test_senza_alcun_testo_non_chiama_il_modello(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    dati["riferimenti"] = []
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, _risposta_temi(_tema()))

    with pytest.raises(sintesi_service.ContenutoInsufficienteError):
        _run(sintesi_service.genera("t", _USER_ID))

    assert inviate == []


def test_con_un_solo_libro_in_gioco_non_chiama_il_modello(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Con tutto il materiale legato a un unico libro, nessun tema può
    superare `MINIMO_LIBRI_PER_TEMA`: il risultato è già certo, e non
    vale la pena pagare una chiamata per scoprirlo."""
    dati["riferimenti"] = _RIFERIMENTI_UN_SOLO_LIBRO
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, _risposta_temi(_tema()))

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))

    assert inviate == []


def test_una_seconda_generazione_sostituisce_la_precedente(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    dati["precedente"] = {
        "id": _ARTEFATTO_PRECEDENTE_ID,
        "tipo": "sintesi_tematica",
        "voce_id": None,
        "testo": json.dumps({"temi": [_tema_salvato(nome="Vecchio tema")]}),
        "creato_at": "2026-08-21T09:00:00Z",
    }
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema(nome="Nuovo tema")))

    artefatto = _run(sintesi_service.genera("t", _USER_ID))

    assert dati["cancellati"] == [_ARTEFATTO_PRECEDENTE_ID]
    assert artefatto["temi"][0]["nome"] == "Nuovo tema"


def test_se_la_generazione_fallisce_la_precedente_resta(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Non si cancella la sintesi esistente prima di avere quella nuova
    pronta: un fallimento del modello non deve lasciare l'Utente senza
    alcuna sintesi."""
    dati["precedente"] = {
        "id": _ARTEFATTO_PRECEDENTE_ID,
        "tipo": "sintesi_tematica",
        "voce_id": None,
        "testo": json.dumps({"temi": [_tema_salvato(nome="Vecchio tema")]}),
        "creato_at": "2026-08-21T09:00:00Z",
    }
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema(indici=[0])))

    with pytest.raises(sintesi_service.NessunTemaRilevanteError):
        _run(sintesi_service.genera("t", _USER_ID))

    assert dati["cancellati"] == []


# --- le rotte ----------------------------------------------------------------


def test_post_sintesi_201(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, _risposta_temi(_tema()))

    response = authenticated.post("/sintesi-tematica")

    assert response.status_code == 201
    corpo = response.json()
    assert corpo["avviso"] == "Sintesi generata"
    assert len(corpo["temi"]) == 1
    assert len(corpo["temi"][0]["riferimenti"]) == 2


def test_post_sintesi_409_a_consenso_revocato(
    authenticated: TestClient, dati: dict[str, Any]
) -> None:
    dati["consenso"] = False

    response = authenticated.post("/sintesi-tematica")

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "consenso_revocato"


def test_post_sintesi_422_senza_contenuto(authenticated: TestClient, dati: dict[str, Any]) -> None:
    dati["riferimenti"] = []

    response = authenticated.post("/sintesi-tematica")

    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "insight_insufficienti"


def test_post_sintesi_422_nessun_tema_rilevante(
    authenticated: TestClient, dati: dict[str, Any]
) -> None:
    dati["riferimenti"] = _RIFERIMENTI_UN_SOLO_LIBRO

    response = authenticated.post("/sintesi-tematica")

    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "nessun_tema_rilevante"


def test_post_sintesi_503_quando_il_modello_non_risponde(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch, chiave=None)

    response = authenticated.post("/sintesi-tematica")

    assert response.status_code == 503
    assert response.json()["detail"]["error_code"] == "modello_non_disponibile"


def test_get_sintesi_resta_leggibile_a_consenso_revocato(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 32."""
    dati["consenso"] = False
    monkeypatch.setattr(
        artefatto_repository,
        "ultimo_per_utente_e_tipo",
        lambda c, u, t: {
            "id": _ARTEFATTO_ID,
            "tipo": t,
            "voce_id": None,
            "testo": json.dumps({"temi": [_tema_salvato(nome="Tema di ieri")]}),
            "creato_at": "2026-08-21T09:00:00Z",
        },
    )

    response = authenticated.get("/sintesi-tematica")

    assert response.status_code == 200
    assert response.json()["temi"][0]["nome"] == "Tema di ieri"


def test_get_sintesi_404_se_non_ne_esiste(authenticated: TestClient, dati: dict[str, Any]) -> None:
    assert authenticated.get("/sintesi-tematica").status_code == 404


def test_sintesi_richiede_autenticazione(client: TestClient) -> None:
    assert client.post("/sintesi-tematica").status_code == 401
    assert client.get("/sintesi-tematica").status_code == 401
