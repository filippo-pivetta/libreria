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
    "letture_a_cavallo_anno": 0,
    "pagine_per_mese": [0] * 12,
    "giorni_con_lettura": 0,
    # 22 agosto 2026 è il 234° giorno dell'anno (`_oggi_fissato`).
    "giorni_trascorsi": 234,
    "voto_medio": None,
    "libri_votati": 0,
    "voti_per_stella": [0, 0, 0, 0, 0],
    "abbandoni": 0,
    "durata_media_giorni": None,
    "durata_massima_giorni": None,
    "durata_massima_titolo": None,
    "libri_senza_pagine": 0,
    "pagine_senza_giorno": 0,
    "libri_finiti_senza_giorno": 0,
}


# --- Router: GET /metriche ----------------------------------------------


def test_get_metriche_returns_payload(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, utente_id: UUID, anno: int | None, lingua: str
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
        access_token: str, utente_id: UUID, anno: int | None, lingua: str
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
        access_token: str, utente_id: UUID, anno: int | None, lingua: str
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


def _voce(
    id_: str,
    autori: list[str],
    generi: list[str],
    voto: float | None = None,
    pagine_adottate: int | None = 300,
    titolo: str = "Un titolo",
) -> dict[str, Any]:
    """Una riga di `list_voci_con_libro`: la Voce (voto, pagine adottate)
    col Libro incorporato. `pagine_adottate` è valorizzato per difetto
    perché l'assenza è il caso che una metrica conta (`libri_senza_pagine`),
    e va scritta esplicitamente dal test che la esercita."""
    return {
        "id": id_,
        "voto": voto,
        "pagine_adottate": pagine_adottate,
        "libro": {
            "id": id_,
            "titolo_canonico": titolo,
            "variante_titolo": [],
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
        },
    }


def test_metriche_di_nessun_dato_restituisce_zeri(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_repo(monkeypatch, letture=[], avanzamenti=[])

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, None, "it"))

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
    voci = {"00000000-0000-0000-0000-0000000000a1": _voce("b1", ["a1"], [])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 2
    assert risultato["riletture"] == 1
    # Nessun genere assegnato: entrambe le Letture finiscono nello scarto.
    assert risultato["libri_senza_genere"] == 2
    assert risultato["generi_principali"] == []


def test_metriche_di_etichetta_genere_segue_la_lingua_richiesta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Issue #34: `lingua` non è più fissa a "it" — con l'inglese
    richiesto, l'etichetta di genere restituita è quella inglese."""
    letture = [
        {
            "id": "l1",
            "voce_id": "00000000-0000-0000-0000-0000000000a1",
            "data_inizio": "2026-01-01",
            "data_fine": "2026-02-01",
            "esito": "conclusa",
        }
    ]
    voce = {
        "id": "b1",
        "voto": None,
        "pagine_adottate": 300,
        "libro": {
            "id": "b1",
            "titolo_canonico": "Un titolo",
            "variante_titolo": [],
            "libro_autore": [],
            "libro_genere": [
                {
                    "genere": {
                        "id": "g1",
                        "genere_etichetta": [
                            {"lingua": "it", "etichetta": "Narrativa"},
                            {"lingua": "en", "etichetta": "Fiction"},
                        ],
                    }
                }
            ],
        },
    }
    voci = {"00000000-0000-0000-0000-0000000000a1": voce}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "en"))

    assert risultato["generi_principali"] == [{"id": "g1", "nome": "Fiction", "peso": 1.0}]


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
    voci = {"00000000-0000-0000-0000-0000000000a1": _voce("b1", ["a1", "a2", "a3"], ["g1", "g2"])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

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

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

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

    metriche_2025 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2025, "it"))
    metriche_2026 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

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
    voci = {"00000000-0000-0000-0000-0000000000a1": _voce("b1", ["a1"], ["g1"])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

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

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["anno_minimo"] == 2020
    assert risultato["anno_massimo"] == 2026


def test_metriche_di_rifiuta_anno_futuro(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_repo(monkeypatch, letture=[], avanzamenti=[])

    import asyncio

    with pytest.raises(metriche_service.AnnoFuturoError):
        asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2027, "it"))


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

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

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
    voce = {
        "id": "b1",
        "voto": None,
        "pagine_adottate": 300,
        "libro": {
            "id": "b1",
            "titolo_canonico": "Un titolo",
            "variante_titolo": [],
            "libro_autore": [{"autore": {"id": "a1", "nome_canonico": "Autore a1"}}],
            "libro_genere": [
                {
                    "genere": {
                        "id": "g1",
                        "genere_etichetta": [{"lingua": "en", "etichetta": "Genre g1"}],
                    }
                }
            ],
        },
    }
    voci = {"00000000-0000-0000-0000-0000000000a1": voce}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_senza_genere"] == 0
    assert [r["id"] for r in risultato["generi_principali"]] == ["g1"]


