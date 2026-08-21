"""Riconduzione autori assistita (app/lavori/riconduzione_autori.py).
Nessun database e nessuna rete: repository e client del modello sono
monkeypatchati, stesso pattern di test_lavori_copertine.py.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import riconduzione_autori as modulo
from app.lavori.errori import ErroreTransitorio

_NUOVO_ID = "00000000-0000-0000-0000-0000000000a1"
_CANDIDATO_ID = "00000000-0000-0000-0000-0000000000a2"


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {"fuso": None}
    monkeypatch.setattr(modulo.database, "apri_connessione", lambda: _ConnessioneContesto())
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "fondi_autore",
        lambda conn, canonico, duplicato, variante, motivo: registro.__setitem__(
            "fuso", (canonico, duplicato, variante, motivo)
        ),
    )
    return registro


def _con_candidato(monkeypatch: pytest.MonkeyPatch, nome_candidato: str = "J.R.R. Tolkien") -> None:
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "tutti_autori",
        lambda conn: [(_CANDIDATO_ID, nome_candidato)],
    )
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "varianti_di_autori",
        lambda conn, ids: {_CANDIDATO_ID: ["J.R.R. Tolkien"]},
    )


def test_nessun_candidato_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(modulo.catalogo_repository, "tutti_autori", lambda conn: [])
    chiamato = {"si": False}

    async def _confronta_autori(*args: Any, **kwargs: Any) -> None:
        chiamato["si"] = True
        return None

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    assert chiamato["si"] is False
    assert scritture["fuso"] is None


def test_candidato_con_cognome_diverso_non_e_proposto(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Il filtro per cognome (app.core.testo.cognome) esclude un candidato
    che non condivide l'ultimo token del nome: il modello non viene
    nemmeno interpellato."""
    _con_candidato(monkeypatch, nome_candidato="Mario Bianchi")
    chiamato = {"si": False}

    async def _confronta_autori(*args: Any, **kwargs: Any) -> None:
        chiamato["si"] = True
        return None

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    assert chiamato["si"] is False
    assert scritture["fuso"] is None


def test_modello_non_confidente_non_scrive(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_candidato(monkeypatch)

    async def _confronta_autori(nome_nuovo: str, candidati: list[Any]) -> None:
        return None

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    assert scritture["fuso"] is None


def test_match_confidente_esegue_la_fusione(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_candidato(monkeypatch)

    async def _confronta_autori(nome_nuovo: str, candidati: list[Any]) -> llm.DecisioneAutore:
        assert nome_nuovo == "John Ronald Reuel Tolkien"
        assert candidati[0].autore_id == _CANDIDATO_ID
        return llm.DecisioneAutore(
            autore_id_canonico=_CANDIDATO_ID, motivo="forma estesa dello stesso nome"
        )

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    canonico, duplicato, variante, motivo = scritture["fuso"]
    assert canonico == _CANDIDATO_ID
    assert duplicato == _NUOVO_ID
    assert variante == "John Ronald Reuel Tolkien"


def test_id_fuori_dai_candidati_viene_scartato(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Difesa contro un id inventato dal modello: mai fondere un autore
    che non era fra i candidati mostrati."""
    _con_candidato(monkeypatch)

    async def _confronta_autori(nome_nuovo: str, candidati: list[Any]) -> llm.DecisioneAutore:
        return llm.DecisioneAutore(autore_id_canonico="non-era-un-candidato", motivo="?")

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    assert scritture["fuso"] is None


def test_llm_non_disponibile_e_transitorio(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_candidato(monkeypatch)

    async def _confronta_autori(nome_nuovo: str, candidati: list[Any]) -> None:
        raise FonteNonRaggiungibileError("openai", "timeout")

    monkeypatch.setattr(modulo.llm, "confronta_autori", _confronta_autori)

    with pytest.raises(ErroreTransitorio):
        _run(modulo.esegui({"autore_id": _NUOVO_ID, "nome_variante": "John Ronald Reuel Tolkien"}))

    assert scritture["fuso"] is None


def test_su_fallimento_non_scrive_nulla() -> None:
    _run(modulo.su_fallimento({"autore_id": _NUOVO_ID}, "tre timeout"))


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
