"""Google Books: la ricerca che l'Utente vede.

Fonte primaria della ricerca per copertura del catalogo italiano e qualità
del ranking (PRD). Non è invece la fonte dell'identità: Google non ha il
concetto di opera, ogni risultato è un'EDIZIONE, e la regola di una scheda
per opera (ADR 0002) va quindi imposta da noi — vedi il collasso più sotto
e app/services/risoluzione.py.

Richiede una chiave. Senza, l'API non risponde affatto: restituisce 429
con `quota_limit_value: "0"`, non un limite ridotto.
"""

import html
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.config import get_settings
from app.core.testo import cognome, normalizza

_URL = "https://www.googleapis.com/books/v1/volumes"
_TIMEOUT = httpx.Timeout(8.0)
_FONTE = "google_books"

# La quota gratuita è nell'ordine delle migliaia di chiamate al giorno, e
# il debounce del campo di ricerca ripresenta continuamente gli stessi
# termini (una cancellazione, un ritorno sulla pagina). Una cache breve
# sul termine normalizzato è il modo più economico di non sprecarla.
_TTL_CACHE = 300.0
_MAX_CACHE = 256
_cache: dict[str, tuple[float, list["Volume"]]] = {}

# Secondo indice sulla stessa cache, per identificativo di volume. Serve
# all'aggiunta: la schermata rimanda l'identificativo di un volume, non il
# termine con cui era stato trovato, e ripetere la ricerca per ritrovarlo
# costerebbe una chiamata e potrebbe dare un ordine diverso.
_per_volume: dict[str, tuple[float, "Volume"]] = {}


@dataclass(frozen=True)
class Volume:
    """Un'edizione come Google la conosce."""

    volume_id: str
    titolo: str
    sottotitolo: str | None
    autori: tuple[str, ...]
    lingua: str | None
    anno_pubblicazione: int | None
    """Anno di QUESTA edizione. Non è l'anno di prima pubblicazione
    dell'opera e non va mai usato come tale (PRD: per un classico
    ristampato sarebbe plausibile e sbagliato, e l'errore passerebbe
    inosservato)."""
    pagine: int | None
    isbn13: str | None
    categorie: tuple[str, ...]
    descrizione: str | None
    copertina_url: str | None
    """Miniatura remota da mostrare nei risultati, o None quando Google
    dichiara di non avere immagini. Serve che sia None e non un indirizzo
    da provare: un volume senza copertina risponde comunque 200, con un
    segnaposto grigio, quindi `onError` non scatterebbe mai e la riga
    mostrerebbe un rettangolo grigio invece del segnaposto tipografico."""


@dataclass
class Opera:
    """Più edizioni della stessa opera, collassate in una riga sola.

    Il PRD vieta la scelta dell'edizione: mostrare gli otto volumi che
    Google restituisce per "1984" sarebbe chiedere all'Utente di
    sceglierla, mascherata da elenco di risultati.

    Il collasso è di SOLA PRESENTAZIONE e non decide alcuna identità: la
    regola 11 e l'ADR 0002 restano intatti, perché nessuna scrittura
    dipende da questo raggruppamento — l'identità la risolve
    app/services/risoluzione.py, e la risolve dagli identificativi.
    """

    rappresentante: Volume
    alternativi: list[Volume] = field(default_factory=list)

    @property
    def isbn_disponibili(self) -> list[str]:
        """Tutti gli ISBN del gruppo, il rappresentante per primo.

        Il collasso qui MIGLIORA la risoluzione invece di impoverirla: più
        ISBN in mano significa più probabilità che la ricerca per ISBN su
        Open Library vada a segno, e quella è la sola via davvero
        affidabile all'identità dell'opera.
        """
        isbn = [v.isbn13 for v in [self.rappresentante, *self.alternativi] if v.isbn13]
        return list(dict.fromkeys(isbn))


_MARCATURA = re.compile(r"<[^>]+>")
"""La descrizione di Google arriva spesso con marcatura dentro: `<br>`
fra un paragrafo e l'altro, `<i>` sul titolo dell'opera, `<b>` sul nome
di chi firma la citazione in quarta di copertina.

Va tolta qui, alla fonte, e non in chi la mostra: questo testo finisce
in tre posti diversi — la scheda pubblica (§13), la descrizione salvata
alla nascita del libro (`catalogo_repository.crea_scheda`) e il contesto
che il lavoro di standardizzazione manda al modello — e in nessuno dei
tre è marcatura da interpretare. Renderla come testo mostrerebbe i tag
all'Utente; interpretarla significherebbe eseguire HTML di terzi in
pagina, che non si fa. Le entità (`&amp;`, `&#39;`) si sciolgono per la
stessa ragione: sono la stessa marcatura, scritta in un altro modo.

Un tag diventa uno spazio e non il vuoto: senza, "gioventù.<br><b>Peter"
si salderebbe in una parola sola."""


