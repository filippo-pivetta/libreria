"""Open Library: l'identità dell'opera e la mediana delle pagine.

Usata solo dove è insostituibile, non come fonte generale. Le due cose che
sa fare e che nessun'altra fonte può dare:

1. L'identificativo dell'opera, distinta dalle edizioni — Google non ha
   il concetto di opera, e senza quello l'intero ADR 0002 non ha su cosa
   poggiare.
2. `number_of_pages_median`, la mediana delle pagine su tutte le edizioni,
   che il PRD richiede per precompilare le pagine della Voce. Google
   conosce un volume alla volta e non può calcolarla.

Tutto il resto è stato misurato e scartato: le copertine sono al massimo
500px di lato lungo, sotto la specifica del PRD; le descrizioni sono un
unico testo senza tag di lingua, con più lingue concatenate dentro.

Due trappole verificate dal vivo, che spiegano le scelte di questo modulo:

- `/isbn/{isbn}.json` risponde **404**. La via giusta è
  `search.json?q=isbn:...`, che per giunta restituisce già i dati a
  livello di opera in una chiamata sola.
- `search.json` con i parametri strutturati `title=` e `author=` **non
  trova le traduzioni**: cercando "The Name of the Rose" + Eco, l'opera
  vera non compare affatto e si ottengono record orfani da una edizione.
  Con `q=` in testo libero la stessa ricerca la trova al primo posto. Qui
  si usa quindi solo il testo libero.
- L'anno si legge da `search.json` e mai dal record dell'opera: per "Il
  nome della rosa" (1980) il record dichiara `first_publish_date:
  "December 2003"`, mentre la ricerca dà 1980.
"""

from dataclasses import dataclass
from typing import Any

import httpx

from app.cataloghi import agente
from app.cataloghi.errori import FonteNonRaggiungibileError

_URL = "https://openlibrary.org/search.json"
_TIMEOUT = httpx.Timeout(8.0)
_FONTE = "open_library"

_CAMPI = (
    "key,title,author_name,first_publish_year,number_of_pages_median,"
    "edition_count,language,subject,cover_i"
)

# Un'opera vera ha molte edizioni; i record orfani che sporcano la ricerca
# per testo ne hanno una sola. È il discriminante empirico più affidabile
# trovato: misurato, "Il nome della rosa" sta a 151 edizioni e gli stub che
# gli si affiancano nei risultati a 1.
SOGLIA_EDIZIONI = 3


@dataclass(frozen=True)
class OperaOL:
    work_id: str
    """Senza il prefisso `/works/`: è la forma che finisce in
    `libro_riferimento_esterno.identificativo`."""
    titolo: str
    autori: tuple[str, ...]
    anno_prima_pubblicazione: int | None
    pagine_mediane: int | None
    numero_edizioni: int
    soggetti: tuple[str, ...]

    @property
    def e_plausibile(self) -> bool:
        """Falso per i record orfani da una edizione sola, che nella
        ricerca per testo si affiancano all'opera vera."""
        return self.numero_edizioni >= SOGLIA_EDIZIONI


def _opera(documento: dict[str, Any]) -> OperaOL | None:
    chiave = documento.get("key")
    titolo = documento.get("title")
    if not isinstance(chiave, str) or not isinstance(titolo, str):
        return None
    return OperaOL(
        work_id=chiave.removeprefix("/works/"),
        titolo=titolo,
        autori=_stringhe(documento.get("author_name")),
        anno_prima_pubblicazione=_intero(documento.get("first_publish_year")),
        pagine_mediane=_intero(documento.get("number_of_pages_median")),
        numero_edizioni=_intero(documento.get("edition_count")) or 0,
        soggetti=_stringhe(documento.get("subject")),
    )


def _intero(valore: Any) -> int | None:
    return valore if isinstance(valore, int) else None


def _stringhe(valore: Any) -> tuple[str, ...]:
    return tuple(str(v) for v in valore) if isinstance(valore, list) else ()


async def _interroga(query: str, limite: int) -> list[OperaOL]:
    # `headers` non era passato: le richieste uscivano con il
    # `python-httpx/0.28.1` di libreria, cioè come client anonimo. La
    # documentazione di Open Library (openlibrary.org/developers/api) dà
    # 1 richiesta al secondo agli anonimi e 3 a chi si identifica, e
    # avverte che la violazione porta a "aggressive rate limiting or
    # blocking" — mentre una sola aggiunta interroga Open Library più
    # volte di fila (un ISBN dopo l'altro, poi la ricerca per testo).
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=agente.intestazioni()) as client:
            risposta = await client.get(
                _URL, params={"q": query, "fields": _CAMPI, "limit": str(limite)}
            )
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(_FONTE, errore) from errore

    if risposta.status_code >= 400:
        raise FonteNonRaggiungibileError(_FONTE, f"HTTP {risposta.status_code}")

    documenti = risposta.json().get("docs") or []
    return [o for o in (_opera(d) for d in documenti) if o is not None]


async def per_isbn(isbn13: str) -> OperaOL | None:
    """L'opera a cui appartiene un'edizione, dal suo ISBN.

    È la sola via davvero affidabile all'identità: verificato che gli ISBN
    Harcourt, Vintage e LGF de "Il nome della rosa" — editori diversi,
    lingue diverse — risolvono tutti sullo stesso identificativo d'opera.

    Ritorna None quando l'ISBN semplicemente non c'è, che è il caso di
    circa il quaranta per cento degli ISBN italiani misurati: non è un
    errore, è una lacuna della fonte, e chi chiama passa al binario
    successivo.
    """
    opere = await _interroga(f"isbn:{isbn13}", 1)
    return opere[0] if opere else None


async def per_testo(termine: str, limite: int = 5) -> list[OperaOL]:
    """Le opere che Open Library trova per un termine libero.

    Testo libero e non `title=`+`author=`: vedi la trappola documentata in
    cima al modulo. Chi chiama non deve prendere il primo risultato a
    scatola chiusa — anche in testo libero la ricerca porta su opere
    diverse dello stesso autore — ma confrontarlo con ciò che sa già e
    controllare `e_plausibile`.
    """
    return await _interroga(termine, limite)
