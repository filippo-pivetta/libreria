"""I due lavori dell'indicizzazione semantica (issue #6):
`indicizzazione_semantica` per un contenuto solo,
`ricostruzione_indici` in blocco dopo la riattivazione del consenso.

Il tema di quasi ogni test qui è la **finestra fra l'accodamento e
l'esecuzione**: minuti, durante i quali l'Utente può revocare il consenso
o cancellare l'account. Un lavoro che si fidasse dello stato al momento
dell'accodamento ricreerebbe i vettori che la revoca ha appena cancellato,
cioè la violazione esatta della regola 30.
"""

import asyncio
from typing import Any
from uuid import UUID

import pytest

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.lavori import indicizzazione_semantica, ricostruzione_indici
from app.lavori.errori import ErroreTransitorio
from app.repositories import indicizzazione_repository

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_CONTENUTO_ID = UUID("00000000-0000-0000-0000-0000000000c1")


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


class _Db:
    """Il database finto: la connessione è un oggetto qualunque, perché
    ogni funzione del repository è monkeypatchata."""

    def __init__(self, consenso: bool | None = True) -> None:
        self.consenso = consenso
        self.testi: dict[UUID, str] = {_CONTENUTO_ID: "La memoria come materia narrativa."}
        self.contenuti: list[tuple[str, UUID, str]] = []
        self.scritti: list[tuple[str, UUID, list[float]]] = []
        self.cancellazioni = 0
        self.stati: list[str] = []


@pytest.fixture
def db(monkeypatch: pytest.MonkeyPatch) -> _Db:
    finto = _Db()

    class _Connessione:
        def __enter__(self) -> "_Connessione":
            return self

        def __exit__(self, *args: Any) -> None:
            return None

    for modulo in (indicizzazione_semantica, ricostruzione_indici):
        monkeypatch.setattr(modulo.database, "apri_connessione", _Connessione)

    monkeypatch.setattr(indicizzazione_repository, "consenso_attivo", lambda c, u: finto.consenso)
    monkeypatch.setattr(
        indicizzazione_repository,
        "testo_contenuto",
        lambda c, tipo, cid, u: finto.testi.get(cid),
    )
    monkeypatch.setattr(
        indicizzazione_repository, "contenuti_da_indicizzare", lambda c, u: finto.contenuti
    )
    monkeypatch.setattr(
        indicizzazione_repository,
        "scrivi_embedding",
        lambda c, u, tipo, cid, emb: finto.scritti.append((tipo, cid, emb)),
    )

    def _cancella(c: Any, u: UUID) -> None:
        finto.cancellazioni += 1

    monkeypatch.setattr(indicizzazione_repository, "cancella_indici", _cancella)
    monkeypatch.setattr(
        indicizzazione_repository,
        "imposta_indici_stato",
        lambda c, u, stato: finto.stati.append(stato),
    )
    return finto


def _con_embedding(monkeypatch: pytest.MonkeyPatch, modulo: Any, registro: list[list[str]]) -> None:
    async def _chiama(testi: list[str]) -> list[list[float]]:
        registro.append(testi)
        return [[float(i)] for i in range(len(testi))]

    monkeypatch.setattr(modulo, "chiama_embedding", _chiama)


# --- indicizzazione di un contenuto ------------------------------------------