def _senza_marcatura(testo: str | None) -> str | None:
    if not testo:
        return None
    pulito = html.unescape(_MARCATURA.sub(" ", testo))
    pulito = re.sub(r"\s+", " ", pulito).strip()
    return pulito or None


_RUMORE_EDIZIONE = re.compile(
    r"[\(\[\{][^\)\]\}]*[\)\]\}]"  # (Nuova edizione decennale), [Italian Edition]
)

_CODA_EDIZIONE = re.compile(
    r"\s*[-–—]\s*(nuova |new |ediz|edition|edizione|versione)\b.*$", re.IGNORECASE
)

# "Testo [lingua] a fronte": marca editoriale italiana standard per le
# edizioni bilingui dei classici (originale e traduzione affiancati),
# frequentissima sui classici tradotti dal russo/francese/latino/greco.
# Reale, non ipotetico: causa diretta di un duplicato osservato — "Le
# notti bianche" e "Le notti bianche. Testo russo a fronte" sono la
# stessa opera, ma la seconda stringa (rumore non tra parentesi, quindi
# non toccato da _RUMORE_EDIZIONE) ha rotto sia il confronto titoli sia
# la ricerca su Wikidata (che corrisponde sulle etichette).
_TESTO_A_FRONTE = re.compile(r"[.,]?\s*testo\s+\w+\s+a\s+fronte\s*$", re.IGNORECASE)


def pulisci_titolo(titolo: str) -> str:
    """Toglie dal titolo ciò che descrive l'EDIZIONE e non l'opera.

    Gli editori impacchettano nel campo titolo quello che li distingue
    sullo scaffale del negozio: "Sapiens. Da animali a dèi (Nuova edizione
    decennale)", "La solitudine dei numeri primi (Italian Edition)". Sono
    stringhe reali, misurate nei risultati.

    Conta due volte. Il titolo grezzo finisce in `variante_titolo` e
    quindi sotto gli occhi dell'Utente sullo scaffale; e va nella ricerca
    su Wikidata, che corrisponde sulle etichette e con quel rumore dentro
    non trova nulla.

    Non tocca sottotitoli e specificazioni legittime: "Sapiens. Da animali
    a dèi" È il titolo italiano dell'opera, non un dettaglio d'edizione.
    """
    pulito = _RUMORE_EDIZIONE.sub(" ", titolo)
    pulito = _CODA_EDIZIONE.sub("", pulito)
    pulito = _TESTO_A_FRONTE.sub("", pulito)
    return re.sub(r"\s+", " ", pulito).strip(" .,-–—:;")


_CONNETTIVI = frozenset({"di", "de", "da", "by", "von", "van", "del", "della", "dello"})
"""Preposizioni che introducono l'autore dentro il titolo e che restano
appese quando lo si toglie."""


def _togli_autore_in_coda(titolo: str, autori: tuple[str, ...]) -> str:
    """Toglie il nome dell'autore quando è finito dentro il titolo.

    I record digitalizzati da biblioteca lo fanno spesso: misurato, "Il
    gattopardo [di] Giuseppe Tomasi de Lampedusa". Tolte le parentesi
    quadre resterebbe l'autore incollato al titolo, e quel titolo finirebbe
    sullo scaffale.

    Il confronto è sulla coda e sulla forma normalizzata, perché nessun
    titolo legittimo termina con il nome per esteso del proprio autore: la
    regola è precisa, non un'euristica generica sui nomi propri.
    """
    normalizzato = normalizza(titolo)
    for autore in autori:
        coda = normalizza(autore)
        if not coda or normalizzato == coda:
            continue
        if normalizzato.endswith(coda):
            # Si taglia sul titolo originale, non sul normalizzato, per non
            # perdere accenti e maiuscole di ciò che resta. Si tolgono
            # tante parole quante ne ha il nome dell'autore, non una: la
            # verifica finale conferma che il taglio abbia fatto il suo
            # lavoro, e in caso contrario si lascia il titolo com'è
            # piuttosto che restituirlo mutilato.
            parole = titolo.split()
            da_togliere = len(coda.split())
            ripulito = " ".join(parole[:-da_togliere]).strip(" .,-–—:;[]()")
            # La preposizione che introduceva l'autore resta appesa
            # ("Il nome della rosa di" da "... di Umberto Eco").
            while (
                ripulito
                and normalizza(ripulito).split()[-1:]
                and (normalizza(ripulito).split()[-1] in _CONNETTIVI)
            ):
                ripulito = " ".join(ripulito.split()[:-1]).strip(" .,-–—:;[]()")
            if ripulito and not normalizza(ripulito).endswith(coda):
                return ripulito
    return titolo


