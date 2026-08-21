"""Standardizzazione delle descrizioni fuori standard
(app/lavori/standardizzazione_descrizione.py). Nessun database e nessuna
rete: repository e client del modello sono monkeypatchati, stesso
pattern di test_lavori_copertine.py.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import standardizzazione_descrizione as modulo
from app.lavori.errori import ErroreTransitorio

_LIBRO_ID = "00000000-0000-0000-0000-0000000000c1"
_TESTO_CORTO = "Le notti bianche è un racconto giovanile di Fëdor Dostoevskij."
_TESTO_NELLA_FASCIA = "x" * 400
_TESTO_LUNGO = "x" * 1200


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {"scritto": None}
    monkeypatch.setattr(modulo.database, "apri_connessione", lambda: _ConnessioneContesto())
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "contesto_bibliografico",
        lambda conn, libro_id: ("Le notti bianche", ["Fëdor Dostoevskij"], 1848, ["Classici"]),
    )
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "scrivi_descrizione_riformulata",
        lambda conn, libro_id, lingua, testo: registro.__setitem__(
            "scritto", (libro_id, lingua, testo)
        ),
    )
    return registro


def _con_testo_corrente(monkeypatch: pytest.MonkeyPatch, testo: str | None) -> None:
    monkeypatch.setattr(
        modulo.catalogo_repository, "leggi_descrizione", lambda conn, libro_id, lingua: testo
    )


def _nessuna_chiamata_prevista(monkeypatch: pytest.MonkeyPatch) -> dict[str, bool]:
    chiamato = {"espandi": False, "accorcia": False}

    async def _espandi(**kwargs: Any) -> str:
        chiamato["espandi"] = True
        return "non dovrebbe arrivare qui"

    async def _accorcia(**kwargs: Any) -> str:
        chiamato["accorcia"] = True
        return "non dovrebbe arrivare qui"

    monkeypatch.setattr(modulo.llm, "espandi_descrizione", _espandi)
    monkeypatch.setattr(modulo.llm, "accorcia_descrizione", _accorcia)
    return chiamato


def test_nessuna_riga_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """La riga può essere sparita fra l'accodamento e l'esecuzione (es.
    una fusione fuori banda): nulla da standardizzare, non un fallimento."""
    _con_testo_corrente(monkeypatch, None)
    chiamato = _nessuna_chiamata_prevista(monkeypatch)

    _run(modulo.esegui({"libro_id": _LIBRO_ID, "lingua": "it"}))

    assert chiamato == {"espandi": False, "accorcia": False}
    assert scritture["scritto"] is None


def test_testo_gia_nella_fascia_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un'altra fonte l'ha già sostituita con una versione nella fascia
    giusta fra l'accodamento e l'esecuzione (es. Wikipedia dopo Google
    Books): non c'è più nulla fuori standard da toccare."""
    _con_testo_corrente(monkeypatch, _TESTO_NELLA_FASCIA)
    chiamato = _nessuna_chiamata_prevista(monkeypatch)

    _run(modulo.esegui({"libro_id": _LIBRO_ID, "lingua": "it"}))

    assert chiamato == {"espandi": False, "accorcia": False}
    assert scritture["scritto"] is None


def test_testo_corto_viene_espanso(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_testo_corrente(monkeypatch, _TESTO_CORTO)
    chiamato = {"accorcia": False}

    async def _espandi(
        titolo: str,
        autori: list[str],
        anno_prima_pubblicazione: int | None,
        generi: list[str],
        testo_originale: str,
        fonte_originale: str,
    ) -> str:
        assert titolo == "Le notti bianche"
        assert testo_originale == _TESTO_CORTO
        return "Versione espansa, 400-600 caratteri."

    async def _accorcia(**kwargs: Any) -> str:
        chiamato["accorcia"] = True
        return "non dovrebbe arrivare qui"

    monkeypatch.setattr(modulo.llm, "espandi_descrizione", _espandi)
    monkeypatch.setattr(modulo.llm, "accorcia_descrizione", _accorcia)

    _run(modulo.esegui({"libro_id": _LIBRO_ID, "lingua": "it"}))

    assert chiamato["accorcia"] is False
    libro_id, lingua, testo = scritture["scritto"]
    assert (libro_id, lingua, testo) == (_LIBRO_ID, "it", "Versione espansa, 400-600 caratteri.")


def test_testo_lungo_viene_accorciato(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_testo_corrente(monkeypatch, _TESTO_LUNGO)
    chiamato = {"espandi": False}

    async def _espandi(**kwargs: Any) -> str:
        chiamato["espandi"] = True
        return "non dovrebbe arrivare qui"

    async def _accorcia(
        titolo: str,
        autori: list[str],
        anno_prima_pubblicazione: int | None,
        generi: list[str],
        testo_originale: str,
        fonte_originale: str,
    ) -> str:
        assert testo_originale == _TESTO_LUNGO
        return "Versione accorciata, 400-600 caratteri."

    monkeypatch.setattr(modulo.llm, "espandi_descrizione", _espandi)
    monkeypatch.setattr(modulo.llm, "accorcia_descrizione", _accorcia)

    _run(modulo.esegui({"libro_id": _LIBRO_ID, "lingua": "it"}))

    assert chiamato["espandi"] is False
    libro_id, lingua, testo = scritture["scritto"]
    assert (libro_id, lingua, testo) == (
        _LIBRO_ID,
        "it",
        "Versione accorciata, 400-600 caratteri.",
    )


def test_llm_non_disponibile_e_transitorio_e_non_scrive(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_testo_corrente(monkeypatch, _TESTO_CORTO)

    async def _espandi(**kwargs: Any) -> str:
        raise FonteNonRaggiungibileError("openai", "timeout")

    monkeypatch.setattr(modulo.llm, "espandi_descrizione", _espandi)

    with pytest.raises(ErroreTransitorio):
        _run(modulo.esegui({"libro_id": _LIBRO_ID, "lingua": "it"}))

    assert scritture["scritto"] is None


def test_su_fallimento_non_scrive_nulla() -> None:
    """La descrizione sorgente, per quanto fuori standard, resta quella
    della fonte: una standardizzazione fallita non deve peggiorare ciò
    che c'è."""
    _run(modulo.su_fallimento({"libro_id": _LIBRO_ID, "lingua": "it"}, "tre timeout"))


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
