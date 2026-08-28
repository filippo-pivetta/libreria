"""Il ciclo dei lavori in secondo piano (app/lavori/worker.py).

Nessun database e nessuna rete: si monkeypatcha il repository della coda e
si esercita `Worker.passo()`, che esiste esattamente per questo — il ciclo
vero è `while not stop: await passo()` e non è testabile senza far girare
qualcosa a tempo indeterminato.

`asyncio.run` invece di `@pytest.mark.asyncio`: `pytest-asyncio` non è tra
le dipendenze `[dev]` del progetto, quindi in CI non esisterebbe.
"""

import asyncio
import time
from datetime import timedelta
from typing import Any

import pytest

from app.lavori import worker as modulo_worker
from app.lavori.errori import ErroreDefinitivo, ErroreTransitorio
from app.lavori.registro import Gestore
from app.lavori.worker import ATTESE, MAX_TENTATIVI, Worker
from app.repositories import lavoro_repository

_LIBRO_ID = "00000000-0000-0000-0000-0000000000e1"


class _ConnessioneFinta:
    """Il minimo che il worker usa di una connessione: la passa ai
    repository (qui monkeypatchati) e la chiude allo spegnimento."""

    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


class _Registratore:
    """Raccoglie le chiamate al repository della coda, al posto del database."""

    def __init__(self) -> None:
        self.riusciti: list[int] = []
        self.falliti: list[tuple[int, str]] = []
        self.rimessi: list[tuple[int, timedelta]] = []
        self.fallimenti_definitivi: list[tuple[dict[str, Any], str]] = []


@pytest.fixture
def coda(monkeypatch: pytest.MonkeyPatch) -> _Registratore:
    registratore = _Registratore()

    monkeypatch.setattr(modulo_worker.database, "apri_connessione", lambda: _ConnessioneFinta())
    monkeypatch.setattr(lavoro_repository, "recupera_orfani", lambda conn, oltre: 0)
    monkeypatch.setattr(
        lavoro_repository,
        "segna_riuscito",
        lambda conn, lavoro_id: registratore.riusciti.append(lavoro_id),
    )
    monkeypatch.setattr(
        lavoro_repository,
        "segna_fallito",
        lambda conn, lavoro_id, errore: registratore.falliti.append((lavoro_id, errore)),
    )
    monkeypatch.setattr(
        lavoro_repository,
        "rimetti_in_coda",
        lambda conn, lavoro_id, errore, riprova_fra: registratore.rimessi.append(
            (lavoro_id, riprova_fra)
        ),
    )
    return registratore


def _accoda_uno(monkeypatch: pytest.MonkeyPatch, tentativi: int = 1, tipo: str = "prova") -> None:
    lavori = [
        {
            "id": 7,
            "tipo": tipo,
            "chiave": _LIBRO_ID,
            "payload": {"libro_id": _LIBRO_ID},
            "tentativi": tentativi,
        }
    ]
    consegnati = {"fatto": False}

    def _prendi(conn: Any, lotto: int) -> list[dict[str, Any]]:
        if consegnati["fatto"]:
            return []
        consegnati["fatto"] = True
        return lavori

    monkeypatch.setattr(lavoro_repository, "prendi_in_carico", _prendi)


def _registra(
    monkeypatch: pytest.MonkeyPatch,
    registratore: _Registratore,
    solleva: Exception | None,
) -> None:
    async def _esegui(payload: dict[str, Any]) -> None:
        if solleva is not None:
            raise solleva

    async def _su_fallimento(payload: dict[str, Any], errore: str) -> None:
        registratore.fallimenti_definitivi.append((payload, errore))

    monkeypatch.setattr(modulo_worker, "GESTORI", {"prova": Gestore(_esegui, _su_fallimento)})


# --- esito riuscito ---------------------------------------------------------


