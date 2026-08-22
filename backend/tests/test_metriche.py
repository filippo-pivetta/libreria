"""Test per /metriche (issue #7): due livelli, come test_llm.py per la
logica pura del modulo cataloghi.

- Router: isolato sia dalla verifica JWT (dependency override) sia dal
  service (`metriche_service.metriche_di` monkeypatchato) — stesso
  pattern di test_voci.py/test_utenti.py.
- Servizio: `metriche_service.metriche_di` esercitato per davvero, con
  `app.core.supabase.get_user_client` e `app.repositories.metriche_
  repository` monkeypatchati (nessuna rete/Supabase) — la logica di
  aggregazione (incrementi, peso ripartito, riletture, scarto generi,
  divergenza a cavallo d'anno) è la parte non banale di questa issue e
  merita di essere verificata per sé, non solo dietro un mock del
  service intero.

  `oggi_europa_centrale` è monkeypatchato per fissare "oggi" a un valore
  noto: senza, i test sull'anno corrente/futuro diventerebbero mobili.
"""

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import metriche_repository
from app.schemas.auth import AuthenticatedUser
from app.services import metriche_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


_METRICHE_ZERO: dict[str, Any] = {
    "anno": 2026,
    "anno_minimo": 2026,
    "anno_massimo": 2026,
    "libri_finiti": 0,
    "riletture": 0,
    "pagine_lette": 0,
    "autori_piu_letti": [],
    "generi_principali": [],
    "libri_senza_genere": 0,
    "ha_letture_a_cavallo_anno": False,
}


# --- Router: GET /metriche ----------------------------------------------


def test_get_metriche_returns_payload(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, utente_id: UUID, anno: int | None
    ) -> dict[str, Any]:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        assert anno == 2025
        return {**_METRICHE_ZERO, "anno": 2025, "anno_minimo": 2020, "libri_finiti": 3}

    monkeypatch.setattr(metriche_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get("/metriche?anno=2025")

    assert response.status_code == 200
    body = response.json()
    assert body["anno"] == 2025
    assert body["libri_finiti"] == 3


def test_get_metriche_defaults_anno_to_none(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, utente_id: UUID, anno: int | None
    ) -> dict[str, Any]:
        assert anno is None
        return _METRICHE_ZERO

    monkeypatch.setattr(metriche_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get("/metriche")

    assert response.status_code == 200


def test_get_metriche_returns_422_on_anno_futuro(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, utente_id: UUID, anno: int | None
    ) -> dict[str, Any]:
        raise metriche_service.AnnoFuturoError

    monkeypatch.setattr(metriche_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get("/metriche?anno=2999")

    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "anno_futuro"


def test_get_metriche_requires_authentication(client: TestClient) -> None:
    response = client.get("/metriche")

    assert response.status_code == 401


# --- Servizio: metriche_service.metriche_di -----------------------------


@pytest.fixture(autouse=True)
def _oggi_fissato(monkeypatch: pytest.MonkeyPatch) -> None:
    import datetime

    # `metriche_service` importa `oggi_europa_centrale` per nome
    # (`from app.core.tempo import oggi_europa_centrale`): patchare
    # `app.core.tempo.oggi_europa_centrale` non basterebbe, il modulo
    # tiene già il proprio riferimento locale — va sostituito lì.
    monkeypatch.setattr(
        "app.services.metriche_service.oggi_europa_centrale",
        lambda: datetime.date(2026, 8, 22),
    )


def _patch_repo(
    monkeypatch: pytest.MonkeyPatch,
    letture: list[dict[str, Any]],
    avanzamenti: list[dict[str, Any]],
    voci: dict[str, dict[str, Any]] | None = None,
) -> None:
    monkeypatch.setattr("app.services.metriche_service.get_user_client", lambda token: object())
    monkeypatch.setattr(metriche_repository, "list_letture", lambda client, utente_id: letture)
    monkeypatch.setattr(
        metriche_repository, "list_avanzamenti", lambda client, utente_id: avanzamenti
    )
    monkeypatch.setattr(
        metriche_repository,
        "list_voci_con_libro",
        lambda client, voce_ids: voci or {},
    )


def _libro(id_: str, autori: list[str], generi: list[str]) -> dict[str, Any]:
    return {
        "id": id_,
        "libro_autore": [{"autore": {"id": a, "nome_canonico": f"Autore {a}"}} for a in autori],
        "libro_genere": [
            {
                "genere": {
                    "id": g,
                    "genere_etichetta": [{"lingua": "it", "etichetta": f"Genere {g}"}],
                }
            }
            for g in generi
        ],
    }


def test_metriche_di_nessun_dato_restituisce_zeri(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_repo(monkeypatch, letture=[], avanzamenti=[])

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, None))

    assert risultato == _METRICHE_ZERO


def test_metriche_di_riletture_conta_letture_non_libri(monkeypatch: pytest.MonkeyPatch) -> None:
    """PRD: "due riletture concluse nello stesso anno contano due" —
    l'unità è la Lettura, non il Libro."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "conclusa",
        },
        {
            "id": "l2",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-03-01",
            "data_fine": "2026-04-01",
            "esito": "conclusa",
        },
    ]
    voci = {"00000000-0000-0000-0000-0000000000a1": _libro("b1", ["a1"], [])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["libri_finiti"] == 2
    assert risultato["riletture"] == 1
    # Nessun genere assegnato: entrambe le Letture finiscono nello scarto.
    assert risultato["libri_senza_genere"] == 2
    assert risultato["generi_principali"] == []


def test_metriche_di_ripartisce_il_peso_tra_autori_e_generi(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PRD regola 18: un libro con più autori/generi distribuisce il
    proprio peso tra loro, la somma resta pari a un libro."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "conclusa",
        }
    ]
    voci = {"00000000-0000-0000-0000-0000000000a1": _libro("b1", ["a1", "a2", "a3"], ["g1", "g2"])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    # round(1/3, 3) = 0.333: arrotondato in metriche_service._classifica per
    # non trasmettere rumore binario, non un errore di calcolo.
    pesi_autori = {r["id"]: r["peso"] for r in risultato["autori_piu_letti"]}
    assert pesi_autori == {"a1": 0.333, "a2": 0.333, "a3": 0.333}
    pesi_generi = {r["id"]: r["peso"] for r in risultato["generi_principali"]}
    assert pesi_generi == {"g1": pytest.approx(0.5), "g2": pytest.approx(0.5)}
    assert risultato["libri_senza_genere"] == 0


def test_metriche_di_abbandono_non_conta_come_finito_ma_conta_le_pagine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PRD regola 13."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "abbandonata",
        }
    ]
    avanzamenti = [
        {
            "lettura_id": "l1",
            "pagina": 40,
            "data": "2026-01-15",
            "creato_at": "2026-01-15T00:00:00Z",
        }
    ]
    _patch_repo(monkeypatch, letture=letture, avanzamenti=avanzamenti, voci={})

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["libri_finiti"] == 0
    assert risultato["pagine_lette"] == 40


def test_metriche_di_pagine_lette_sono_incrementi_a_cavallo_anno(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PRD: "le pagine lette sono la somma degli incrementi datati
    nell'anno" — l'incremento del 2026 dipende dalla pagina del 2025,
    ma va contato tutto nel 2026, non nel 2025."""
    avanzamenti = [
        {
            "lettura_id": "l1",
            "pagina": 50,
            "data": "2025-12-30",
            "creato_at": "2025-12-30T00:00:00Z",
        },
        {
            "lettura_id": "l1",
            "pagina": 120,
            "data": "2026-01-02",
            "creato_at": "2026-01-02T00:00:00Z",
        },
    ]
    _patch_repo(monkeypatch, letture=[], avanzamenti=avanzamenti, voci={})

    import asyncio

    metriche_2025 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2025))
    metriche_2026 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert metriche_2025["pagine_lette"] == 50
    assert metriche_2026["pagine_lette"] == 70