# --- Le metriche aggiunte dal ridisegno degli Annali (§14) ---------------


def _voce_id(chiave: str) -> str:
    """`metriche_service` costruisce un `UUID` da `voce_id` per passarlo
    al repository: una chiave corta come "v1" non è un UUID valido e
    farebbe fallire il servizio prima di arrivare all'asserzione."""
    return f"00000000-0000-0000-0000-0000000000{int(chiave.lstrip('v')):02d}"


def _lettura(
    id_: str,
    voce: str,
    inizio: str,
    fine: str | None = None,
    esito: str | None = "conclusa",
) -> dict[str, Any]:
    return {
        "id": id_,
        "voce_id": _voce_id(voce),
        "data_inizio": inizio,
        "data_fine": fine,
        "anno_fine": None,
        "esito": esito,
    }


def _lettura_a_posteriori(id_: str, voce: str, anno: int | None) -> dict[str, Any]:
    """Una Lettura registrata a posteriori (migrazione 20260827160000):
    conclusa, senza data di inizio, e chiusa sulla sola annata — oppure
    senza alcuna data quando nemmeno l'anno si conosce (`anno=None`)."""
    return {
        "id": id_,
        "voce_id": _voce_id(voce),
        "data_inizio": None,
        "data_fine": None,
        "anno_fine": anno,
        "esito": "conclusa",
    }


def _avanzamento(lettura: str, pagina: int, data: str) -> dict[str, Any]:
    return {
        "lettura_id": lettura,
        "pagina": pagina,
        "data": data,
        "creato_at": f"{data}T00:00:00Z",
    }


def test_metriche_di_pagine_per_mese_e_la_stessa_somma_non_collassata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`pagine_per_mese` è `pagine_lette` a una risoluzione più fine:
    dodici caselle sempre, e la loro somma coincide per costruzione."""
    avanzamenti = [
        _avanzamento("l1", 50, "2026-01-10"),
        _avanzamento("l1", 130, "2026-03-04"),
        _avanzamento("l1", 200, "2026-03-20"),
        # Fuori anno: non entra in nessuna casella del 2026, ma la sua
        # pagina resta la base dell'incremento successivo.
        _avanzamento("l2", 40, "2025-12-31"),
        _avanzamento("l2", 90, "2026-08-01"),
    ]
    _patch_repo(monkeypatch, letture=[], avanzamenti=avanzamenti, voci={})

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["pagine_per_mese"] == [50, 0, 150, 0, 0, 0, 0, 50, 0, 0, 0, 0]
    assert sum(risultato["pagine_per_mese"]) == risultato["pagine_lette"] == 250


def test_metriche_di_giorni_con_lettura_conta_date_distinte_e_ignora_incrementi_nulli(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Misura l'abitudine, non il volume: due Avanzamenti nello stesso
    giorno fanno un giorno, e un Avanzamento che non fa avanzare nulla
    (la stessa pagina segnata di nuovo) non fa un giorno di lettura."""
    avanzamenti = [
        _avanzamento("l1", 30, "2026-02-01"),
        _avanzamento("l1", 60, "2026-02-01"),
        _avanzamento("l1", 60, "2026-02-05"),  # incremento zero
        _avanzamento("l1", 90, "2026-02-09"),
    ]
    _patch_repo(monkeypatch, letture=[], avanzamenti=avanzamenti, voci={})

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["giorni_con_lettura"] == 2
    # 22 agosto 2026: l'anno corrente si ferma a oggi, non a 365.
    assert risultato["giorni_trascorsi"] == 234


