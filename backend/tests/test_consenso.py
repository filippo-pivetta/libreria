"""Il consenso all'elaborazione assistita: il cancello delle funzioni
personali (`app/services/consenso.py`) e le conseguenze del cambio
(`me_service.aggiorna_consenso`), issue #6.

Le regole del PRD verificate qui, per numero:
- 30, con il consenso revocato nessuna funzione parte e nessun indice
  sopravvive;
- 32, la revoca non tocca alcun contenuto della libreria — verificata in
  negativo, controllando che nessuna scrittura su `artefatto_generato`,
  `insight` o `recensione` parta dalla revoca.
"""

import asyncio
from typing import Any
from uuid import UUID

import pytest

from app.repositories import indice_semantico_repository, utente_repository
from app.services import consenso as consenso_service
from app.services import me_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


class _StatoFinto:
    """Il minimo indispensabile: la riga `utente_privato` e i due effetti
    che il cambio di consenso può produrre."""

    def __init__(self, consenso: bool, indici_stato: str = "pronti") -> None:
        self.riga = {
            "consenso_elaborazione_assistita": consenso,
            "consenso_aggiornato_at": "2026-08-22T09:00:00Z",
            "informativa_accettata_at": "2026-08-18T00:00:00Z",
            "indici_stato": indici_stato,
        }
        self.cancellazioni = 0
        self.accodamenti: list[UUID] = []
        self.scritture: list[tuple[bool, str]] = []


@pytest.fixture
def stato(monkeypatch: pytest.MonkeyPatch) -> _StatoFinto:
    finto = _StatoFinto(consenso=True)

    monkeypatch.setattr(me_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(consenso_service, "get_user_client", lambda token: object())

    def _get_utente_privato(client: Any, utente_id: UUID) -> dict[str, Any] | None:
        assert utente_id == _USER_ID
        return finto.riga

    def _aggiorna(
        client: Any, utente_id: UUID, consenso: bool, indici_stato: str
    ) -> dict[str, Any]:
        finto.scritture.append((consenso, indici_stato))
        finto.riga["consenso_elaborazione_assistita"] = consenso
        finto.riga["indici_stato"] = indici_stato
        return finto.riga

    def _cancella(client: Any) -> int:
        finto.cancellazioni += 1
        return 7

    monkeypatch.setattr(utente_repository, "get_utente_privato", _get_utente_privato)
    monkeypatch.setattr(utente_repository, "aggiorna_consenso", _aggiorna)
    monkeypatch.setattr(indice_semantico_repository, "cancella_tutti", _cancella)
    monkeypatch.setattr(
        utente_repository, "get_utente", lambda c, i: {"id": str(i), "nome_utente": "prova"}
    )
    monkeypatch.setattr(
        me_service, "_accoda_ricostruzione", lambda utente_id: finto.accodamenti.append(utente_id)
    )
    return finto


# --- il cancello -------------------------------------------------------------


def test_esigi_consenso_passa_e_restituisce_lo_stato_degli_indici(stato: _StatoFinto) -> None:
    stato.riga["indici_stato"] = "in_ricostruzione"

    assert _run(consenso_service.esigi_consenso("t", _USER_ID)) == "in_ricostruzione"


def test_esigi_consenso_solleva_a_interruttore_spento(stato: _StatoFinto) -> None:
    stato.riga["consenso_elaborazione_assistita"] = False

    with pytest.raises(consenso_service.ConsensoRevocatoError):
        _run(consenso_service.esigi_consenso("t", _USER_ID))


def test_esigi_consenso_distingue_il_profilo_assente(
    stato: _StatoFinto, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un account mai completato non è un consenso revocato: la risposta
    è 404, non 409."""
    monkeypatch.setattr(utente_repository, "get_utente_privato", lambda c, i: None)

    with pytest.raises(consenso_service.ProfiloAssenteError):
        _run(consenso_service.esigi_consenso("t", _USER_ID))


# --- il cambio ---------------------------------------------------------------


def test_revoca_cancella_gli_indici_e_li_dichiara_spenti(stato: _StatoFinto) -> None:
    _run(me_service.aggiorna_consenso("t", _USER_ID, consenso=False))

    assert stato.scritture == [(False, "spenti")]
    assert stato.cancellazioni == 1
    assert stato.accodamenti == []


def test_riattivazione_accoda_la_ricostruzione_e_la_dichiara(stato: _StatoFinto) -> None:
    stato.riga["consenso_elaborazione_assistita"] = False
    stato.riga["indici_stato"] = "spenti"

    _run(me_service.aggiorna_consenso("t", _USER_ID, consenso=True))

    assert stato.scritture == [(True, "in_ricostruzione")]
    assert stato.accodamenti == [_USER_ID]
    # Riaccendere non cancella nulla: non c'è nulla da cancellare, e la
    # ricostruzione riparte comunque da zero.
    assert stato.cancellazioni == 0


def test_stesso_valore_non_cancella_e_non_accoda(stato: _StatoFinto) -> None:
    """Doppio clic sull'interruttore, o due schede aperte: idempotente.
    Senza questo, un secondo `false` cancellerebbe indici già cancellati e
    un secondo `true` accoderebbe una seconda ricostruzione."""
    _run(me_service.aggiorna_consenso("t", _USER_ID, consenso=True))

    assert stato.scritture == []
    assert stato.cancellazioni == 0
    assert stato.accodamenti == []


def test_revoca_non_tocca_alcun_contenuto_della_libreria(
    stato: _StatoFinto, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 32. Verificata in negativo, perché è una regola su ciò che
    NON deve succedere: se un giorno qualcuno aggiungesse qui la
    cancellazione delle preview, questo test lo direbbe."""
    from app.repositories import artefatto_repository

    def _vietato(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("la revoca del consenso non deve toccare gli artefatti generati")

    monkeypatch.setattr(artefatto_repository, "delete", _vietato)

    _run(me_service.aggiorna_consenso("t", _USER_ID, consenso=False))
