"""Da un volume trovato su un catalogo all'identità dell'opera.

È il cuore di ADR 0002 — "una sola scheda per opera, la cui identità è
l'identificativo dell'opera del catalogo canonico [...]; il riconoscimento
di una scheda esistente avviene su quell'identificativo e mai sul titolo".

La catena ha cinque passi perché nessuna fonte, da sola, ce la fa. I
numeri che seguono sono misurati, non stimati:

1. **Identificativo già noto** -> zero chiamate esterne. Un ISBN o un
   identificativo di volume già in `libro_riferimento_esterno` porta
   dritto alla scheda: è il caso più frequente a regime, ed è gratis.
2. **ISBN -> Open Library.** L'unica via davvero affidabile: ISBN di
   editori, lingue e rilegature diverse della stessa opera risolvono tutti
   sullo stesso identificativo. Copre circa il 60% degli ISBN italiani.
3. **Testo libero -> Open Library.** Recupera parte del restante 40%, ma
   la ricerca porta anche su altre opere dello stesso autore: si accetta
   solo un risultato plausibile (molte edizioni) E coerente con l'autore
   del volume di partenza.
4. **Wikidata.** Il ponte tra le lingue che Open Library non attraversa da
   sola, e l'unica fonte della lingua originale dell'opera.
5. **Nessuna.** La scheda nasce senza riferimenti canonici. Non è un
   errore: è il caso che il PRD prevede, e la scheda va nella coda di
   fusione del Manutentore.

L'arricchimento (passo 4) non deve MAI far fallire l'aggiunta: se Wikidata
non risponde — succede, risponde 429 a raffiche ravvicinate — si aggiunge
il libro con meno dati, non si nega l'aggiunta.
"""

import logging
from dataclasses import dataclass, field

from app.cataloghi import google_books, open_library, wikidata
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.cataloghi.google_books import Volume
from app.core.testo import cognomi, normalizza
from app.services import mappatura_generi

logger = logging.getLogger("app.risoluzione")


@dataclass
class SchedaRisolta:
    """Tutto ciò che serve a far nascere una scheda, già deciso."""

    titolo_canonico: str
    autori: list[str]
    anno_prima_pubblicazione: int | None
    anno_dedotto: bool
    lingua_originale: str | None
    lingua_dedotta: bool
    pagine_mediane: int | None
    generi: list[str]
    riferimenti: list[tuple[str, str, bool]] = field(default_factory=list)
    """(fonte, identificativo, principale) da scrivere in
    `libro_riferimento_esterno`."""
    varianti_titolo: list[tuple[str, str, str]] = field(default_factory=list)
    """(lingua, titolo, fonte)."""
    descrizioni: list[tuple[str, str, str, str | None]] = field(default_factory=list)
    """(lingua, testo, fonte, url_fonte)."""
    titoli_wikipedia: dict[str, str] = field(default_factory=dict)
    """Da cui il lavoro in secondo piano prenderà le descrizioni."""
    copertina_volume_id: str | None = None
    copertina_isbn13: str | None = None

    @property
    def canonicalizzata(self) -> bool:
        """Falso quando nessuna fonte ha saputo dire quale opera sia.

        Derivato dai riferimenti e non conservato come campo: tenere un
        booleano accanto al dato che lo determina è la forma di errore che
        ADR 0005 rifiuta (ed è il motivo per cui `libro.non_canonicalizzato`
        è stata rimossa dallo schema).
        """
        return any(f in ("open_library", "wikidata") for f, _, _ in self.riferimenti)


def autori_compatibili(a: list[str], b: list[str]) -> bool:
    """Vero se i due elenchi d'autore condividono almeno un cognome.

    Guardia del passo 3: la ricerca per testo su Open Library restituisce
    volentieri altre opere dello stesso autore (cercando "Il nome della
    rosa" arriva anche "Il pendolo di Foucault"), ma anche opere di autori
    diversi. Il cognome in comune non prova che sia la stessa opera —
    quello lo fa il numero di edizioni insieme al titolo — ma la sua
    assenza prova che non lo è.
    """
    if not a or not b:
        return False
    return bool(cognomi(a) & cognomi(b))


def _titoli_vicini(a: str, b: str) -> bool:
    """Vero se uno dei due titoli contiene l'altro, una volta normalizzati.

    Non una distanza di edito: i titoli veri differiscono per sottotitoli
    e articoli ("Il nome della rosa" contro "Il nome della rosa. Con le
    postille"), non per refusi.
    """
    x, y = normalizza(a.split(":")[0]), normalizza(b.split(":")[0])
    return bool(x and y) and (x in y or y in x)


async def _per_isbn(isbn_disponibili: list[str]) -> open_library.OperaOL | None:
    """Passo 2. Prova tutti gli ISBN del gruppo, non solo il primo.

    È il guadagno concreto del collasso per opera: più edizioni raccolte
    sotto una riga significano più ISBN da provare, e basta che uno solo
    sia in Open Library perché l'identità si chiuda.
    """
    for isbn in isbn_disponibili:
        try:
            opera = await open_library.per_isbn(isbn)
        except FonteNonRaggiungibileError as errore:
            logger.info("Open Library non raggiungibile su isbn %s: %s", isbn, errore.motivo)
            return None
        if opera is not None:
            return opera
    return None