def test_metriche_di_segnala_letture_a_cavallo_anno(monkeypatch: pytest.MonkeyPatch) -> None:
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2025-12-20",
            "data_fine": "2026-01-05",
            "esito": "conclusa",
        }
    ]
    voci = {"00000000-0000-0000-0000-0000000000a1": _libro("b1", ["a1"], ["g1"])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["ha_letture_a_cavallo_anno"] is True


def test_metriche_di_anno_minimo_e_il_primo_con_dati(monkeypatch: pytest.MonkeyPatch) -> None:
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2022-01-01",
            "data_fine": "2022-02-01",
            "esito": "conclusa",
        }
    ]
    avanzamenti = [
        {
            "lettura_id": "l1",
            "pagina": 10,
            "data": "2020-06-01",
            "creato_at": "2020-06-01T00:00:00Z",
        }
    ]
    _patch_repo(monkeypatch, letture=letture, avanzamenti=avanzamenti, voci={})

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["anno_minimo"] == 2020
    assert risultato["anno_massimo"] == 2026


def test_metriche_di_rifiuta_anno_futuro(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_repo(monkeypatch, letture=[], avanzamenti=[])

    import asyncio

    with pytest.raises(metriche_service.AnnoFuturoError):
        asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2027))


def test_metriche_di_riletture_non_dipende_dal_join_sul_libro(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Le riletture si contano per voce_id (unica per utente+libro,
    uq_voce_di_libreria_utente_libro), non tramite la mappa `voci`
    restituita da `list_voci_con_libro`: una riga mancante lì (es. un
    limite di paginazione lato Supabase) non deve gonfiare le riletture
    di libri che non lo sono. Qui `list_voci_con_libro` non risolve
    nessuna delle due Voci: se il conteggio dipendesse da quella mappa,
    due libri diversi finiti nello stesso anno risulterebbero un libro
    con una rilettura."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "conclusa",
        },
        {
            "id": "l2",
            "voce_id": "00000000-0000-0000-0000-0000000000a2",
            "data_inizio": "2026-03-01",
            "data_fine": "2026-04-01",
            "esito": "conclusa",
        },
    ]
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci={})

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["libri_finiti"] == 2
    assert risultato["riletture"] == 0


def test_metriche_di_genere_senza_etichetta_italiana_non_conta_come_assente(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un genere assegnato ma con solo un'etichetta non italiana resta
    un genere assegnato: non deve gonfiare `libri_senza_genere` né
    sparire da `generi_principali` — vedi `_etichetta_genere`."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "conclusa",
        }
    ]
    libro = {
        "id": "b1",
        "libro_autore": [{"autore": {"id": "a1", "nome_canonico": "Autore a1"}}],
        "libro_genere": [
            {
                "genere": {
                    "id": "g1",
                    "genere_etichetta": [{"lingua": "en", "etichetta": "Genre g1"}],
                }
            }
        ],
    }
    voci = {"00000000-0000-0000-0000-0000000000a1": libro}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026))

    assert risultato["libri_senza_genere"] == 0
    assert [r["id"] for r in risultato["generi_principali"]] == ["g1"]
