"""Client del fornitore di modelli (app/cataloghi/llm.py). Nessuna rete:
le risposte passano da `httpx.MockTransport`, stesso pattern di
test_cataloghi.py e test_lavori_copertine.py.
"""

import asyncio
import json
from dataclasses import dataclass
from typing import Any

import httpx
import pytest

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError


@dataclass
class _SettingsFinte:
    openai_api_key: str | None = "sk-test"


def _con_chiave(monkeypatch: pytest.MonkeyPatch, chiave: str | None = "sk-test") -> None:
    monkeypatch.setattr(llm, "get_settings", lambda: _SettingsFinte(openai_api_key=chiave))


def _con_risposta(monkeypatch: pytest.MonkeyPatch, risposta: httpx.Response) -> list[httpx.Request]:
    """Sostituisce il trasporto, non la funzione: esercita davvero la
    costruzione della richiesta. Ritorna la lista delle richieste inviate,
    per verificare che una chiave assente non generi traffico di rete."""
    inviate: list[httpx.Request] = []

    def _gestisci(richiesta: httpx.Request) -> httpx.Response:
        inviate.append(richiesta)
        return risposta

    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(_gestisci)
        return originale(*args, **kwargs)

    monkeypatch.setattr(llm.httpx, "AsyncClient", _client)
    return inviate


def _risposta_openai(contenuto: dict[str, Any]) -> httpx.Response:
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": json.dumps(contenuto)}}]},
    )


# --- classifica_e_deduci -----------------------------------------------------


def test_classifica_e_deduci_analizza_una_risposta_valida(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        _risposta_openai(
            {
                "generi": ["fantasy", "classics"],
                "anno_prima_pubblicazione": 1954,
                "lingua_originale": "en",
            }
        ),
    )

    risposta = _run(
        llm.classifica_e_deduci(
            titolo="Il Signore degli Anelli",
            autori=["J.R.R. Tolkien"],
            soggetti=["fantasy fiction"],
            generi_ammessi=[("fantasy", "Fantasy"), ("classics", "Classici")],
            necessita_genere=True,
            necessita_anno=True,
            necessita_lingua=True,
        )
    )

    assert risposta.generi == ["fantasy", "classics"]
    assert risposta.anno_prima_pubblicazione == 1954
    assert risposta.lingua_originale == "en"


def test_chiave_assente_non_genera_traffico_di_rete(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch, chiave=None)
    inviate = _con_risposta(monkeypatch, _risposta_openai({}))

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm.classifica_e_deduci(
                titolo="Prova",
                autori=[],
                soggetti=[],
                generi_ammessi=[],
                necessita_genere=True,
                necessita_anno=False,
                necessita_lingua=False,
            )
        )
    assert inviate == []


def test_json_malformato_e_una_fonte_irraggiungibile(monkeypatch: pytest.MonkeyPatch) -> None:
    """Se il modello non risponde nel formato atteso è come se non avesse
    risposto affatto: mai un tentativo di "salvare" un output non valido."""
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        httpx.Response(200, json={"choices": [{"message": {"content": "non è json"}}]}),
    )

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm.classifica_e_deduci(
                titolo="Prova",
                autori=[],
                soggetti=[],
                generi_ammessi=[],
                necessita_genere=True,
                necessita_anno=False,
                necessita_lingua=False,
            )
        )


@pytest.mark.parametrize("stato", [429, 500, 503])
def test_errore_di_trasporto_e_transitorio(monkeypatch: pytest.MonkeyPatch, stato: int) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(monkeypatch, httpx.Response(stato))

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm.classifica_e_deduci(
                titolo="Prova",
                autori=[],
                soggetti=[],
                generi_ammessi=[],
                necessita_genere=True,
                necessita_anno=False,
                necessita_lingua=False,
            )
        )


# --- confronta_autori ---------------------------------------------------------


def test_confronta_autori_nessun_match_e_none(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch, _risposta_openai({"autore_id_canonico": None, "motivo": "persone diverse"})
    )

    decisione = _run(
        llm.confronta_autori(
            "Mario Rossi",
            [llm.CandidatoAutore(autore_id="a1", nome_canonico="Mario Bianchi", varianti=[])],
        )
    )
    assert decisione is None


