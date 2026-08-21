"""Classificazione genere e deduzione anno/lingua assistite
(app/lavori/arricchimento_bibliografico.py). Nessun database e nessuna
rete: repository e client del modello sono monkeypatchati, stesso
pattern di test_lavori_copertine.py e test_lavori_worker.py.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import arricchimento_bibliografico as modulo
from app.lavori.errori import ErroreTransitorio

_LIBRO_ID = "00000000-0000-0000-0000-0000000000e1"
_GENERI_AMMESSI = [("fantasy", "Fantasy"), ("classics", "Classici"), ("history", "Storia")]


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    registro: dict[str, Any] = {"scritto": None}
    monkeypatch.setattr(modulo.database, "apri_connessione", lambda: _ConnessioneContesto())
    monkeypatch.setattr(modulo.catalogo_repository, "generi_ammessi", lambda conn: _GENERI_AMMESSI)
    monkeypatch.setattr(
        modulo.catalogo_repository,
        "scrivi_arricchimento_bibliografico",
        lambda conn, libro_id, generi, anno, lingua: registro.__setitem__(
            "scritto", (libro_id, generi, anno, lingua)
        ),
    )
    return registro


def test_scrive_solo_i_generi_ammessi_e_tronca_al_massimo(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un id inventato dal modello va scartato con un log, mai propagato:
    il vincolo del database (libro_genere.genere_id references genere)
    farebbe comunque fallire l'INSERT, ma non deve far fallire l'intero
    lavoro per un solo genere fuori dall'elenco chiuso."""

    async def _classifica_e_deduci(**kwargs: Any) -> llm.RispostaArricchimento:
        return llm.RispostaArricchimento(
            generi=["fantasy", "classics", "history", "genere_inventato"],
            anno_prima_pubblicazione=1954,
            lingua_originale="en",
        )

    monkeypatch.setattr(modulo.llm, "classifica_e_deduci", _classifica_e_deduci)

    _run(
        modulo.esegui(
            {
                "libro_id": _LIBRO_ID,
                "titolo": "Il Signore degli Anelli",
                "autori": ["J.R.R. Tolkien"],
                "soggetti": ["fantasy fiction"],
                "necessita": {"genere": True, "anno": True, "lingua": True},
            }
        )
    )

    libro_id, generi, anno, lingua = scritture["scritto"]
    assert libro_id == _LIBRO_ID
    # MASSIMO_GENERI = 3: troncato, "genere_inventato" scartato a monte.
    assert generi == ["fantasy", "classics", "history"]
    assert anno == 1954
    assert lingua == "en"


def test_llm_non_disponibile_e_transitorio_e_non_scrive(
    scritture: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _classifica_e_deduci(**kwargs: Any) -> llm.RispostaArricchimento:
        raise FonteNonRaggiungibileError("openai", "timeout")

    monkeypatch.setattr(modulo.llm, "classifica_e_deduci", _classifica_e_deduci)

    with pytest.raises(ErroreTransitorio):
        _run(modulo.esegui({"libro_id": _LIBRO_ID, "necessita": {"genere": True}}))

    assert scritture["scritto"] is None


def test_su_fallimento_non_scrive_nulla() -> None:
    """ "Non tentato" e "tentato e fallito" restano intenzionalmente
    indistinguibili: "non classificato" è già lo stato terminale visibile
    in entrambi i casi (PRD)."""
    _run(modulo.su_fallimento({"libro_id": _LIBRO_ID}, "tre timeout"))


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