def test_passo_esegue_il_gestore_e_segna_riuscito(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accoda_uno(monkeypatch)
    _registra(monkeypatch, coda, solleva=None)

    svolti = asyncio.run(Worker(intervallo=0.01).passo())

    assert svolti == 1
    assert coda.riusciti == [7]
    assert coda.falliti == []
    assert coda.rimessi == []


# --- fallimento transitorio -------------------------------------------------


def test_errore_transitorio_rimette_in_coda_con_la_prima_attesa(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accoda_uno(monkeypatch, tentativi=1)
    _registra(monkeypatch, coda, solleva=ErroreTransitorio("timeout"))

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.rimessi == [(7, ATTESE[0])]
    assert coda.falliti == []
    assert coda.fallimenti_definitivi == []


def test_errore_transitorio_usa_attese_crescenti(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accoda_uno(monkeypatch, tentativi=2)
    _registra(monkeypatch, coda, solleva=ErroreTransitorio("timeout"))

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.rimessi == [(7, ATTESE[1])]


def test_esaurimento_tentativi_segna_fallito_e_avvisa_il_gestore(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """All'ultimo tentativo il gestore ha già sollevato: senza il gancio di
    fallimento definitivo, la coda direbbe 'fallito' e la scheda resterebbe
    'in_attesa' per sempre."""
    _accoda_uno(monkeypatch, tentativi=MAX_TENTATIVI)
    _registra(monkeypatch, coda, solleva=ErroreTransitorio("timeout"))

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.rimessi == []
    assert [id_ for id_, _ in coda.falliti] == [7]
    assert len(coda.fallimenti_definitivi) == 1
    assert coda.fallimenti_definitivi[0][0]["libro_id"] == _LIBRO_ID


# --- fallimento definitivo --------------------------------------------------


def test_errore_definitivo_non_riprova_mai(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PRD, copertina assente alla fonte: "senza ulteriori tentativi
    automatici". È il test che protegge quella regola."""
    _accoda_uno(monkeypatch, tentativi=1)
    _registra(monkeypatch, coda, solleva=ErroreDefinitivo("404"))

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.rimessi == []
    assert [id_ for id_, _ in coda.falliti] == [7]
    assert len(coda.fallimenti_definitivi) == 1


def test_errore_non_previsto_e_trattato_come_definitivo(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un difetto del gestore non deve far girare in cerchio la coda."""
    _accoda_uno(monkeypatch, tentativi=1)
    _registra(monkeypatch, coda, solleva=ValueError("difetto"))

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.rimessi == []
    assert [id_ for id_, _ in coda.falliti] == [7]


def test_tipo_senza_gestore_fallisce_subito(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accoda_uno(monkeypatch, tipo="sconosciuto")
    _registra(monkeypatch, coda, solleva=None)

    asyncio.run(Worker(intervallo=0.01).passo())

    assert coda.riusciti == []
    assert [id_ for id_, _ in coda.falliti] == [7]
    assert "Nessun gestore" in coda.falliti[0][1]


# --- ciclo di vita ----------------------------------------------------------


def test_ferma_interrompe_l_attesa_senza_aspettarne_la_fine(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`_attendi` usa un evento e non `asyncio.sleep`: lo spegnimento non
    deve costare un intervallo intero."""
    monkeypatch.setattr(lavoro_repository, "prendi_in_carico", lambda conn, lotto: [])

    async def _prova() -> float:
        worker = Worker(intervallo=30.0)
        await worker.avvia()
        await asyncio.sleep(0.05)
        inizio = time.monotonic()
        await worker.ferma(timeout=5.0)
        return time.monotonic() - inizio

    assert asyncio.run(_prova()) < 1.0


def test_avvio_doppio_e_un_errore(coda: _Registratore, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lavoro_repository, "prendi_in_carico", lambda conn, lotto: [])

    async def _prova() -> None:
        worker = Worker(intervallo=30.0)
        await worker.avvia()
        try:
            with pytest.raises(RuntimeError):
                await worker.avvia()
        finally:
            await worker.ferma(timeout=5.0)

    asyncio.run(_prova())


# --- lotto in parallelo -----------------------------------------------------


def _accoda_molti(monkeypatch: pytest.MonkeyPatch, quanti: int) -> None:
    lavori = [
        {
            "id": i,
            "tipo": "prova",
            "chiave": _LIBRO_ID,
            "payload": {"libro_id": _LIBRO_ID},
            "tentativi": 1,
        }
        for i in range(quanti)
    ]
    consegnati = {"fatto": False}

    def _prendi(conn: Any, lotto: int) -> list[dict[str, Any]]:
        if consegnati["fatto"]:
            return []
        consegnati["fatto"] = True
        return lavori[:lotto]

    monkeypatch.setattr(lavoro_repository, "prendi_in_carico", _prendi)


def test_il_lotto_si_svolge_in_parallelo(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Tre lavori da 50ms di attesa ciascuno: in serie sarebbero 150ms, in
    parallelo poco più di 50.

    Il tempo è la sola cosa che distingua i due comportamenti dall'esterno,
    e il margine è largo (due volte il minimo teorico) perché la misura non
    diventi il test più fragile della suite.
    """
    _accoda_molti(monkeypatch, 3)

    async def _esegui(payload: dict[str, Any]) -> None:
        await asyncio.sleep(0.05)

    async def _su_fallimento(payload: dict[str, Any], errore: str) -> None:
        return None

    monkeypatch.setattr(modulo_worker, "GESTORI", {"prova": Gestore(_esegui, _su_fallimento)})

    inizio = time.monotonic()
    svolti = asyncio.run(Worker(intervallo=0.01, lotto=3).passo())
    durata = time.monotonic() - inizio

    assert svolti == 3
    assert sorted(coda.riusciti) == [0, 1, 2]
    assert durata < 0.10


def test_un_lavoro_che_esplode_non_lascia_a_metà_i_fratelli(
    coda: _Registratore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`gather` che propaga subito NON ferma le altre coroutine: il ciclo
    chiuderebbe la connessione mentre un fratello la sta ancora usando.

    Qui il primo lavoro fallisce in un modo che nemmeno `_esegui` cattura
    (l'errore arriva dalla scrittura sulla coda, non dal gestore), e si
    verifica che gli altri due siano comunque arrivati in fondo prima che
    l'errore emerga.
    """
    _accoda_molti(monkeypatch, 3)
    finiti: list[int] = []

    async def _esegui(payload: dict[str, Any]) -> None:
        await asyncio.sleep(0.01)

    async def _su_fallimento(payload: dict[str, Any], errore: str) -> None:
        return None

    monkeypatch.setattr(modulo_worker, "GESTORI", {"prova": Gestore(_esegui, _su_fallimento)})

    def _segna_riuscito(conn: Any, lavoro_id: int) -> None:
        if lavoro_id == 0:
            raise RuntimeError("connessione caduta")
        finiti.append(lavoro_id)

    monkeypatch.setattr(lavoro_repository, "segna_riuscito", _segna_riuscito)

    with pytest.raises(RuntimeError):
        asyncio.run(Worker(intervallo=0.01, lotto=3).passo())

    assert sorted(finiti) == [1, 2]
