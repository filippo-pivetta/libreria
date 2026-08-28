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
from app.repositories import insight_repository, recensione_repository, voce_repository
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
    async def _fake_elenco(access_token: str, utente_id: UUID, lingua: str) -> list[dict[str, Any]]:
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


def test_get_voci_non_porta_la_descrizione_dellopera(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Lo scaffale non disegna la descrizione, quindi non la riceve.

    Il contratto vale anche quando il service *fornisce* il campo, come
    fa qui `_LIBRO_CON_DESCRIZIONE`: a tagliarlo è lo schema di risposta
    (`LibroDaScaffale`, app/schemas/voci.py), non il caso fortunato di
    un dato assente a monte. Su una libreria di qualche centinaio di
    titoli era il pezzo più pesante della risposta della home, scaricato
    a ogni apertura e mai letto da nessun componente.
    """
    libro_con_descrizione = {
        **_LIBRO,
        "descrizione": "Un paragrafo lungo che lo scaffale non disegna mai.",
        "descrizione_riformulata": True,
    }

    async def _fake_elenco(access_token: str, utente_id: UUID, lingua: str) -> list[dict[str, Any]]:
        return [{**_VOCE, "libro": libro_con_descrizione}]

    monkeypatch.setattr(voci_service, "elenco_libreria", _fake_elenco)

    response = authenticated.get("/voci")

    assert response.status_code == 200
    libro = response.json()[0]["libro"]
    assert "descrizione" not in libro
    assert "descrizione_riformulata" not in libro
    # Il resto del dorso c'è ancora: la potatura riguarda la sola
    # descrizione, non i campi che lo scaffale disegna davvero.
    assert libro["titolo_canonico"] == "Prova"
    assert libro["copertina_stato"] == "assente"


def test_get_voce_porta_la_descrizione_dellopera(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La scheda invece la riceve: è la pagina che la disegna
    (`components/libro/scheda.tsx`). L'altra metà del contratto diviso
    con il test qui sopra — senza questo, togliere la descrizione anche
    dalla scheda passerebbe inosservato."""

    async def _fake_dettaglio(
        access_token: str, voce_id: UUID, richiedente_id: UUID, lingua: str
    ) -> dict[str, Any] | None:
        return {
            **_VOCE,
            "libro": {
                **_LIBRO,
                "descrizione": "Il testo dell'opera.",
                "descrizione_riformulata": True,
            },
            "letture": [],
            "recensione": None,
            "insight_senza_lettura": [],
        }

    monkeypatch.setattr(voci_service, "dettaglio", _fake_dettaglio)

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 200
    libro = response.json()["libro"]
    assert libro["descrizione"] == "Il testo dell'opera."
    assert libro["descrizione_riformulata"] is True


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
    async def _fake_dettaglio(
        access_token: str, voce_id: UUID, richiedente_id: UUID, lingua: str
    ) -> dict[str, Any] | None:
        assert voce_id == _VOCE_ID
        return {
            **_VOCE,
            "libro": _LIBRO,
            "letture": [
                {
                    "id": "00000000-0000-0000-0000-0000000000c1",
                    "data_inizio": "2026-08-15",
                    "data_fine": None,
                    "anno_fine": None,
                    "esito": None,
                    "avanzamenti": [
                        {
                            "id": "00000000-0000-0000-0000-0000000000d1",
                            "pagina": 40,
                            "data": "2026-08-16",
                            "generato_automaticamente": False,
                        }
                    ],
                    "insight": [],
                }
            ],
            "recensione": None,
            "insight_senza_lettura": [],
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
    async def _fake_dettaglio(
        access_token: str, voce_id: UUID, richiedente_id: UUID, lingua: str
    ) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(voci_service, "dettaglio", _fake_dettaglio)

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 404


def test_get_voce_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 401


# --- GET /voci/{id}: composizione di recensione/insight (issue #5) --------
#
# A differenza dei test sopra, questi non monkeypatchano `voci_service.
# dettaglio`: la vera logica di composizione (e il gating spoiler, che vive
# in `insight_service`) deve girare per intero. Si mockano solo i
# repository, il confine più vicino a Supabase.

_LETTURA_APERTA_ID = UUID("00000000-0000-0000-0000-0000000000c1")
_LETTURA_CANCELLATA_ID = UUID("00000000-0000-0000-0000-0000000000c9")


def _get_dettaglio_con_insight_spoiler(client: Any, voce_id: UUID, lingua: str) -> dict[str, Any]:
    return {
        **_VOCE,
        "libro": _LIBRO,
        "letture": [
            {
                "id": str(_LETTURA_APERTA_ID),
                "data_inizio": "2026-08-15",
                "data_fine": None,
                "anno_fine": None,
                "esito": None,
                "avanzamenti": [],
            }
        ],
    }


def _list_by_voce_con_insight_spoiler(client: Any, voce_id: UUID) -> list[dict[str, Any]]:
    return [
        {
            "id": "00000000-0000-0000-0000-0000000000f1",
            "voce_id": str(_VOCE_ID),
            "lettura_id": str(_LETTURA_APERTA_ID),
            "testo": "Il finale mi ha sorpreso.",
            "spoiler": True,
            "visibilita": "condiviso",
            "data": "2026-08-16",
            "creato_at": "2026-08-16T00:00:00Z",
        }
    ]


def test_get_voce_dettaglio_mostra_lo_spoiler_al_proprietario(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La regola 10 (PRD) protegge da uno spoiler *altrui*, non da un
    proprio testo (design-frontend.md §11, rivisto nell'issue #6):
    `authenticated` impersona proprio il proprietario (`_USER_ID` =
    `_VOCE.utente_id`), e deve vedere il testo pieno senza alcun taglio.
    Fino all'issue #6 questo stesso scenario era il test cardine della
    regola opposta — la storia di questo file è la controprova che il
    gating non protegge il proprietario da se stesso."""
    monkeypatch.setattr(voce_repository, "get_dettaglio", _get_dettaglio_con_insight_spoiler)
    monkeypatch.setattr(recensione_repository, "get_by_voce", lambda client, voce_id: None)
    monkeypatch.setattr(insight_repository, "list_by_voce", _list_by_voce_con_insight_spoiler)

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.status_code == 200
    insight_nella_lettura = response.json()["letture"][0]["insight"]
    assert len(insight_nella_lettura) == 1
    assert insight_nella_lettura[0]["spoiler"] is True
    assert insight_nella_lettura[0]["testo"] == "Il finale mi ha sorpreso."


def test_get_voce_dettaglio_nasconde_lo_spoiler_a_un_collegato(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La stessa Voce, vista da un id diverso da quello del proprietario
    (visione reciproca, issue #3): qui il gating resta quello di sempre —
    il testo non è mai restituito in chiaro. La RLS garantisce che solo un
    collegato attivo arrivi fin qui; questo test verifica solo il
    comportamento di presentazione, non l'accesso alla riga."""
    _COLLEGATO_ID = UUID("00000000-0000-0000-0000-000000000002")
    monkeypatch.setattr(voce_repository, "get_dettaglio", _get_dettaglio_con_insight_spoiler)
    monkeypatch.setattr(recensione_repository, "get_by_voce", lambda client, voce_id: None)
    monkeypatch.setattr(insight_repository, "list_by_voce", _list_by_voce_con_insight_spoiler)
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_COLLEGATO_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        response = client.get(f"/voci/{_VOCE_ID}")
    finally:
        del app.dependency_overrides[get_current_user]

    assert response.status_code == 200
    insight_nella_lettura = response.json()["letture"][0]["insight"]
    assert len(insight_nella_lettura) == 1
    assert insight_nella_lettura[0]["spoiler"] is True
    assert insight_nella_lettura[0]["testo"] is None


def test_get_voce_dettaglio_espone_insight_senza_spoiler_per_intero(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        voce_repository,
        "get_dettaglio",
        lambda client, voce_id, lingua: {
            **_VOCE,
            "libro": _LIBRO,
            "letture": [
                {
                    "id": str(_LETTURA_APERTA_ID),
                    "data_inizio": "2026-08-15",
                    "data_fine": None,
                    "anno_fine": None,
                    "esito": None,
                    "avanzamenti": [],
                }
            ],
        },
    )
    monkeypatch.setattr(recensione_repository, "get_by_voce", lambda client, voce_id: None)
    monkeypatch.setattr(
        insight_repository,
        "list_by_voce",
        lambda client, voce_id: [
            {
                "id": "00000000-0000-0000-0000-0000000000f2",
                "voce_id": str(_VOCE_ID),
                "lettura_id": str(_LETTURA_APERTA_ID),
                "testo": "Uno stile secco, quasi giornalistico.",
                "spoiler": False,
                "visibilita": "condiviso",
                "data": "2026-08-16",
                "creato_at": "2026-08-16T00:00:00Z",
            }
        ],
    )

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    insight_nella_lettura = response.json()["letture"][0]["insight"]
    assert insight_nella_lettura[0]["testo"] == "Uno stile secco, quasi giornalistico."


def test_get_voce_dettaglio_raggruppa_insight_senza_lettura(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un insight senza `lettura_id` (scritto prima di iniziare il libro) e
    uno il cui `lettura_id` punta a una Lettura non più tra quelle della
    Voce (Lettura cancellata — PRD: "gli insight legati a una Lettura
    cancellata restano sulla Voce, senza più alcuna Lettura associata")
    finiscono entrambi in `insight_senza_lettura`, mai persi."""
    monkeypatch.setattr(
        voce_repository,
        "get_dettaglio",
        lambda client, voce_id, lingua: {
            **_VOCE,
            "libro": _LIBRO,
            "letture": [
                {
                    "id": str(_LETTURA_APERTA_ID),
                    "data_inizio": "2026-08-15",
                    "data_fine": None,
                    "anno_fine": None,
                    "esito": None,
                    "avanzamenti": [],
                }
            ],
        },
    )
    monkeypatch.setattr(recensione_repository, "get_by_voce", lambda client, voce_id: None)
    monkeypatch.setattr(
        insight_repository,
        "list_by_voce",
        lambda client, voce_id: [
            {
                "id": "00000000-0000-0000-0000-0000000000f3",
                "voce_id": str(_VOCE_ID),
                "lettura_id": None,
                "testo": "Prima ancora di iniziare, mi aspetto...",
                "spoiler": False,
                "visibilita": "condiviso",
                "data": "2026-08-10",
                "creato_at": "2026-08-10T00:00:00Z",
            },
            {
                "id": "00000000-0000-0000-0000-0000000000f4",
                "voce_id": str(_VOCE_ID),
                "lettura_id": str(_LETTURA_CANCELLATA_ID),
                "testo": "Orfano di una lettura cancellata.",
                "spoiler": False,
                "visibilita": "condiviso",
                "data": "2026-08-11",
                "creato_at": "2026-08-11T00:00:00Z",
            },
        ],
    )

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    body = response.json()
    assert len(body["letture"][0]["insight"]) == 0
    assert len(body["insight_senza_lettura"]) == 2


def test_get_voce_dettaglio_include_recensione_del_proprietario(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        voce_repository,
        "get_dettaglio",
        lambda client, voce_id, lingua: {**_VOCE, "libro": _LIBRO, "letture": []},
    )
    monkeypatch.setattr(
        recensione_repository,
        "get_by_voce",
        lambda client, voce_id: {
            "id": "00000000-0000-0000-0000-0000000000e1",
            "voce_id": str(_VOCE_ID),
            "testo": "Un libro che resta addosso.",
            "visibilita": "condiviso",
            "creato_at": "2026-08-20T00:00:00Z",
            "aggiornato_at": "2026-08-20T00:00:00Z",
        },
    )
    monkeypatch.setattr(insight_repository, "list_by_voce", lambda client, voce_id: [])

    response = authenticated.get(f"/voci/{_VOCE_ID}")

    assert response.json()["recensione"]["testo"] == "Un libro che resta addosso."


# --- PATCH /voci/{id}/stato -----------------------------------------------


def test_patch_stato_returns_updated_voce(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
    ) -> dict[str, Any]:
        assert voce_id == _VOCE_ID
        assert nuovo_stato == "in_lettura"
        assert data is None
        return {**_VOCE, "stato": "in_lettura"}

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "in_lettura"})

    assert response.status_code == 200
    assert response.json()["stato"] == "in_lettura"


def test_patch_stato_inoltra_precisione_e_annata(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """«L'ho già letto» con la sola annata: il corpo porta `precisione` e
    `anno_fine` invece di una data, e devono arrivare intatti al service —
    è lì che si decide se la Lettura nasce con un giorno, con un anno o
    senza nulla (migrazione 20260827160000)."""

    async def _fake_cambia_stato(
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
    ) -> dict[str, Any]:
        assert nuovo_stato == "letto"
        assert data is None
        assert precisione == "anno"
        assert anno_fine == 2019
        return {**_VOCE, "stato": "letto"}

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/stato",
        json={"stato": "letto", "precisione": "anno", "anno_fine": 2019},
    )

    assert response.status_code == 200
    assert response.json()["stato"] == "letto"


def test_patch_stato_rifiuta_una_precisione_sconosciuta(authenticated: TestClient) -> None:
    """L'elenco chiuso sta nello schema, non solo nella RPC: un valore
    fuori elenco è un 422, non un 500 dal database."""
    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/stato", json={"stato": "letto", "precisione": "circa"}
    )
    assert response.status_code == 422


def test_patch_stato_returns_409_su_annata_futura(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
    ) -> dict[str, Any]:
        raise voci_service.AnnoFineNonValidoError

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(
        f"/voci/{_VOCE_ID}/stato",
        json={"stato": "letto", "precisione": "anno", "anno_fine": 3000},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "anno_fine_non_valido"


def test_patch_stato_returns_404_when_voce_not_found(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
    ) -> dict[str, Any]:
        raise voci_service.VoceNonTrovataError

    monkeypatch.setattr(voci_service, "cambia_stato", _fake_cambia_stato)

    response = authenticated.patch(f"/voci/{_VOCE_ID}/stato", json={"stato": "in_lettura"})

    assert response.status_code == 404


def test_patch_stato_returns_409_on_transizione_non_ammessa(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cambia_stato(
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
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
        access_token: str,
        voce_id: UUID,
        nuovo_stato: str,
        data: date | None,
        precisione: str = "giorno",
        anno_fine: int | None = None,
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


def test_delete_voce_returns_204(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, voce_id: UUID) -> bool:
        assert access_token == "test-token"
        assert voce_id == _VOCE_ID
        return True

    monkeypatch.setattr(voci_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/voci/{_VOCE_ID}")

    assert response.status_code == 204


def test_delete_voce_returns_404_when_missing(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_cancella(access_token: str, voce_id: UUID) -> bool:
        return False

    monkeypatch.setattr(voci_service, "cancella", _fake_cancella)

    response = authenticated.delete(f"/voci/{_VOCE_ID}")

    assert response.status_code == 404


def test_delete_voce_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"/voci/{_VOCE_ID}")

    assert response.status_code == 401


# --- l'esistenza di una nota di intenzione altrui non deve trapelare -------


@pytest.mark.parametrize("codice", ["23503", "42501"])
def test_correggere_la_nota_su_una_voce_altrui_da_sempre_la_stessa_risposta(
    monkeypatch: pytest.MonkeyPatch, codice: str
) -> None:
    """Stesso ragionamento di `test_recensioni`, sull'altro dei due upsert.

    Qui pesa di più: la nota di intenzione è il contenuto che l'ADR 0008
    tiene più stretto di ogni altro — non esce nemmeno verso il fornitore
    di modelli — e un 500 distinguibile da un 404 ne rivelerebbe
    l'esistenza a un collegato.
    """
    import asyncio

    from postgrest.exceptions import APIError

    def _rifiuta(*args: Any, **kwargs: Any) -> None:
        raise APIError({"message": "no", "code": codice, "hint": None, "details": None})

    monkeypatch.setattr(voce_repository, "update_nota_intenzione", _rifiuta)

    esito = asyncio.run(
        voci_service.correggi_nota_intenzione("test-token", _USER_ID, _VOCE_ID, "una nota")
    )

    assert esito is None, f"il codice {codice} deve tradursi in 404, non in 500"
