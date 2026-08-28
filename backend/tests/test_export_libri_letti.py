"""Test per l'esportazione dei libri letti (issue #8, ADR 0011 rivisto,
PRD comportamento 14bis, regole 33/34): CSV dei soli dati bibliografici,
voto e recensione delle Voci con stato "letto" — mai insight né nota di
intenzione.

Stesso doppio livello di test_metriche.py:
- Router: isolato sia dalla verifica JWT sia dal service
  (`export_service.libri_letti_csv` monkeypatchato).
- Servizio: `export_service.libri_letti_csv` esercitato per davvero, con
  `export_repository.list_libri_letti` monkeypatchato (nessuna
  rete/Supabase) — la formattazione (titolo, autori, generi, ultima
  lettura conclusa) è la parte non banale di questa issue.
"""

import asyncio
import csv
import io
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.repositories import export_repository
from app.schemas.auth import AuthenticatedUser
from app.services import export_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _righe_csv(contenuto: bytes) -> list[list[str]]:
    testo = contenuto.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(testo)))


def _libro(**overrides: Any) -> dict[str, Any]:
    base = {
        "titolo_canonico": "Il nome della rosa",
        "anno_prima_pubblicazione": 1980,
        "lingua_originale": "it",
        "libro_autore": [{"ordine": 0, "autore": {"nome_canonico": "Umberto Eco"}}],
        "libro_genere": [
            {"genere": {"genere_etichetta": [{"lingua": "it", "etichetta": "Classici"}]}}
        ],
        "variante_titolo": [],
    }
    return {**base, **overrides}


def _voce(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "pagine_adottate": 320,
        "voto": 4.5,
        "libro": _libro(),
        "letture": [{"data_inizio": "2020-01-01", "data_fine": "2020-02-01", "esito": "conclusa"}],
        "recensione": {"testo": "Bellissimo."},
    }
    return {**base, **overrides}


# --- Router: GET /me/export/libri-letti -----------------------------------


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


def test_get_export_restituisce_csv_scaricabile(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake(access_token: str, utente_id: UUID, lingua: str) -> bytes:
        assert access_token == "test-token"
        assert utente_id == _USER_ID
        return "intestazione\n".encode("utf-8-sig")

    monkeypatch.setattr(export_service, "libri_letti_csv", _fake)

    response = authenticated.get("/me/export/libri-letti")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    assert ".csv" in response.headers["content-disposition"]


# --- Servizio ---------------------------------------------------------------


@pytest.fixture
def repository(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    righe: list[dict[str, Any]] = []
    monkeypatch.setattr(export_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(export_repository, "list_libri_letti", lambda client, utente_id: righe)
    return righe


def test_nessun_libro_letto_produce_solo_intestazione(repository: list[dict[str, Any]]) -> None:
    contenuto = _run(export_service.libri_letti_csv("t", _USER_ID, "it"))

    righe = _righe_csv(contenuto)
    assert len(righe) == 1
    assert righe[0][0] == "titolo"


def test_bom_utf8_in_testa_al_file(repository: list[dict[str, Any]]) -> None:
    contenuto = _run(export_service.libri_letti_csv("t", _USER_ID, "it"))

    assert contenuto.startswith(b"\xef\xbb\xbf")


def test_titolo_usa_la_variante_in_italiano_se_c_e(repository: list[dict[str, Any]]) -> None:
    repository.append(
        _voce(libro=_libro(variante_titolo=[{"lingua": "it", "titolo": "Il Nome della Rosa"}]))
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][0] == "Il Nome della Rosa"


def test_titolo_ripiega_sul_canonico_senza_variante(repository: list[dict[str, Any]]) -> None:
    repository.append(_voce())

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][0] == "Il nome della rosa"


def test_autori_uniti_nell_ordine_assegnato(repository: list[dict[str, Any]]) -> None:
    repository.append(
        _voce(
            libro=_libro(
                libro_autore=[
                    {"ordine": 1, "autore": {"nome_canonico": "Seconda Autrice"}},
                    {"ordine": 0, "autore": {"nome_canonico": "Prima Autrice"}},
                ]
            )
        )
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][1] == "Prima Autrice; Seconda Autrice"


def test_libro_senza_recensione_ne_voto_ha_campi_vuoti(repository: list[dict[str, Any]]) -> None:
    repository.append(_voce(voto=None, recensione=None))

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][9] == ""  # voto
    assert righe[1][10] == ""  # recensione


def test_titolo_e_generi_seguono_la_lingua_richiesta(repository: list[dict[str, Any]]) -> None:
    """Issue #34: `lingua` non è più fissa a "it" — con l'inglese richiesto,
    titolo e generi seguono la variante/etichetta inglese, non quella
    italiana, anche se quest'ultima è elencata per prima nei dati."""
    repository.append(
        _voce(
            libro=_libro(
                variante_titolo=[
                    {"lingua": "it", "titolo": "Il Nome della Rosa"},
                    {"lingua": "en", "titolo": "The Name of the Rose"},
                ],
                libro_genere=[
                    {
                        "genere": {
                            "genere_etichetta": [
                                {"lingua": "it", "etichetta": "Classici"},
                                {"lingua": "en", "etichetta": "Classics"},
                            ]
                        }
                    }
                ],
            )
        )
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "en")))

    assert righe[1][0] == "The Name of the Rose"
    assert righe[1][2] == "Classics"


def test_esporta_la_lettura_conclusa_non_quella_ancora_aperta(
    repository: list[dict[str, Any]],
) -> None:
    repository.append(
        _voce(
            letture=[
                {"data_inizio": "2019-01-01", "data_fine": "2019-03-01", "esito": "conclusa"},
                {"data_inizio": "2026-08-01", "data_fine": None, "esito": None},
            ]
        )
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][6] == "2019-01-01"
    assert righe[1][7] == "2019-03-01"
    assert righe[1][8] == ""  # nessuna annata: la chiusura ha il suo giorno


def test_esporta_l_annata_quando_la_chiusura_non_ha_un_giorno(
    repository: list[dict[str, Any]],
) -> None:
    """Una lettura registrata a posteriori (migrazione 20260827160000)
    esce con la sua annata nella colonna dedicata e le due date vuote —
    mai con "2019" infilato dove il resto del file scrive "2019-03-01"."""
    repository.append(
        _voce(
            letture=[
                {
                    "data_inizio": None,
                    "data_fine": None,
                    "anno_fine": 2019,
                    "esito": "conclusa",
                }
            ]
        )
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][6] == ""  # nessun inizio: non si conosce
    assert righe[1][7] == ""  # nessun giorno di fine
    assert righe[1][8] == "2019"


def test_fra_due_concluse_di_precisione_diversa_vince_la_piu_recente(
    repository: list[dict[str, Any]],
) -> None:
    """L'annata entra nell'ordinamento come il 31 dicembre di quell'anno:
    è una chiave di confronto, non un dato, e infatti nel file la data di
    fine resta vuota."""
    repository.append(
        _voce(
            letture=[
                {"data_inizio": "2019-01-01", "data_fine": "2019-03-01", "esito": "conclusa"},
                {"data_inizio": None, "data_fine": None, "anno_fine": 2021, "esito": "conclusa"},
            ]
        )
    )

    righe = _righe_csv(_run(export_service.libri_letti_csv("t", _USER_ID, "it")))

    assert righe[1][7] == ""
    assert righe[1][8] == "2021"