def _chiave_opera(volume: Volume) -> str:
    """Titolo senza sottotitolo + cognome del primo autore.

    Il sottotitolo si taglia perché è il posto in cui gli editori mettono
    ciò che distingue l'edizione, non l'opera ("1984: Nuova edizione
    annotata"). Il cognome invece del nome intero perché i cataloghi
    alternano "Umberto Eco" e "Eco, Umberto" per la stessa persona — e
    prenderne l'ultima parola senza guardare la virgola darebbe "george"
    per "Orwell, George", separando in due gruppi lo stesso autore.
    """
    titolo = normalizza(volume.titolo.split(":")[0])
    autore = cognome(volume.autori[0]) if volume.autori else ""
    return f"{titolo}|{autore}"


def _volume(elemento: dict[str, Any]) -> Volume | None:
    info = elemento.get("volumeInfo") or {}
    titolo = info.get("title")
    if not titolo or not elemento.get("id"):
        return None

    isbn13 = next(
        (
            i.get("identifier")
            for i in info.get("industryIdentifiers") or []
            if i.get("type") == "ISBN_13" and i.get("identifier")
        ),
        None,
    )

    anno = None
    pubblicata = str(info.get("publishedDate") or "")
    if len(pubblicata) >= 4 and pubblicata[:4].isdigit():
        anno = int(pubblicata[:4])

    immagini = info.get("imageLinks") or {}
    copertina = immagini.get("thumbnail") or immagini.get("smallThumbnail")

    autori = tuple(str(a) for a in info.get("authors") or [])
    titolo_pulito = pulisci_titolo(str(titolo)) or str(titolo)
    titolo_pulito = _togli_autore_in_coda(titolo_pulito, autori) or titolo_pulito

    return Volume(
        volume_id=str(elemento["id"]),
        titolo=titolo_pulito,
        sottotitolo=info.get("subtitle"),
        autori=autori,
        lingua=info.get("language"),
        anno_pubblicazione=anno,
        pagine=info.get("pageCount"),
        isbn13=str(isbn13) if isbn13 else None,
        categorie=tuple(str(c) for c in info.get("categories") or []),
        descrizione=_senza_marcatura(info.get("description")),
        # https invece dell'http che Google restituisce: una pagina servita
        # in https non caricherebbe l'immagine, e il browser non lo
        # segnalerebbe in modo comprensibile.
        copertina_url=str(copertina).replace("http://", "https://") if copertina else None,
    )