def test_metriche_di_giorni_trascorsi_di_un_anno_passato_e_lanno_intero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_repo(monkeypatch, letture=[], avanzamenti=[], voci={})

    import asyncio

    assert (
        asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2025, "it"))["giorni_trascorsi"]
        == 365
    )
    # 2024 è bisestile.
    assert (
        asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2024, "it"))["giorni_trascorsi"]
        == 366
    )


def test_metriche_di_voto_medio_e_distribuzione_arrotondano_alla_stella_superiore(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Il voto è numeric(2,1) fra 1,0 e 5,0 a mezze stelle (migrazione
    20260820205444): la media resta a mezzo punto, l'istogramma a cinque
    colonne arrotonda per eccesso, e chi non ha voto resta fuori dal
    campione invece di entrarci come zero."""
    letture = [
        _lettura("l1", "v1", "2026-01-01", "2026-01-20"),
        _lettura("l2", "v2", "2026-02-01", "2026-02-20"),
        _lettura("l3", "v3", "2026-03-01", "2026-03-20"),
    ]
    voci = {
        _voce_id("v1"): _voce("b1", ["a1"], [], voto=4.0),
        _voce_id("v2"): _voce("b2", ["a2"], [], voto=3.5),
        _voce_id("v3"): _voce("b3", ["a3"], [], voto=None),
    }
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 3
    assert risultato["libri_votati"] == 2
    assert risultato["voto_medio"] == 3.8
    # 4,0 e 3,5 finiscono entrambi nella colonna delle quattro stelle.
    assert risultato["voti_per_stella"] == [0, 0, 0, 2, 0]


def test_metriche_di_voto_di_una_voce_riletta_conta_una_volta_sola(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Il voto sta sulla Voce, non sulla Lettura: due riletture della
    stessa Voce concluse nello stesso anno contano due libri finiti (PRD)
    ma un voto solo, altrimenti la media pesa due volte lo stesso
    giudizio."""
    letture = [
        _lettura("l1", "v1", "2026-01-01", "2026-01-20"),
        _lettura("l2", "v1", "2026-05-01", "2026-05-20"),
    ]
    voci = {_voce_id("v1"): _voce("b1", ["a1"], [], voto=5.0)}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 2
    assert risultato["riletture"] == 1
    assert risultato["libri_votati"] == 1
    assert risultato["voti_per_stella"] == [0, 0, 0, 0, 1]


def test_metriche_di_abbandoni_contano_nellanno_di_chiusura(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un abbandono chiude la Lettura come una conclusione (data_fine +
    esito) e si conta nell'anno di chiusura, senza entrare nei libri
    finiti (regola 13)."""
    letture = [
        _lettura("l1", "v1", "2026-01-01", "2026-02-01", esito="abbandonata"),
        _lettura("l2", "v2", "2025-11-01", "2025-12-01", esito="abbandonata"),
        _lettura("l3", "v3", "2026-03-01", None, esito=None),
        _lettura("l4", "v4", "2026-04-01", "2026-04-10"),
    ]
    voci = {_voce_id("v4"): _voce("b4", ["a1"], [])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["abbandoni"] == 1
    assert risultato["libri_finiti"] == 1


def test_metriche_di_durata_conta_gli_estremi_e_nomina_la_piu_lunga(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Estremi inclusi: una Lettura cominciata e conclusa in giornata
    dura un giorno, non zero. Il titolo della più lunga segue la lingua
    dell'interfaccia quando esiste una variante."""
    letture = [
        _lettura("l1", "v1", "2026-01-01", "2026-01-01"),
        _lettura("l2", "v2", "2026-02-01", "2026-02-10"),
    ]
    voci = {
        _voce_id("v1"): _voce("b1", ["a1"], [], titolo="Un giorno solo"),
        _voce_id("v2"): _voce("b2", ["a2"], [], titolo="Il piu lungo"),
    }
    voci[_voce_id("v2")]["libro"]["variante_titolo"] = [{"lingua": "en", "titolo": "The longest"}]
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    it = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))
    en = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "en"))

    # 1 giorno e 10 giorni: media 5,5 arrotondata a 6 (round half to even
    # di Python porterebbe 5,5 a 6 comunque, ma qui conta il valore).
    assert it["durata_massima_giorni"] == 10
    assert it["durata_media_giorni"] == 6
    assert it["durata_massima_titolo"] == "Il piu lungo"
    assert en["durata_massima_titolo"] == "The longest"