def test_confronta_autori_match_confidente(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        _risposta_openai({"autore_id_canonico": "a1", "motivo": "forma estesa dello stesso nome"}),
    )

    decisione = _run(
        llm.confronta_autori(
            "John Ronald Reuel Tolkien",
            [llm.CandidatoAutore(autore_id="a1", nome_canonico="J.R.R. Tolkien", varianti=[])],
        )
    )
    assert decisione is not None
    assert decisione.autore_id_canonico == "a1"


# --- valuta_duplicati ----------------------------------------------------------


def test_valuta_duplicati_nessun_match_e_none(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch, _risposta_openai({"libro_id_candidato": None, "motivo": "opere diverse"})
    )

    decisione = _run(
        llm.valuta_duplicati(
            llm.OperaPerConfronto(
                libro_id="n1", titolo="Le notti bianche", autori=[], descrizione=None
            ),
            [
                llm.OperaPerConfronto(
                    libro_id="c1", titolo="Delitto e castigo", autori=[], descrizione=None
                )
            ],
        )
    )
    assert decisione is None


def test_valuta_duplicati_match_confidente(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        _risposta_openai(
            {"libro_id_candidato": "c1", "motivo": "stessa opera, sottotitolo diverso"}
        ),
    )

    decisione = _run(
        llm.valuta_duplicati(
            llm.OperaPerConfronto(
                libro_id="n1", titolo="Le notti bianche", autori=[], descrizione=None
            ),
            [
                llm.OperaPerConfronto(
                    libro_id="c1",
                    titolo="Le notti bianche - La cronaca di Pietroburgo",
                    autori=[],
                    descrizione=None,
                )
            ],
        )
    )
    assert decisione is not None
    assert decisione.libro_id_candidato == "c1"


# --- espandi_descrizione / accorcia_descrizione --------------------------------


def test_espandi_descrizione_analizza_una_risposta_valida(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch, _risposta_openai({"testo": "Versione espansa, 400-600 caratteri."})
    )

    testo = _run(
        llm.espandi_descrizione(
            titolo="Le notti bianche",
            autori=["Fëdor Dostoevskij"],
            anno_prima_pubblicazione=1848,
            generi=["Classici"],
            testo_originale="Le notti bianche è un racconto giovanile di Fëdor Dostoevskij.",
            fonte_originale="wikipedia",
        )
    )
    assert testo == "Versione espansa, 400-600 caratteri."


def test_espandi_descrizione_json_malformato_e_irraggiungibile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        httpx.Response(200, json={"choices": [{"message": {"content": "non è json"}}]}),
    )

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm.espandi_descrizione(
                titolo="Prova",
                autori=[],
                anno_prima_pubblicazione=None,
                generi=[],
                testo_originale="Testo corto.",
                fonte_originale="wikipedia",
            )
        )


def test_accorcia_descrizione_analizza_una_risposta_valida(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch, _risposta_openai({"testo": "Versione accorciata, 400-600 caratteri."})
    )

    testo = _run(
        llm.accorcia_descrizione(
            titolo="Sapiens",
            autori=["Yuval Noah Harari"],
            anno_prima_pubblicazione=2011,
            generi=["Saggi e reportage"],
            testo_originale="x" * 1200,
            fonte_originale="google_books",
        )
    )
    assert testo == "Versione accorciata, 400-600 caratteri."


def test_accorcia_descrizione_json_malformato_e_irraggiungibile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _con_chiave(monkeypatch)
    _con_risposta(
        monkeypatch,
        httpx.Response(200, json={"choices": [{"message": {"content": "non è json"}}]}),
    )

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm.accorcia_descrizione(
                titolo="Prova",
                autori=[],
                anno_prima_pubblicazione=None,
                generi=[],
                testo_originale="x" * 1200,
                fonte_originale="google_books",
            )
        )


def _run(coro: Any) -> Any:
    """`asyncio.run` con un nome che non confligge col discovery di
    pytest — stesso motivo per cui test_lavori_worker.py lo usa al posto
    di `@pytest.mark.asyncio`, non tra le dipendenze [dev]."""
    import asyncio

    return asyncio.run(coro)


def _run(coro: Any) -> Any:
    """`asyncio.run`: pytest-asyncio non e tra le dipendenze [dev]

    Stesso motivo di test_lavori_worker.py.
    """
    return asyncio.run(coro)