def test_indicizza_un_insight(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, indicizzazione_semantica, chiamate)

    _run(
        indicizzazione_semantica.esegui(
            {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
        )
    )

    assert chiamate == [["La memoria come materia narrativa."]]
    assert db.scritti == [("insight", _CONTENUTO_ID, [0.0])]


def test_consenso_revocato_dopo_l_accodamento_non_indicizza(
    db: _Db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 30. Non un fallimento: non c'è più nulla da fare, e un
    ritentativo peggiorerebbe soltanto."""
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, indicizzazione_semantica, chiamate)
    db.consenso = False

    _run(
        indicizzazione_semantica.esegui(
            {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
        )
    )

    assert chiamate == []
    assert db.scritti == []


def test_account_cancellato_esce_in_silenzio(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    """PRD: "le richieste pendenti al fornitore di modelli non devono
    poter scrivere dati su un account che non esiste più"."""
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, indicizzazione_semantica, chiamate)
    db.consenso = None

    _run(
        indicizzazione_semantica.esegui(
            {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
        )
    )

    assert chiamate == []
    assert db.scritti == []


def test_contenuto_sparito_non_e_un_fallimento(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, indicizzazione_semantica, chiamate)
    db.testi = {}

    _run(
        indicizzazione_semantica.esegui(
            {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
        )
    )

    assert chiamate == []


def test_revoca_fra_la_chiamata_e_la_scrittura(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    """Il consenso si rilegge anche dopo l'embedding: fra la chiamata al
    fornitore e la scrittura passano secondi, ed è la finestra in cui una
    revoca può cadere."""
    letture = {"n": 0}

    def _consenso(c: Any, u: UUID) -> bool:
        letture["n"] += 1
        return letture["n"] == 1

    monkeypatch.setattr(indicizzazione_repository, "consenso_attivo", _consenso)
    _con_embedding(monkeypatch, indicizzazione_semantica, [])

    _run(
        indicizzazione_semantica.esegui(
            {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
        )
    )

    assert db.scritti == []


def test_fornitore_giu_e_transitorio(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _giu(testi: list[str]) -> list[list[float]]:
        raise FonteNonRaggiungibileError("openai", "HTTP 503")

    monkeypatch.setattr(indicizzazione_semantica, "chiama_embedding", _giu)

    with pytest.raises(ErroreTransitorio):
        _run(
            indicizzazione_semantica.esegui(
                {"utente_id": str(_USER_ID), "tipo": "insight", "contenuto_id": str(_CONTENUTO_ID)}
            )
        )


# --- ricostruzione in blocco -------------------------------------------------


def test_ricostruisce_tutto_e_dichiara_pronti(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    db.contenuti = [
        ("insight", UUID("00000000-0000-0000-0000-0000000000c1"), "primo"),
        ("recensione", UUID("00000000-0000-0000-0000-0000000000c2"), "secondo"),
    ]
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, ricostruzione_indici, chiamate)

    _run(ricostruzione_indici.esegui({"utente_id": str(_USER_ID)}))

    assert chiamate == [["primo", "secondo"]]
    assert len(db.scritti) == 2
    assert db.cancellazioni == 1
    assert db.stati == ["pronti"]


def test_ricostruzione_a_lotti(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ricostruzione_indici, "LOTTO", 2)
    db.contenuti = [("insight", UUID(int=i + 1), f"testo {i}") for i in range(5)]
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, ricostruzione_indici, chiamate)

    _run(ricostruzione_indici.esegui({"utente_id": str(_USER_ID)}))

    assert [len(c) for c in chiamate] == [2, 2, 1]
    assert len(db.scritti) == 5


def test_ricostruzione_di_una_libreria_vuota(db: _Db, monkeypatch: pytest.MonkeyPatch) -> None:
    """Un lettore appena entrato: nessun contenuto, quindi nessuna
    chiamata, ma gli indici sono comunque 'pronti' — non incompleti per
    sempre."""
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, ricostruzione_indici, chiamate)

    _run(ricostruzione_indici.esegui({"utente_id": str(_USER_ID)}))

    assert chiamate == []
    assert db.stati == ["pronti"]


def test_ricostruzione_saltata_se_rispento_nel_frattempo(
    db: _Db, monkeypatch: pytest.MonkeyPatch
) -> None:
    chiamate: list[list[str]] = []
    _con_embedding(monkeypatch, ricostruzione_indici, chiamate)
    db.consenso = False

    _run(ricostruzione_indici.esegui({"utente_id": str(_USER_ID)}))

    assert chiamate == []
    assert db.stati == []
    assert db.cancellazioni == 0


def test_fallimento_non_lascia_in_ricostruzione(db: _Db) -> None:
    """La divergenza che ADR 0016 vuole evitare: la coda direbbe
    "fallito" mentre la ricerca continuerebbe a promettere che gli indici
    stanno arrivando, per sempre."""
    _run(ricostruzione_indici.su_fallimento({"utente_id": str(_USER_ID)}, "openai giù"))

    assert db.stati == ["spenti"]
