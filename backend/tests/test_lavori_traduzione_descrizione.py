"""Traduzione assistita delle descrizioni mancanti
(app/lavori/traduzione_descrizione.py). Nessun database e nessuna rete:
repository e client del modello sono monkeypatchati, stesso pattern di
test_lavori_standardizzazione_descrizione.py.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import traduzione_descrizione as modulo
from app.lavori.errori import ErroreTransitorio

_LIBRO_ID = "00000000-0000-0000-0000-0000000000c2"
_TESTO_SORGENTE = "White Nights is an early short story by Fyodor Dostoevsky."
_TESTO_TRADOTTO = (
    "Le notti bianche è un racconto giovanile di Fëdor Dostoevskij, pubblicato nel 1848. "
    "Narra l'incontro fra un sognatore solitario e una giovane donna, Nasten'ka, nell'arco "
    "di quattro notti bianche pietroburghesi, esplorando temi di solitudine e desiderio "
    "attraverso una prosa introspettiva e malinconica, tipica della prima produzione "
    "dell'autore prima dei grandi romanzi della maturità."
)
_PAYLOAD = {
    "libro_id": _LIBRO_ID,
    "lingua_mancante": "it",
    "lingua_sorgente": "en",
}


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {"tradotta": None, "accodato": None}
    monkeypatch.setattr(modulo.database, "apri_connessione", lambda: _ConnessioneContesto())
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "contesto_bibliografico",
        lambda conn, libro_id: ("Le notti bianche", ["Fëdor Dostoevskij"], 1848, ["Classici"]),
    )

    def _scrivi_tradotta(
        conn: Any, libro_id: str, lingua: str, testo: str, fonte: str, url_fonte: str | None
    ) -> bool:
        registro["tradotta"] = (libro_id, lingua, testo, fonte, url_fonte)
        return True

    monkeypatch.setattr(modulo.catalogo_repository, "scrivi_descrizione_tradotta", _scrivi_tradotta)
    monkeypatch.setattr(
        modulo.lavoro_repository,
        "accoda",
        lambda conn, tipo, chiave, payload: registro.__setitem__(
            "accodato", (tipo, chiave, payload)
        ),
    )
    return registro


def _con_stato(
    monkeypatch: pytest.MonkeyPatch,
    *,
    testo_mancante: str | None,
    sorgente: tuple[str, str, str | None] | None,
) -> None:
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "leggi_descrizione",
        lambda conn, libro_id, lingua: testo_mancante,
    )
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "leggi_descrizione_con_fonte",
        lambda conn, libro_id, lingua: sorgente,
    )


def _nessuna_chiamata_prevista(monkeypatch: pytest.MonkeyPatch) -> dict[str, bool]:
    chiamato = {"tradotto": False}

    async def _traduci(**kwargs: Any) -> str:
        chiamato["tradotto"] = True
        return "non dovrebbe arrivare qui"

    monkeypatch.setattr(modulo.llm, "traduci_descrizione", _traduci)
    return chiamato


def test_lingua_mancante_gia_riempita_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un'altra fonte (Wikipedia) ha già scritto un testo reale per
    questa lingua fra l'accodamento e l'esecuzione: la traduzione non
    serve più, non è un fallimento."""
    _con_stato(monkeypatch, testo_mancante="Già presente.", sorgente=("x", "wikipedia", None))
    chiamato = _nessuna_chiamata_prevista(monkeypatch)

    _run(modulo.esegui(_PAYLOAD))

    assert chiamato["tradotto"] is False
    assert scritture["tradotta"] is None
    assert scritture["accodato"] is None


def test_lingua_sorgente_sparita_non_chiama_il_modello(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """La riga sorgente può essere sparita fra l'accodamento e
    l'esecuzione (fusione fuori banda?): nulla da tradurre."""
    _con_stato(monkeypatch, testo_mancante=None, sorgente=None)
    chiamato = _nessuna_chiamata_prevista(monkeypatch)

    _run(modulo.esegui(_PAYLOAD))

    assert chiamato["tradotto"] is False
    assert scritture["tradotta"] is None


def test_traduzione_riuscita_eredita_fonte_e_url_dalla_sorgente(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_stato(
        monkeypatch,
        testo_mancante=None,
        sorgente=(_TESTO_SORGENTE, "wikipedia", "https://en.wikipedia.org/wiki/White_Nights"),
    )

    async def _traduci(
        titolo: str,
        autori: list[str],
        testo_sorgente: str,
        lingua_sorgente: str,
        lingua_target: str,
    ) -> str:
        assert titolo == "Le notti bianche"
        assert testo_sorgente == _TESTO_SORGENTE
        assert lingua_sorgente == "en"
        assert lingua_target == "it"
        return _TESTO_TRADOTTO

    monkeypatch.setattr(modulo.llm, "traduci_descrizione", _traduci)

    _run(modulo.esegui(_PAYLOAD))

    libro_id, lingua, testo, fonte, url_fonte = scritture["tradotta"]
    assert (libro_id, lingua, testo) == (_LIBRO_ID, "it", _TESTO_TRADOTTO)
    assert fonte == "wikipedia"
    assert url_fonte == "https://en.wikipedia.org/wiki/White_Nights"
    # Testo nella fascia standard: nessuna standardizzazione da accodare.
    assert scritture["accodato"] is None


def test_traduzione_fuori_standard_accoda_standardizzazione(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_stato(monkeypatch, testo_mancante=None, sorgente=(_TESTO_SORGENTE, "wikipedia", None))

    async def _traduci(**kwargs: Any) -> str:
        return "Testo tradotto troppo corto."

    monkeypatch.setattr(modulo.llm, "traduci_descrizione", _traduci)

    _run(modulo.esegui(_PAYLOAD))

    tipo, chiave, payload = scritture["accodato"]
    assert tipo == "standardizzazione_descrizione"
    assert chiave == f"{_LIBRO_ID}:it"
    assert payload == {"libro_id": _LIBRO_ID, "lingua": "it"}


def test_llm_non_disponibile_e_transitorio_e_non_scrive(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    _con_stato(monkeypatch, testo_mancante=None, sorgente=(_TESTO_SORGENTE, "wikipedia", None))

    async def _traduci(**kwargs: Any) -> str:
        raise FonteNonRaggiungibileError("openai", "timeout")

    monkeypatch.setattr(modulo.llm, "traduci_descrizione", _traduci)

    with pytest.raises(ErroreTransitorio):
        _run(modulo.esegui(_PAYLOAD))

    assert scritture["tradotta"] is None


def test_su_fallimento_non_scrive_nulla() -> None:
    """La lingua resta senza descrizione, come già oggi quando nessuna
    fonte la fornisce."""
    _run(modulo.su_fallimento(_PAYLOAD, "tre timeout"))


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
