"""Il fornitore di modelli, finto, per i test che lo attraversano.

Sostituisce il **trasporto** e non le funzioni del client: la
costruzione della richiesta viene eseguita davvero, e la lista delle
richieste inviate resta ispezionabile — è l'unico modo di scrivere il
test della regola 19 ("ispezionare il contenuto inviato"), che va fatto
sul corpo HTTP reale e non su ciò che il service crede di aver passato.

Stava dentro test_llm.py fino all'issue #6, quando i moduli che parlano
con OpenAI sono diventati due (`llm`, `llm_personale`) sopra un
trasporto solo (`openai_client`).
"""

import json
from dataclasses import dataclass
from typing import Any

import httpx
import pytest

from app.cataloghi import openai_client


@dataclass
class SettingsFinte:
    openai_api_key: str | None = "sk-test"


def con_chiave(monkeypatch: pytest.MonkeyPatch, chiave: str | None = "sk-test") -> None:
    monkeypatch.setattr(openai_client, "get_settings", lambda: SettingsFinte(openai_api_key=chiave))


def con_risposta(monkeypatch: pytest.MonkeyPatch, *risposte: httpx.Response) -> list[httpx.Request]:
    """Le risposte si consumano in ordine; l'ultima resta valida per le
    chiamate successive (i test che ne fanno una sola ne passano una).
    Ritorna la lista delle richieste inviate."""
    inviate: list[httpx.Request] = []
    coda = list(risposte)

    def _gestisci(richiesta: httpx.Request) -> httpx.Response:
        inviate.append(richiesta)
        return coda.pop(0) if len(coda) > 1 else coda[0]

    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(_gestisci)
        return originale(*args, **kwargs)

    monkeypatch.setattr(openai_client.httpx, "AsyncClient", _client)
    return inviate


def risposta_chat(contenuto: dict[str, Any]) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(contenuto)}}]})


def risposta_embedding(*vettori: list[float]) -> httpx.Response:
    return httpx.Response(
        200,
        json={"data": [{"index": i, "embedding": v} for i, v in enumerate(vettori)]},
    )