async def _per_testo(volume: Volume) -> open_library.OperaOL | None:
    """Passo 3, con le due guardie che lo rendono utilizzabile.

    Senza di esse la ricerca per testo creerebbe schede sbagliate ed
    sarebbe convinta di aver canonicalizzato, che è peggio del fallire.
    """
    termine = " ".join([volume.titolo, *volume.autori]).strip()
    try:
        candidati = await open_library.per_testo(termine, limite=5)
    except FonteNonRaggiungibileError as errore:
        logger.info("Open Library non raggiungibile su testo: %s", errore.motivo)
        return None

    for candidato in candidati:
        if not candidato.e_plausibile:
            continue
        if volume.autori and not autori_compatibili(list(volume.autori), list(candidato.autori)):
            continue
        if not _titoli_vicini(volume.titolo, candidato.titolo):
            continue
        return candidato
    return None


async def _arricchisci(scheda: SchedaRisolta, work_id: str | None, volume: Volume) -> None:
    """Passo 4. Non solleva mai: un arricchimento mancato è un dato in
    meno, non un'aggiunta negata."""
    try:
        opera = None
        if work_id:
            opera = await wikidata.per_open_library(work_id)
        if opera is None:
            # Titolo senza sottotitolo e autori separati: `wbsearchentities`
            # corrisponde sulle etichette, e un autore infilato nella
            # stringa di ricerca azzera i risultati (vedi wikidata.py).
            opera = await wikidata.cerca_opera(volume.titolo.split(":")[0].strip(), volume.autori)
    except FonteNonRaggiungibileError as errore:
        logger.info("Wikidata non raggiungibile: %s", errore.motivo)
        return
    if opera is None:
        return

    scheda.riferimenti.append(("wikidata", opera.qid, True))
    scheda.titoli_wikipedia = opera.titoli_wikipedia

    if opera.lingua_originale and not scheda.lingua_originale:
        scheda.lingua_originale = opera.lingua_originale
    if opera.anno_prima_pubblicazione and not scheda.anno_prima_pubblicazione:
        scheda.anno_prima_pubblicazione = opera.anno_prima_pubblicazione

    # Le etichette di Wikidata sono varianti di titolo già dichiarate per
    # lingua, e di qualità migliore dei titoli grezzi di catalogo: la
    # funzione di arbitraggio in migrazione le fa vincere.
    for lingua, titolo in opera.etichette.items():
        scheda.varianti_titolo.append((lingua, titolo, "wikidata"))

    if opera.open_library_work_id and not work_id:
        scheda.riferimenti.append(("open_library", opera.open_library_work_id, True))


async def risolvi(opera_google: google_books.Opera) -> SchedaRisolta:
    """Percorre la catena e restituisce la scheda da far nascere.

    Non tocca il database e non decide se la scheda esista già: quello lo
    fa chi chiama, cercando i riferimenti restituiti in
    `libro_riferimento_esterno` (passo 1 della catena).
    """
    volume = opera_google.rappresentante
    isbn = opera_google.isbn_disponibili

    scheda = SchedaRisolta(
        titolo_canonico=volume.titolo,
        autori=list(volume.autori),
        anno_prima_pubblicazione=None,
        anno_dedotto=False,
        lingua_originale=None,
        lingua_dedotta=False,
        # Ripiego sul conteggio del volume scelto quando Open Library non
        # ha l'opera e quindi non può dare la mediana. È meno preciso ma è
        # un dato di fonte, e resta correggibile sulla propria copia (PRD).
        pagine_mediane=volume.pagine,
        generi=[],
        copertina_volume_id=volume.volume_id,
        copertina_isbn13=isbn[0] if isbn else None,
    )

    scheda.riferimenti.append(("google_books", volume.volume_id, True))
    for indice, codice in enumerate(isbn):
        scheda.riferimenti.append(("isbn13", codice, indice == 0))

    # Il titolo del volume è, per costruzione, la variante nella sua
    # lingua: chi ha cercato in italiano e scelto un volume italiano ha
    # appena fornito la variante italiana, senza che nessuno traduca nulla.
    if volume.lingua:
        scheda.varianti_titolo.append((volume.lingua, volume.titolo, "google_books"))

    if volume.descrizione:
        scheda.descrizioni.append((volume.lingua or "en", volume.descrizione, "google_books", None))

    opera_ol = await _per_isbn(isbn)
    if opera_ol is None:
        opera_ol = await _per_testo(volume)

    if opera_ol is not None:
        scheda.riferimenti.append(("open_library", opera_ol.work_id, True))
        # Il titolo dell'opera secondo il catalogo canonico è l'identità
        # della scheda, non ciò che si mostra (PRD: "un titolo canonico che
        # serve a identificare l'opera, non a essere mostrato").
        scheda.titolo_canonico = opera_ol.titolo
        scheda.anno_prima_pubblicazione = opera_ol.anno_prima_pubblicazione
        if opera_ol.pagine_mediane:
            scheda.pagine_mediane = opera_ol.pagine_mediane

    # I generi si mappano sull'UNIONE dei soggetti delle due fonti, non su
    # una con l'altra come ripiego. Google restituisce spesso una categoria
    # sola e generica ("Italian fiction", "Fiction"), che basterebbe a
    # produrre un genere e quindi a impedire di guardare i soggetti di Open
    # Library, che sono molti e specifici. Misurato su "Il nome della
    # rosa": la sola Google dà `literary_fiction`, l'unione dà
    # `crime_thriller, history, literary_fiction`.
    soggetti = [*volume.categorie, *(opera_ol.soggetti if opera_ol else ())]
    scheda.generi = mappatura_generi.mappa(soggetti)

    await _arricchisci(scheda, opera_ol.work_id if opera_ol else None, volume)

    if not scheda.canonicalizzata:
        logger.info(
            "Nessuna fonte ha risolto l'opera per '%s': la scheda nasce non canonicalizzata.",
            volume.titolo,
        )
    return scheda