async def cerca(termine: str, massimo: int = 20) -> list[Volume]:
    """I volumi che Google trova per un termine libero, in ordine di
    rilevanza suo. Nessun riordino nostro: il ranking di Google è la
    ragione per cui è la fonte primaria della ricerca."""
    chiave = normalizza(termine)
    if not chiave:
        return []

    adesso = time.monotonic()
    memorizzato = _cache.get(chiave)
    if memorizzato is not None and adesso - memorizzato[0] < _TTL_CACHE:
        return memorizzato[1]

    settings = get_settings()
    if not settings.google_books_api_key:
        # Non è un errore di programmazione ma uno stato dell'ambiente, e
        # per chi cerca è indistinguibile da un catalogo che non risponde.
        raise FonteNonRaggiungibileError(_FONTE, "chiave API non configurata")

    parametri = {
        "q": termine,
        "maxResults": str(min(max(massimo, 1), 40)),
        "key": settings.google_books_api_key,
        # I risultati di Google variano per paese. Fissarlo rende la
        # ricerca uguale per tutti gli Utenti e indipendente dal nodo che
        # serve la richiesta (PRD: la scheda si crea una volta e vale per
        # tutti, quindi congelerebbe nella libreria di tutti ciò che ha
        # risposto a quel particolare nodo).
        "country": "IT",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            risposta = await client.get(_URL, params=parametri)
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(_FONTE, errore) from errore

    if risposta.status_code == 429:
        raise FonteNonRaggiungibileError(_FONTE, "quota esaurita")
    if risposta.status_code >= 400:
        raise FonteNonRaggiungibileError(_FONTE, f"HTTP {risposta.status_code}")

    corpo = risposta.json()
    volumi = [v for v in (_volume(e) for e in corpo.get("items") or []) if v is not None]

    if len(_cache) >= _MAX_CACHE:
        _cache.clear()
    _cache[chiave] = (adesso, volumi)

    if len(_per_volume) >= _MAX_CACHE * 20:
        _per_volume.clear()
    for volume in volumi:
        _per_volume[volume.volume_id] = (adesso, volume)
    return volumi


async def per_identificativo(volume_id: str) -> Volume | None:
    """Un solo volume, per identificativo. `None` se Google non lo conosce.

    Serve alla scheda di un libro non ancora in libreria: quella pagina si
    apre da un link e si ricarica, mentre `opera_dalla_cache` risponde solo
    finché la ricerca che l'ha popolata è recente ed è stata servita dallo
    stesso processo (la cache è di processo, cinque minuti). Senza questa
    via la scheda si aprirebbe la prima volta e sparirebbe alla seconda.

    Scrive in `_per_volume` esattamente come fa `cerca`, e non è un
    dettaglio di efficienza: `POST /libri` ricompone l'opera SOLO da quella
    cache, quindi senza questa riga si potrebbe guardare la scheda di un
    libro e poi non riuscire ad aggiungerlo.
    """
    memorizzato = _per_volume.get(volume_id)
    adesso = time.monotonic()
    if memorizzato is not None and adesso - memorizzato[0] < _TTL_CACHE:
        return memorizzato[1]

    settings = get_settings()
    if not settings.google_books_api_key:
        raise FonteNonRaggiungibileError(_FONTE, "chiave API non configurata")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            risposta = await client.get(
                f"{_URL}/{volume_id}",
                params={"key": settings.google_books_api_key, "country": "IT"},
            )
    except httpx.HTTPError as errore:
        raise FonteNonRaggiungibileError.da_httpx(_FONTE, errore) from errore

    # 404 non è una fonte irraggiungibile: è un volume che non esiste (o
    # non esiste più), e chi chiama deve poterlo dire con parole diverse.
    if risposta.status_code == 404:
        return None
    if risposta.status_code == 429:
        raise FonteNonRaggiungibileError(_FONTE, "quota esaurita")
    if risposta.status_code >= 400:
        raise FonteNonRaggiungibileError(_FONTE, f"HTTP {risposta.status_code}")

    trovato = _volume(risposta.json())
    if trovato is None:
        return None

    if len(_per_volume) >= _MAX_CACHE * 20:
        _per_volume.clear()
    _per_volume[trovato.volume_id] = (adesso, trovato)
    return trovato


def collassa_per_opera(volumi: list[Volume]) -> list[Opera]:
    """Una riga per opera, nell'ordine di rilevanza in cui sono arrivate.

    Il rappresentante del gruppo si sceglie preferendo chi ha un ISBN_13,
    poi chi ha una copertina, poi chi ha più metadati: il primo criterio
    perché è quello che apre la strada all'identità, gli altri perché è la
    riga che l'Utente vedrà.
    """
    gruppi: dict[str, Opera] = {}
    for volume in volumi:
        chiave = _chiave_opera(volume)
        gruppo = gruppi.get(chiave)
        if gruppo is None:
            gruppi[chiave] = Opera(rappresentante=volume)
            continue
        if _punteggio(volume) > _punteggio(gruppo.rappresentante):
            gruppo.alternativi.append(gruppo.rappresentante)
            gruppo.rappresentante = volume
        else:
            gruppo.alternativi.append(volume)
    return list(gruppi.values())


def _punteggio(volume: Volume) -> tuple[int, int, int]:
    return (
        1 if volume.isbn13 else 0,
        1 if volume.copertina_url else 0,
        sum(1 for campo in (volume.anno_pubblicazione, volume.pagine, volume.descrizione) if campo),
    )


def opera_dalla_cache(volume_id: str, alternativi: list[str]) -> Opera | None:
    """Ricompone l'opera che la schermata ha mostrato, dai soli
    identificativi che rimanda indietro.

    Ritorna None quando la cache è scaduta — una ricerca lasciata aperta
    a lungo. Non è un errore del sistema e non va trattato come tale: chi
    chiama lo traduce in un invito a rifare la ricerca, perché senza il
    termine originale non c'è modo di ritrovare quel volume.
    """
    adesso = time.monotonic()
    voce = _per_volume.get(volume_id)
    if voce is None or adesso - voce[0] >= _TTL_CACHE:
        return None
    altri = [
        v[1]
        for v in (_per_volume.get(a) for a in alternativi)
        if v is not None and adesso - v[0] < _TTL_CACHE
    ]
    return Opera(rappresentante=voce[1], alternativi=altri)


def svuota_cache() -> None:
    """Solo per i test: la cache è di processo e sopravviverebbe tra casi."""
    _cache.clear()
    _per_volume.clear()
