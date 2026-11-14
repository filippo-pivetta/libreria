"""Normalizzazione della lingua originale (app/core/lingua_originale.py).

I casi sono quelli trovati nel catalogo di produzione il 14 novembre 2026.
"""

import pytest

from app.cataloghi import llm
from app.core.lingua_originale import CODICI, normalizza


@pytest.mark.parametrize(
    ("valore", "atteso"),
    [
        ("en", "en"),
        ("EN", "en"),
        ("en-US", "en"),
        ("pt_BR", "pt"),
        ("inglese", "en"),
        ("English", "en"),
        ("Amerikanisches Englisch", "en"),
        ("italiano", "it"),
        ("Italian", "it"),
        ("greco antico", "grc"),
        ("Latin", "la"),
        ("eng", "en"),
        ("Tagalog", "tl"),
    ],
)
def test_riconosce_codici_e_nomi(valore: str, atteso: str) -> None:
    assert normalizza(valore) == atteso


@pytest.mark.parametrize("valore", [None, "", "  ", "null", "klingon", 42])
def test_cio_che_non_riconosce_diventa_assente(valore: object) -> None:
    assert normalizza(valore) is None


def test_lo_schema_del_modello_ammette_solo_codici() -> None:
    campo = llm._SCHEMA_ARRICCHIMENTO["properties"]["lingua_originale"]  # type: ignore[index]
    assert set(campo["enum"]) == {*CODICI, None}


def test_ogni_codice_di_wikidata_e_ammesso() -> None:
    """Un codice prodotto da Wikidata e assente da CODICI violerebbe il
    CHECK della migrazione 20261114120000 e farebbe fallire l'aggiunta."""
    from app.cataloghi import wikidata

    assert set(wikidata._LINGUE.values()) <= CODICI
