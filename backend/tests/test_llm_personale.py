"""Le funzioni personali del fornitore di modelli
(`app/cataloghi/llm_personale.py`) e il trasporto degli embedding
(`app/cataloghi/openai_client.py`), issue #6. Nessuna rete: il trasporto
è finto (tests/openai_finto.py).

Questi test guardano il **corpo inviato** più di quanto guardino la
risposta: è qui che vive la garanzia della regola 19, e una firma
tipizzata che riceve solo dati del richiedente non serve a nulla se poi
il prompt aggiunge qualcosa di suo.
"""

import asyncio
import json
from typing import Any

import httpx
import pytest

from app.cataloghi import llm_personale
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.cataloghi.openai_client import chiama_embedding
from tests.openai_finto import con_chiave, con_risposta, risposta_chat, risposta_embedding


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


# --- embedding ---------------------------------------------------------------


def test_embedding_riordina_per_indice(monkeypatch: pytest.MonkeyPatch) -> None:
    """L'API dichiara l'ordine nel campo `index`, non nell'ordine di
    arrivo: due vettori scambiati indicizzerebbero ogni insight sotto il
    significato di un altro, e nessun test di ricerca se ne accorgerebbe
    finché i testi non sono simili."""
    con_chiave(monkeypatch)
    con_risposta(
        monkeypatch,
        httpx.Response(
            200,
            json={
                "data": [
                    {"index": 1, "embedding": [0.9]},
                    {"index": 0, "embedding": [0.1]},
                ]
            },
        ),
    )

    assert _run(chiama_embedding(["primo", "secondo"])) == [[0.1], [0.9]]


def test_embedding_manda_un_lotto_solo(monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_embedding([0.1], [0.2], [0.3]))

    _run(chiama_embedding(["a", "b", "c"]))

    assert len(inviate) == 1
    corpo = json.loads(inviate[0].content)
    assert corpo["input"] == ["a", "b", "c"]
    assert corpo["model"] == "text-embedding-3-small"


def test_embedding_elenco_vuoto_non_genera_traffico(monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_embedding([0.1]))

    assert _run(chiama_embedding([])) == []
    assert inviate == []


def test_embedding_conteggio_sbagliato_e_fonte_irraggiungibile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Meno vettori che testi significherebbe accoppiarli a caso: come un
    JSON fuori schema, si tratta come una fonte che non ha risposto
    (docs/adr/0017)."""
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_embedding([0.1]))

    with pytest.raises(FonteNonRaggiungibileError):
        _run(chiama_embedding(["a", "b"]))


def test_embedding_senza_chiave_non_genera_traffico(monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch, chiave=None)
    inviate = con_risposta(monkeypatch, risposta_embedding([0.1]))

    with pytest.raises(FonteNonRaggiungibileError):
        _run(chiama_embedding(["a"]))
    assert inviate == []


# --- preview -----------------------------------------------------------------


# Stessa forma del profilo dei suggerimenti (`profilo_lettura.classifica`):
# un pilastro con voto alto e un insight legato al libro da cui viene, non
# più uno storico piatto per conto suo (issue #6 riallineata il 24 agosto
# 2026, vedi il docstring di `preview_service.py`).
def _pilastro(titolo: str, insight: str) -> dict[str, Any]:
    return {
        "voce_id": f"voce-{titolo}",
        "stato": "letto",
        "titolo": titolo,
        "autori": ["Italo Calvino"],
        "generi": ["Classici"],
        "descrizione": None,
        "voto": 4.5,
        "recensione": None,
        "insight": [insight],
        "data_conclusa": "2024-01-01",
        "data_abbandonata": None,
    }


def test_preview_invia_solo_cio_che_riceve(monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "Direi di sì."}))

    _run(
        llm_personale.genera_preview(
            titolo="Le città invisibili",
            autori=["Italo Calvino"],
            generi=["Classici"],
            anno_prima_pubblicazione=1972,
            descrizione="Un dialogo fra Marco Polo e Kublai Khan.",
            pilastri=[_pilastro("Il barone rampante", "Mi piace quando gioca con la struttura.")],
            recenti=[],
            delusi=[],
        )
    )

    corpo = json.loads(inviate[0].content)
    testo_inviato = " ".join(m["content"] for m in corpo["messages"])
    assert "Le città invisibili" in testo_inviato
    assert "Il barone rampante" in testo_inviato
    assert "Mi piace quando gioca con la struttura." in testo_inviato
    # Il vincolo della regola 20 è chiesto nel prompt, oltre che
    # verificato dal service.
    assert "OTTANTA PAROLE" in testo_inviato


def test_preview_senza_profilo_non_inventa_contesto(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un lettore appena entrato non ha profilo: il prompt deve dirlo
    esplicitamente in tutti e tre i gruppi, non lasciare una sezione
    vuota che il modello riempirebbe da sé."""
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "Non ho abbastanza da dire."}))

    _run(
        llm_personale.genera_preview(
            titolo="Un titolo",
            autori=[],
            generi=[],
            anno_prima_pubblicazione=None,
            descrizione=None,
            pilastri=[],
            recenti=[],
            delusi=[],
        )
    )

    corpo = json.loads(inviate[0].content)
    testo_inviato = corpo["messages"][1]["content"]
    assert testo_inviato.count("(nessuno)") == 3


def test_preview_senza_chiave_non_genera_traffico(monkeypatch: pytest.MonkeyPatch) -> None:
    con_chiave(monkeypatch, chiave=None)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "x"}))

    with pytest.raises(FonteNonRaggiungibileError):
        _run(
            llm_personale.genera_preview(
                titolo="t",
                autori=[],
                generi=[],
                anno_prima_pubblicazione=None,
                descrizione=None,
                pilastri=[],
                recenti=[],
                delusi=[],
            )
        )
    assert inviate == []
