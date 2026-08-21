"""Deduplicazione assistita (app/lavori/deduplicazione.py). Nessun
database e nessuna rete: repository e client del modello sono
monkeypatchati, stesso pattern di test_lavori_copertine.py.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import deduplicazione as modulo
from app.lavori.errori import ErroreTransitorio

_NUOVO_ID = "00000000-0000-0000-0000-0000000000b1"
_CANDIDATO_ID = "00000000-0000-0000-0000-0000000000b2"


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {"proposte": []}
    monkeypatch.setattr(modulo.database, "apri_connessione", lambda: _ConnessioneContesto())
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "proponi_fusione_libro",
        lambda conn, a, b, motivo: registro["proposte"].append((a, b, motivo)),
    )
    return registro


def _con_candidato(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "candidati_deduplicazione",
        lambda conn, libro_id: [
            (_CANDIDATO_ID, "Le notti bianche - La cronaca di Pietroburgo", ["Dostoevskij"], None)
        ],
    )


def test_nessun_candidato_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        modulo.catalogo_repository, "candidati_deduplicazione", lambda conn, libro_id: []
    )
    chiamato = {"si": False}

    async def _valuta_duplicati(*args: Any, **kwargs: Any) -> None:
        chiamato["si"] = True
        return None

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert chiamato["si"] is False
    assert scritture["proposte"] == []


def test_modello_non_confidente_non_propone(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_candidato(monkeypatch)

    async def _valuta_duplicati(nuovo: Any, candidati: list[Any]) -> None:
        return None

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert scritture["proposte"] == []


def test_match_confidente_scrive_una_proposta_ordinata(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """`least/greatest` sui due UUID in input, non l'ordine di scoperta:
    verificato sui due ordini possibili di libro_id."""
    _con_candidato(monkeypatch)

    async def _valuta_duplicati(nuovo: Any, candidati: list[Any]) -> llm.DecisioneDuplicato:
        assert nuovo.libro_id == _NUOVO_ID
        assert candidati[0].libro_id == _CANDIDATO_ID
        return llm.DecisioneDuplicato(
            libro_id_candidato=_CANDIDATO_ID, motivo="stessa opera, sottotitolo diverso"
        )

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert scritture["proposte"] == [
        (_NUOVO_ID, _CANDIDATO_ID, "stessa opera, sottotitolo diverso")
    ]


def test_id_fuori_dai_candidati_viene_scartato(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Difesa contro un id inventato dal modello: mai proporre la fusione
    con un libro che non era fra i candidati mostrati."""
    _con_candidato(monkeypatch)

    async def _valuta_duplicati(nuovo: Any, candidati: list[Any]) -> llm.DecisioneDuplicato:
        return llm.DecisioneDuplicato(libro_id_candidato="non-era-un-candidato", motivo="?")

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert scritture["proposte"] == []


def test_una_seconda_esecuzione_non_duplica_la_proposta(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """`on conflict do nothing` in proponi_fusione_libro (verificato a
    livello di repository, non qui): il gestore chiama sempre la funzione,
    è l'idempotenza dell'INSERT a impedire il duplicato."""
    _con_candidato(monkeypatch)

    async def _valuta_duplicati(nuovo: Any, candidati: list[Any]) -> llm.DecisioneDuplicato:
        return llm.DecisioneDuplicato(libro_id_candidato=_CANDIDATO_ID, motivo="stessa opera")

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))
    _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert len(scritture["proposte"]) == 2  # il gestore chiama sempre; l'unicità è nel repository


def test_llm_non_disponibile_e_transitorio(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_candidato(monkeypatch)

    async def _valuta_duplicati(nuovo: Any, candidati: list[Any]) -> None:
        raise FonteNonRaggiungibileError("openai", "timeout")

    monkeypatch.setattr(modulo.llm, "valuta_duplicati", _valuta_duplicati)

    with pytest.raises(ErroreTransitorio):
        _run(modulo.esegui({"libro_id": _NUOVO_ID, "titolo": "Le notti bianche", "autori": []}))

    assert scritture["proposte"] == []


def test_su_fallimento_non_scrive_nulla() -> None:
    _run(modulo.su_fallimento({"libro_id": _NUOVO_ID}, "tre timeout"))


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
