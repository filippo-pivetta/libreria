"""Wikipedia: la descrizione dell'opera, per lingua.

Preferita a Google Books non per licenza — quella questione non pesa su
un'applicazione privata a cerchia chiusa — ma per qualità: è prosa
enciclopedica scritta per spiegare di cosa parla un libro, mentre la
descrizione di Google è testo di quarta di copertina, scritto per
venderlo. Copre però solo le opere notabili, quindi Google resta il
ripiego (app/services/risoluzione.py).

Ci si arriva dai collegamenti di Wikidata, mai cercando per titolo: il
titolo di una pagina Wikipedia non è il titolo del libro, e indovinarlo
porterebbe su pagine sbagliate (il film, la disambigua).

I testi sono CC BY-SA: si conserva l'indirizzo della pagina in
`libro_descrizione.url_fonte`, e la scheda del libro lo mostra.
"""

from dataclasses import dataclass

import httpx

from app.cataloghi.errori import FonteNonRaggiungibileError

_TIMEOUT = httpx.Timeout(8.0)
_FONTE = "wikipedia"
_INTESTAZIONI = {"User-Agent": "Montaigne/0.1 (applicazione privata di tracciamento letture)"}


@dataclass(frozen=True)
class Sommario:
    lingua: str
    testo: str
    url: str


async def sommario(lingua: str, titolo_pagina: str) -> Sommario | None:
    """L'apertura della voce, o None se la pagina non c'è o è vuota.

    Il sommario e non il corpo: sono i due o tre capoversi iniziali, che è
    esattamente la lunghezza che serve a una scheda e l'unica parte che
    quasi ogni voce ha scritta bene.
    """
    percorso = httpx.URL(path=titolo_pagina.replace(" ", "_")).path.lstrip("/")
    url = f"https://{lingua}.wikipedia.org/api/rest_v1/page/summary/{percorso}"
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers=_INTESTAZIONI, follow_redirects=True
        ) as client:
            risposta = await client.get(url)
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(_FONTE, errore) from errore

    if risposta.status_code == 404:
        return None
    if risposta.status_code >= 400:
        raise FonteNonRaggiungibileError(_FONTE, f"HTTP {risposta.status_code}")

    corpo = risposta.json()
    testo = str(corpo.get("extract") or "").strip()
    if not testo:
        return None

    # Le pagine di disambigua hanno un estratto ("può riferirsi a...") che
    # non descrive nulla: conservarla sarebbe peggio che non avere
    # descrizione.
    if corpo.get("type") == "disambiguation":
        return None

    pagina = (corpo.get("content_urls") or {}).get("desktop") or {}
    return Sommario(
        lingua=lingua,
        testo=testo,
        url=str(pagina.get("page") or f"https://{lingua}.wikipedia.org/wiki/{percorso}"),
    )