def test_metriche_di_libri_senza_pagine_rende_concreto_il_limite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zero significa che la somma delle pagine è completa e il limite
    non va nemmeno scritto: è il numero che sostituisce il caveat
    perpetuo di §14."""
    letture = [
        _lettura("l1", "v1", "2026-01-01", "2026-01-20"),
        _lettura("l2", "v2", "2026-02-01", "2026-02-20"),
    ]
    voci = {
        _voce_id("v1"): _voce("b1", ["a1"], [], pagine_adottate=None),
        _voce_id("v2"): _voce("b2", ["a2"], [], pagine_adottate=412),
    }
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_senza_pagine"] == 1


def test_metriche_di_letture_a_cavallo_anno_e_un_conteggio_non_un_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La frase che spiega la divergenza era al singolare fisso: serve il
    numero perché possa andare al plurale quando le letture sono due."""
    letture = [
        _lettura("l1", "v1", "2025-12-20", "2026-01-05"),
        _lettura("l2", "v2", "2025-11-01", "2026-02-02"),
        _lettura("l3", "v3", "2026-03-01", "2026-03-20"),
    ]
    voci = {_voce_id(c): _voce(c, ["a1"], []) for c in ("v1", "v2", "v3")}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["ha_letture_a_cavallo_anno"] is True
    assert risultato["letture_a_cavallo_anno"] == 2


# --- letture registrate a posteriori (migrazione 20260827160000) ------------


