"""La preview personalizzata "me lo consigli?" (issue #6).

Regole del PRD verificate qui:
- 19, nessun contenuto di un altro Utente esce verso il fornitore — e
  nemmeno la nota di intenzione, che non esce in nessuno stato del
  consenso. Verificata sul **corpo HTTP reale**, come chiede il test
  scritto nel PRD ("ispezionare il contenuto inviato"), non su ciò che il
  service crede di aver passato;
- 20, ottanta parole, nessun testo tra virgolette, indicazione di sintesi
  generata;
- 23, nessuna operazione può rendere condivisa una preview: lo schema non
  ha alcun campo di visibilità e la rotta di modifica non esiste;
- 30, a interruttore spento non parte;
- 32, una preview già generata resta leggibile a interruttore spento.
"""

import asyncio
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
from app.services import preview_service
from tests.openai_finto import con_chiave, con_risposta, risposta_chat

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_ARTEFATTO_ID = "00000000-0000-0000-0000-0000000000d1"

_NOTA_DI_INTENZIONE = "Me lo ha consigliato Marta, la vicina di casa."
_TESTO_DI_UN_ALTRO = "Recensione scritta da un collegato, non mia."

_SCHEDA = {
    "titolo": "Le città invisibili",
    "autori": ["Italo Calvino"],
    "generi": ["Narrativa contemporanea"],
    "anno_prima_pubblicazione": 1972,
    "descrizione": "Un dialogo fra Marco Polo e Kublai Khan.",
}
_STORICO = [("Il barone rampante", ["Italo Calvino"], ["Classici"], 4.5)]
_TESTI_PROPRI = ["Calvino mi piace quando gioca con la struttura."]


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


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
    registro: dict[str, Any] = {"consenso": True, "scheda": _SCHEDA, "salvati": []}

    async def _esigi(access_token: str, utente_id: UUID) -> str:
        if not registro["consenso"]:
            raise consenso_service.ConsensoRevocatoError
        return "pronti"

    monkeypatch.setattr(consenso_service, "esigi_consenso", _esigi)
    monkeypatch.setattr(preview_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(preview_repository, "scheda_del_libro", lambda c, v, u: registro["scheda"])
    monkeypatch.setattr(preview_repository, "storico_personale", lambda c, u, e: _STORICO)
    monkeypatch.setattr(preview_repository, "testi_propri", lambda c, u: _TESTI_PROPRI)

    def _create(
        client: Any, utente_id: UUID, tipo: str, voce_id: UUID, testo: str
    ) -> dict[str, Any]:
        registro["salvati"].append(testo)
        return {
            "id": _ARTEFATTO_ID,
            "tipo": tipo,
            "voce_id": str(voce_id),
            "testo": testo,
            "creato_at": "2026-08-22T09:00:00Z",
        }

    monkeypatch.setattr(artefatto_repository, "create", _create)
    return registro


# --- generazione -------------------------------------------------------------


def test_genera_e_salva_una_preview_conforme(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(
        monkeypatch,
        risposta_chat(
            {"testo": "Ti somiglia: torni spesso a Calvino e alla struttura come gioco."}
        ),
    )

    artefatto = _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    assert artefatto["avviso"] == preview_service.AVVISO
    assert len(dati["salvati"]) == 1
    # Regola 23: nessun campo di visibilità, in nessuna forma.
    assert "visibilita" not in artefatto


def test_niente_esce_che_non_sia_del_richiedente(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 19, verificata sul corpo HTTP realmente inviato."""
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "Direi di sì, per il ritmo."}))

    _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    corpo = inviate[0].content.decode()
    assert _NOTA_DI_INTENZIONE not in corpo
    assert _TESTO_DI_UN_ALTRO not in corpo
    # Ciò che invece deve esserci: il libro e i propri testi.
    assert "Le città invisibili" in corpo
    assert _TESTI_PROPRI[0] in corpo


def test_oltre_ottanta_parole_viene_rifiutata(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 20. Due risposte fuori vincolo di fila e la preview non si
    salva: mai troncare a ottanta parole un testo che il modello ha
    scritto più lungo, perché il risultato sarebbe una frase mutilata
    firmata come se fosse la sua."""
    con_chiave(monkeypatch)
    lunga = " ".join(["parola"] * 81)
    con_risposta(monkeypatch, risposta_chat({"testo": lunga}))

    with pytest.raises(preview_service.PreviewNonConformeError):
        _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    assert dati["salvati"] == []


@pytest.mark.parametrize(
    "testo",
    [
        'Ne parla come di un "labirinto".',
        "Il tema è «la memoria».",
        "Lo definisce ‘necessario’.",
    ],
)
def test_le_virgolette_vengono_rifiutate(
    testo: str, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_chat({"testo": testo}))

    with pytest.raises(preview_service.PreviewNonConformeError):
        _run(preview_service.genera("t", _USER_ID, _VOCE_ID))


def test_gli_apostrofi_non_sono_virgolette(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """In italiano l'elisione è ovunque: un controllo che la scambiasse
    per una citazione rifiuterebbe quasi ogni frase corretta."""
    con_chiave(monkeypatch)
    con_risposta(
        monkeypatch,
        risposta_chat({"testo": "C'è un'affinità con l'idea di città che torna nei tuoi appunti."}),
    )

    _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    assert len(dati["salvati"]) == 1


def test_un_solo_secondo_tentativo(dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    """La prima risposta fuori vincolo si riprova una volta; la seconda
    conforme si salva. Non un ciclo: se due di fila sbagliano, il problema
    è il prompt e insistere spende soldi per lo stesso esito."""
    con_chiave(monkeypatch)
    inviate = con_risposta(
        monkeypatch,
        risposta_chat({"testo": " ".join(["parola"] * 90)}),
        risposta_chat({"testo": "Sì, per il modo in cui costruisce lo spazio."}),
    )

    _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    assert len(inviate) == 2
    assert dati["salvati"] == ["Sì, per il modo in cui costruisce lo spazio."]


def test_voce_inesistente(dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    dati["scheda"] = None

    with pytest.raises(preview_service.VoceNonTrovataError):
        _run(preview_service.genera("t", _USER_ID, _VOCE_ID))


def test_a_consenso_revocato_non_parte(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 30."""
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "qualcosa"}))
    dati["consenso"] = False

    with pytest.raises(consenso_service.ConsensoRevocatoError):
        _run(preview_service.genera("t", _USER_ID, _VOCE_ID))

    assert inviate == []


# --- le rotte ----------------------------------------------------------------


def test_post_preview_201(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_chat({"testo": "Sì, e per una ragione precisa."}))

    response = authenticated.post(f"/voci/{_VOCE_ID}/preview")

    assert response.status_code == 201
    assert response.json()["avviso"] == "Sintesi generata"


def test_post_preview_409_a_consenso_revocato(
    authenticated: TestClient, dati: dict[str, Any]
) -> None:
    dati["consenso"] = False

    response = authenticated.post(f"/voci/{_VOCE_ID}/preview")

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "consenso_revocato"


def test_post_preview_503_quando_il_modello_non_collabora(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """503 e non 500: non è andato storto nulla nel nostro sistema, e il
    PRD vuole che una funzione assistita fallisca senza bloccare il
    flusso."""
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_chat({"testo": " ".join(["parola"] * 200)}))

    response = authenticated.post(f"/voci/{_VOCE_ID}/preview")

    assert response.status_code == 503
    assert response.json()["detail"]["error_code"] == "modello_non_disponibile"


def test_get_preview_resta_leggibile_a_consenso_revocato(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 32: la revoca non tocca gli artefatti già generati."""
    dati["consenso"] = False
    monkeypatch.setattr(
        artefatto_repository,
        "ultimo_per_voce",
        lambda c, v, t: {
            "id": _ARTEFATTO_ID,
            "tipo": t,
            "voce_id": str(v),
            "testo": "Un parere di ieri.",
            "creato_at": "2026-08-21T09:00:00Z",
        },
    )

    response = authenticated.get(f"/voci/{_VOCE_ID}/preview")

    assert response.status_code == 200
    assert response.json()["testo"] == "Un parere di ieri."


def test_get_preview_404_se_non_ne_esiste(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(artefatto_repository, "ultimo_per_voce", lambda c, v, t: None)

    assert authenticated.get(f"/voci/{_VOCE_ID}/preview").status_code == 404


def test_delete_artefatto_204(
    authenticated: TestClient, dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(preview_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(artefatto_repository, "delete", lambda c, i: True)

    assert authenticated.delete(f"/artefatti/{_ARTEFATTO_ID}").status_code == 204


def test_nessuna_rotta_di_modifica_di_un_artefatto(
    authenticated: TestClient, dati: dict[str, Any]
) -> None:
    """Regola 23: "nessuna operazione può renderla condivisa". Il modo di
    garantirlo è che non esista alcuna scrittura su un artefatto oltre
    alla sua nascita e alla sua cancellazione."""
    for metodo in (authenticated.put, authenticated.patch):
        assert metodo(f"/artefatti/{_ARTEFATTO_ID}", json={"testo": "riscritto"}).status_code == 405


def test_preview_richiede_autenticazione(client: TestClient) -> None:
    assert client.post(f"/voci/{_VOCE_ID}/preview").status_code == 401
    assert client.get(f"/voci/{_VOCE_ID}/preview").status_code == 401
