"""Il trasporto verso OpenAI: costruire la richiesta, leggere la risposta,
tradurre ogni fallimento in `FonteNonRaggiungibileError` (docs/adr/0017).

Non sa nulla di dominio e non espone nessuna funzione che un chiamante
debba invocare direttamente: sopra di lui stanno due moduli, e la
distinzione fra i due è la regola 19 del PRD resa leggibile a colpo
d'occhio.

    llm.py            funzioni bibliografiche: solo dato di catalogo
                      condiviso, sempre attive, fuori dal consenso
    llm_personale.py  funzioni personali: contenuti del solo Utente che
                      ha chiesto l'operazione, mai di un altro, mai la
                      nota di intenzione — subordinate al consenso

Estratto da `llm.py` con l'issue #6: fino ad allora c'era una sola
categoria di chiamate e il trasporto stava dentro il modulo che le
faceva. Il corpo di `chiama_json` è quello di `llm._chiama`, invariato,
perché ADR 0017 descrive esattamente questo comportamento e non è stata
ribaltata.
"""

import json
import logging
from typing import Any

import httpx

from app.cataloghi import agente
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.config import get_settings

logger = logging.getLogger("app.cataloghi.openai")

FONTE = "openai"

_URL_CHAT = "https://api.openai.com/v1/chat/completions"
_URL_EMBEDDINGS = "https://api.openai.com/v1/embeddings"

MODELLO = "gpt-4o-mini"
"""Economico e capace di structured output: le chiamate di questo
prodotto sono classificazioni, confronti e sintesi su testo breve, non
generazione lunga. Nessun tetto di spesa nel sistema (PRD, "il controllo
è manuale"), motivo in più per non pagare un modello più caro."""

MODELLO_EMBEDDING = "text-embedding-3-small"
"""1536 dimensioni, come la colonna `indice_semantico.embedding`
(docs/adr/0018). Cambiarlo richiede un ALTER COLUMN e una ricostruzione
in blocco di tutti gli indici, non una riga di configurazione."""

# 20s e non gli 8-15s delle fonti bibliografiche: generare una risposta
# strutturata prende sistematicamente più tempo di un lookup. Nessun retry
# qui dentro: vive già nel worker (30s/120s/600s, MAX_TENTATIVI=3).
_TIMEOUT = httpx.Timeout(20.0)


async def _posta(url: str, corpo: dict[str, Any]) -> Any:
    settings = get_settings()
    if not settings.openai_api_key:
        raise FonteNonRaggiungibileError(FONTE, "OPENAI_API_KEY non configurata.")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=agente.intestazioni()) as client:
            risposta = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=corpo,
            )
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(FONTE, errore) from errore

    if risposta.status_code == 429 or risposta.status_code >= 500:
        raise FonteNonRaggiungibileError(FONTE, f"HTTP {risposta.status_code}")
    if risposta.status_code >= 400:
        # 4xx diverso da 429 (chiave rifiutata, richiesta malformata): non
        # tecnicamente diverso da "la fonte non risponde" per chi chiama,
        # ma vale un log a livello più alto per accorgersene.
        logger.warning("OpenAI ha risposto %s: %s", risposta.status_code, risposta.text[:500])
        raise FonteNonRaggiungibileError(FONTE, f"HTTP {risposta.status_code}")

    try:
        return risposta.json()
    except ValueError as errore:
        raise FonteNonRaggiungibileError(FONTE, f"risposta non in JSON: {errore}") from errore


async def chiama_json(
    messaggi: list[dict[str, str]], schema: dict[str, Any], nome_schema: str
) -> Any:
    """Una risposta conforme a `schema`, già deserializzata.

    Un JSON malformato o fuori schema è trattato come
    `FonteNonRaggiungibileError`, esattamente come una fonte
    irraggiungibile: se il modello non risponde nella forma richiesta è
    come se non avesse risposto affatto, mai un tentativo di "salvare" un
    output non valido (docs/adr/0017)."""
    corpo = {
        "model": MODELLO,
        "messages": messaggi,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": nome_schema, "strict": True, "schema": schema},
        },
    }
    corpo_risposta = await _posta(_URL_CHAT, corpo)
    try:
        contenuto = corpo_risposta["choices"][0]["message"]["content"]
        return json.loads(contenuto)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as errore:
        raise FonteNonRaggiungibileError(
            FONTE, f"risposta non nel formato atteso: {errore}"
        ) from errore


async def chiama_embedding(testi: list[str]) -> list[list[float]]:
    """Un vettore per testo, nello stesso ordine.

    Un lotto solo e non una chiamata per testo: la ricostruzione in blocco
    degli indici alla riattivazione del consenso può avere centinaia di
    contenuti da indicizzare, e l'API accetta un elenco. L'ordine dei
    risultati è garantito dal campo `index` della risposta, non
    dall'ordine di arrivo, e viene riordinato qui.
    """
    if not testi:
        return []

    corpo_risposta = await _posta(_URL_EMBEDDINGS, {"model": MODELLO_EMBEDDING, "input": testi})
    try:
        dati = corpo_risposta["data"]
        per_indice = {int(voce["index"]): [float(x) for x in voce["embedding"]] for voce in dati}
    except (KeyError, IndexError, TypeError, ValueError) as errore:
        raise FonteNonRaggiungibileError(
            FONTE, f"risposta non nel formato atteso: {errore}"
        ) from errore

    if sorted(per_indice) != list(range(len(testi))):
        raise FonteNonRaggiungibileError(
            FONTE, f"attesi {len(testi)} embedding, ricevuti {len(per_indice)}"
        )
    return [per_indice[i] for i in range(len(testi))]