def test_metriche_lettura_con_la_sola_annata_conta_libro_e_pagine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La scelta di prodotto: le pagine di una lettura chiusa sulla sola
    annata entrano nel totale dell'anno.

    Non hanno un Avanzamento da cui essere contate — senza un giorno non
    esiste una riga da datare — quindi arrivano dalle pagine adottate
    della Voce. Un totale annuo senza ripartizione mensile è un dato
    onesto; uno zero accanto a un libro finito sembrerebbe un guasto.
    """
    letture = [_lettura_a_posteriori("l1", "v1", 2026)]
    voci = {_voce_id("v1"): _voce("b1", ["a1"], ["g1"], pagine_adottate=300)}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 1
    assert risultato["pagine_lette"] == 300
    # Ma non in un mese, e nemmeno in un giorno: quelli il dato non li ha.
    assert risultato["pagine_per_mese"] == [0] * 12
    assert risultato["giorni_con_lettura"] == 0
    # Lo scarto è dichiarato, non nascosto (design-frontend.md §14).
    assert risultato["pagine_senza_giorno"] == 300
    assert risultato["libri_finiti_senza_giorno"] == 1
    # L'autore e il genere invece contano: quelli non dipendono dal giorno.
    assert risultato["autori_piu_letti"][0]["peso"] == 1.0
    assert risultato["libri_senza_genere"] == 0


def test_metriche_pagine_per_mese_piu_senza_giorno_fa_pagine_lette(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """L'invariante nuova, che sostituisce `sum(pagine_per_mese) ==
    pagine_lette`: il grafico mensile mostra tutto tranne ciò che un mese
    non ce l'ha, e quel resto è esattamente `pagine_senza_giorno`."""
    letture = [
        _lettura("l1", "v1", "2026-01-10", "2026-01-20"),
        _lettura_a_posteriori("l2", "v2", 2026),
    ]
    voci = {
        _voce_id("v1"): _voce("b1", ["a1"], []),
        _voce_id("v2"): _voce("b2", ["a2"], [], pagine_adottate=150),
    }
    avanzamenti = [_avanzamento("l1", 120, "2026-01-20")]
    _patch_repo(monkeypatch, letture=letture, avanzamenti=avanzamenti, voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["pagine_lette"] == 270
    assert risultato["pagine_senza_giorno"] == 150
    assert sum(risultato["pagine_per_mese"]) == 120
    assert (
        sum(risultato["pagine_per_mese"]) + risultato["pagine_senza_giorno"]
        == risultato["pagine_lette"]
    )


def test_metriche_lettura_senza_alcuna_data_non_appartiene_a_nessun_anno(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Chi non ricorda nemmeno l'anno segna il libro come letto lo stesso:
    resta nello storico, e non compare in nessuna metrica annuale. È la
    distinzione di Letterboxd fra "visto" e la riga datata del diario."""
    letture = [_lettura_a_posteriori("l1", "v1", None)]
    voci = {_voce_id("v1"): _voce("b1", ["a1"], [])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 0
    assert risultato["pagine_lette"] == 0
    assert risultato["libri_finiti_senza_giorno"] == 0
    # E non sposta nemmeno il primo anno selezionabile, che senza dati
    # datati resta quello corrente (PRD, comportamento #12).
    assert risultato["anno_minimo"] == 2026


def test_metriche_una_lettura_a_posteriori_non_ha_durata_ne_e_a_cavallo_d_anno(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Senza data di inizio non c'è una durata da mediare né un anno
    precedente da cui provenire: entrambe le metriche saltano la riga
    invece di dedurre un inizio che l'Utente non ha dato."""
    letture = [
        _lettura("l1", "v1", "2026-02-01", "2026-02-11"),
        _lettura_a_posteriori("l2", "v2", 2026),
    ]
    voci = {_voce_id("v1"): _voce("b1", ["a1"], []), _voce_id("v2"): _voce("b2", ["a2"], [])}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    risultato = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert risultato["libri_finiti"] == 2
    assert risultato["letture_a_cavallo_anno"] == 0
    assert risultato["ha_letture_a_cavallo_anno"] is False
    # 11 giorni, estremi inclusi, e la media è su quella sola lettura.
    assert risultato["durata_media_giorni"] == 11
    assert risultato["durata_massima_giorni"] == 11


def test_metriche_annata_di_chiusura_seleziona_l_anno(monkeypatch: pytest.MonkeyPatch) -> None:
    """Una lettura registrata sul 2019 appartiene al 2019, non all'anno in
    cui è stata inserita: è tutto il punto del riempimento storico."""
    letture = [_lettura_a_posteriori("l1", "v1", 2019)]
    voci = {_voce_id("v1"): _voce("b1", ["a1"], [], pagine_adottate=200)}
    _patch_repo(monkeypatch, letture=letture, avanzamenti=[], voci=voci)

    import asyncio

    del_2019 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2019, "it"))
    del_2026 = asyncio.run(metriche_service.metriche_di("token", _USER_ID, 2026, "it"))

    assert del_2019["libri_finiti"] == 1
    assert del_2019["pagine_lette"] == 200
    assert del_2026["libri_finiti"] == 0
    # E il primo anno selezionabile scende al 2019, altrimenti quel libro
    # sarebbe contato in un anno che l'interfaccia non lascia raggiungere.
    assert del_2019["anno_minimo"] == 2019
