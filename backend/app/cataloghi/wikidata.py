"""Wikidata: lingua originale, anno, titoli multilingua, e il ponte tra le
lingue che Open Library non sa attraversare da sola.

Non è nel PRD, ed è stata aggiunta perché le misure sulle altre due fonti
hanno lasciato scoperti tre dati che il prodotto richiede:

- **La lingua originale dell'opera.** Il campo `language` di Open Library
  sono le lingue delle EDIZIONI, non quella in cui l'opera è stata
  scritta. Wikidata ha `P407`, che è esattamente quella.
- **I titoli nelle altre lingue.** Le etichette di Wikidata sono varianti
  di titolo già pronte e già dichiarate per lingua. L'alternativa sarebbe
  tradurre, che il PRD vieta (sarebbe dato inventato).
- **Un secondo binario verso l'identità.** `P648` porta l'identificativo
  d'opera di Open Library, e la ricerca di Wikidata trova l'opera da
  qualunque lingua: verificato che "The Name of the Rose", "Der Name der
  Rose" e "Le Nom de la rose" portano tutte allo stesso elemento, e
  quindi allo stesso identificativo.

Copertura limitata alle opere notabili: su identificativi d'opera presi a
caso la ricerca inversa non trova nulla. È uno strato di arricchimento e
un ripiego, mai l'ossatura — e chi lo usa deve trattare un suo fallimento
come "nessun arricchimento", mai come un errore che ferma l'aggiunta del
libro. Wikidata risponde 429 a raffiche ravvicinate (verificato), e
un'aggiunta non deve mai fallire per questo.

Attenzione al rumore: la ricerca per titolo restituisce anche film, serie
televisive, album e — insidiosi — elementi separati per le singole
traduzioni. Da qui il filtro sul tipo.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import httpx

from app.cataloghi import agente, trasporto
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.testo import cognomi

_URL = "https://www.wikidata.org/w/api.php"
_TIMEOUT = httpx.Timeout(8.0)
_FONTE = "wikidata"


def _cliente() -> httpx.AsyncClient:
    """Il client condiviso verso questa fonte: uno per processo, tenuto
    aperto, mai dentro un `async with` (app/cataloghi/trasporto.py)."""
    return trasporto.cliente(
        "wikidata",
        lambda: httpx.AsyncClient(
            timeout=_TIMEOUT, headers=agente.intestazioni(), limits=trasporto.LIMITI
        ),
    )


# P31 "istanza di": i tipi che contano come opera scritta. Comprende il
# libro e il romanzo, ma non il film né la serie televisiva, che sono il
# rumore più frequente su un titolo famoso.
TIPI_OPERA = frozenset(
    {
        "Q571",  # libro
        "Q7725634",  # opera letteraria
        "Q47461344",  # opera scritta
        "Q8261",  # romanzo
        "Q49084",  # racconto
        "Q1279564",  # raccolta di racconti
        "Q5185279",  # poesia
        "Q37484",  # poema epico
        "Q25379",  # opera teatrale
        "Q23622",  # saggio
    }
)

_LINGUE_ETICHETTE = ("it", "en", "fr", "de", "es")


@dataclass(frozen=True)
class OperaWikidata:
    qid: str
    etichette: dict[str, str]
    """Titolo per lingua: sono le varianti di titolo, già dichiarate."""
    open_library_work_id: str | None
    lingua_originale: str | None
    """Codice ISO 639-1 quando deducibile, altrimenti None."""
    anno_prima_pubblicazione: int | None
    titoli_wikipedia: dict[str, str]
    """Titolo della pagina Wikipedia per lingua, da cui si prende poi la
    descrizione."""


# P407 dà un elemento-lingua, non un codice. Mappare l'intero universo
# delle lingue non serve: bastano quelle che l'interfaccia e il catalogo
# incontrano davvero, e per le altre resta None — che è corretto, perché
# il PRD preferisce un dato assente a un dato inventato.
_LINGUE = {
    "Q652": "it",
    "Q1860": "en",
    "Q150": "fr",
    "Q188": "de",
    "Q1321": "es",
    "Q5146": "pt",
    "Q7411": "nl",
    "Q7737": "ru",
    "Q9067": "hu",
    "Q5287": "ja",
    "Q9168": "ar",
    "Q9027": "sv",
    "Q9035": "da",
    "Q9043": "no",
    "Q1412": "fi",
    "Q809": "pl",
    "Q9056": "cs",
    "Q9072": "el",
    "Q256": "tr",
    "Q7850": "zh",
    "Q9176": "ko",
    "Q397": "la",
    "Q8748": "ca",
    "Q7913": "ro",
    "Q9299": "sr",
}


async def _chiama(parametri: dict[str, str]) -> dict[str, Any]:
    try:
        risposta = await _cliente().get(_URL, params={**parametri, "format": "json"})
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(_FONTE, errore) from errore
    if risposta.status_code >= 400:
        raise FonteNonRaggiungibileError(_FONTE, f"HTTP {risposta.status_code}")
    corpo: dict[str, Any] = risposta.json()
    return corpo


def _valori(rivendicazioni: dict[str, Any], proprieta: str) -> list[Any]:
    return [
        c.get("mainsnak", {}).get("datavalue", {}).get("value")
        for c in rivendicazioni.get(proprieta) or []
    ]


def _qid_di(valore: Any) -> str | None:
    return str(valore["id"]) if isinstance(valore, dict) and "id" in valore else None


def _leggi(qid: str, entita: dict[str, Any]) -> OperaWikidata:
    rivendicazioni = entita.get("claims") or {}

    lingua_qid = next((q for q in (_qid_di(v) for v in _valori(rivendicazioni, "P407")) if q), None)

    anno = None
    for data in _valori(rivendicazioni, "P577"):
        if isinstance(data, dict) and isinstance(data.get("time"), str):
            testo = data["time"].lstrip("+")[:4]
            if testo.isdigit():
                # La prima pubblicazione è la più antica dichiarata: alcune
                # opere portano anche le date delle riedizioni.
                anno = min(anno or 9999, int(testo))

    etichette = {
        lingua: str(voce["value"])
        for lingua, voce in (entita.get("labels") or {}).items()
        if isinstance(voce, dict) and voce.get("value")
    }

    titoli_wikipedia = {
        chiave.removesuffix("wiki"): str(voce["title"])
        for chiave, voce in (entita.get("sitelinks") or {}).items()
        if chiave.endswith("wiki") and isinstance(voce, dict) and voce.get("title")
    }

    return OperaWikidata(
        qid=qid,
        etichette=etichette,
        open_library_work_id=_work_id(rivendicazioni),
        lingua_originale=_LINGUE.get(lingua_qid or ""),
        anno_prima_pubblicazione=anno,
        titoli_wikipedia=titoli_wikipedia,
    )


def _work_id(rivendicazioni: dict[str, Any]) -> str | None:
    """L'identificativo Open Library, solo se è di un'OPERA.

    `P648` non contiene sempre un identificativo d'opera: misurato dal
    vivo, "Le città invisibili" (Q1219705) porta `OL9162823M`, dove il
    suffisso M indica un'EDIZIONE. Preso alla lettera finirebbe in
    `libro_riferimento_esterno` con fonte 'open_library' e non
    corrisponderebbe mai a nessun identificativo d'opera vero — un
    riferimento morto che impedirebbe per sempre di riconoscere la scheda.

    Gli identificativi di Open Library dichiarano la propria natura nel
    suffisso: W per le opere, M per le edizioni, A per gli autori.
    """
    for valore in _valori(rivendicazioni, "P648"):
        if isinstance(valore, str) and valore.endswith("W"):
            return valore
    return None


def _e_opera(entita: dict[str, Any]) -> bool:
    tipi = {q for q in (_qid_di(v) for v in _valori(entita.get("claims") or {}, "P31")) if q}
    return bool(tipi & TIPI_OPERA)


async def per_open_library(work_id: str) -> OperaWikidata | None:
    """L'elemento che dichiara quell'identificativo d'opera (`P648`).

    È il verso più affidabile: si parte da un'identità già risolta e si
    chiede solo l'arricchimento, senza dover disambiguare nulla.
    """
    ricerca = await _chiama(
        {"action": "query", "list": "search", "srsearch": f"haswbstatement:P648={work_id}"}
    )
    risultati = ricerca.get("query", {}).get("search") or []
    if not risultati:
        return None
    return await per_qid(str(risultati[0]["title"]))


async def per_qid(qid: str) -> OperaWikidata | None:
    entita = await _chiama(
        {
            "action": "wbgetentities",
            "ids": qid,
            "props": "labels|claims|sitelinks",
            "languages": "|".join(_LINGUE_ETICHETTE),
        }
    )
    dati = (entita.get("entities") or {}).get(qid)
    if not isinstance(dati, dict) or "missing" in dati:
        return None
    return _leggi(qid, dati)


async def cerca_opera(
    titolo: str, autori: Sequence[str] = (), limite: int = 7
) -> OperaWikidata | None:
    """L'opera scritta che meglio corrisponde a un titolo, in qualunque
    lingua.

    È il ponte tra le lingue: Open Library trova un'opera solo cercandola
    in testo libero e con risultati rumorosi, mentre qui "The Name of the
    Rose", "Der Name der Rose" e "Le Nom de la rose" portano tutte allo
    stesso elemento.

    **Solo il titolo va nella ricerca, mai l'autore.** `wbsearchentities`
    corrisponde su etichette e alias, non in testo libero: verificato che
    "Le otto montagne Paolo Cognetti" restituisce ZERO candidati mentre
    "Le otto montagne" li trova tutti. L'autore serve dopo, a scegliere
    tra i candidati.

    Il filtro sul tipo non è rifinitura: sullo stesso titolo Wikidata
    restituisce il film, la miniserie televisiva, l'adattamento a fumetti,
    la pagina di disambigua e le singole edizioni, spesso prima del
    romanzo.
    """
    ricerca = await _chiama(
        {
            "action": "wbsearchentities",
            "search": titolo,
            "language": "it",
            "uselang": "it",
            "type": "item",
            "limit": str(limite),
        }
    )
    risultati = [r for r in ricerca.get("search") or [] if r.get("id")]
    if not risultati:
        return None

    # La descrizione di Wikidata nomina quasi sempre l'autore ("romanzo
    # scritto da Umberto Eco", "romanzo di Paolo Cognetti del 2016"): è il
    # modo più economico di distinguere due opere omonime, e non costa una
    # chiamata in più come seguire P50 fino al nome dell'autore.
    cognomi_autori = cognomi(list(autori))
    descrizioni = {str(r["id"]): str(r.get("description") or "").lower() for r in risultati}
    candidati = [str(r["id"]) for r in risultati]

    entita = await _chiama(
        {
            "action": "wbgetentities",
            "ids": "|".join(candidati),
            "props": "labels|claims|sitelinks",
            "languages": "|".join(_LINGUE_ETICHETTE),
        }
    )

    opere = [
        qid
        for qid in candidati
        if isinstance((dati := (entita.get("entities") or {}).get(qid)), dict)
        and "missing" not in dati
        and _e_opera(dati)
    ]
    if not opere:
        return None

    if cognomi_autori:
        con_autore = [q for q in opere if any(c in descrizioni[q] for c in cognomi_autori)]
        if con_autore:
            opere = con_autore

    # A parità, l'ordine di rilevanza di Wikidata, che è già buono.
    scelto = opere[0]
    dati = (entita.get("entities") or {})[scelto]
    return _leggi(scelto, dati)
