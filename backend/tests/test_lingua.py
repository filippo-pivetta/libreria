"""Test per la risoluzione della lingua dell'interfaccia (issue #34,
`app/core/lingua.py`): la funzione pura che legge `Accept-Language`, e la
dipendenza FastAPI che la espone ai router.

Nessun mock qui: `_lingua_da_intestazione` non tocca Supabase né alcuna
rete, si presta a un test diretto come `app.core.tempo`/`app.core.testo`.
"""

import asyncio

import pytest

from app.core.lingua import LINGUA_PREDEFINITA, _lingua_da_intestazione, lingua_interfaccia


@pytest.mark.parametrize(
    ("intestazione", "attesa"),
    [
        (None, "it"),
        ("", "it"),
        ("it", "it"),
        ("en", "en"),
        ("it-IT", "it"),
        ("en-US", "en"),
        # Prima lingua supportata nell'ordine di preferenza dichiarato.
        ("en-US,it;q=0.8", "en"),
        ("it;q=0.5,en;q=0.9", "en"),
        # Lingua non supportata sola: ripiega sul predefinito.
        ("fr-FR", "it"),
        # Lingua non supportata prima di una supportata: la salta, non si
        # ferma alla prima intestazione dichiarata.
        ("fr-FR,en;q=0.9", "en"),
        # Qualità malformata: trattata come 0, non fa cadere la funzione.
        ("it;q=nonnumerico,en", "en"),
        # `;q=` presente ma vuoto (malformato, non "assente"): vale qualità
        # 0 come sopra, non 1 — caso limite dove `frontend/src/lib/lingua.ts`
        # divergeva prima di essere corretto (un controllo di verità
        # confondeva "vuoto" con "assente"), fissato qui perché le due
        # implementazioni devono restare identiche anche sui casi limite.
        ("it;q=,en", "en"),
    ],
)
def test_lingua_da_intestazione(intestazione: str | None, attesa: str) -> None:
    assert _lingua_da_intestazione(intestazione) == attesa


def test_lingua_predefinita_e_italiano() -> None:
    # La costante che la funzione usa quando nessuna lingua richiesta è
    # supportata: fissata qui perché un cambiamento silenzioso (es. a
    # "en") sposterebbe la lingua di ogni richiesta senza intestazione,
    # non solo un dettaglio interno.
    assert LINGUA_PREDEFINITA == "it"


def test_dipendenza_lingua_interfaccia_risolve_come_la_funzione_pura() -> None:
    assert asyncio.run(lingua_interfaccia(accept_language="en-GB")) == "en"
    assert asyncio.run(lingua_interfaccia(accept_language=None)) == "it"
