"""Recupero, conversione e conservazione delle copertine.

Il PRD vuole la copertina "recuperata alla nascita della scheda,
preferendo la fonte con i dati migliori, e conservata dal sistema in due
formati": miniatura a 400px di lato lungo per gli elenchi, versione grande
a 600px per la scheda del libro.

La fonte primaria è Google Books, e la scelta è stata misurata, non
dedotta: l'endpoint immagini di Google serve JPEG fino a 1652x2478, mentre
la copertina più grande servita da Open Library è 500px di lato lungo —
sotto i 600 che il PRD stesso richiede. Quell'endpoint inoltre non
consuma la quota dell'API di Google (risponde anche quando l'API è a 429),
quindi la copertina non pesa sul budget delle chiamate.
"""

import io
import logging
from typing import Any, cast

import httpx
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageStat, UnidentifiedImageError

from app.core import storage
from app.lavori.errori import ErroreDefinitivo, ErroreTransitorio
from app.repositories import catalogo_repository, database

logger = logging.getLogger("app.lavori.copertine")

LATO_MINIATURA = 400
LATO_GRANDE = 600

_TIMEOUT = httpx.Timeout(15.0)
_INTESTAZIONI = {"User-Agent": "Montaigne/0.1 (applicazione privata di tracciamento letture)"}

# Google risponde 200 anche quando la copertina non esiste, servendo un PNG
# grigio uniforme 575x750. `onError` di un tag immagine non scatterebbe mai
# e lo scaffale si riempirebbe di rettangoli grigi: va riconosciuto qui.
#
# Soglie misurate su campioni reali (backend/tests/campioni/):
#   segnaposto Google        croma 0.00   dettaglio  9.93
#   copertine vere (4)       croma 22-61  dettaglio 42.8-60.5
#   copertina b/n costruita  croma 0.00   dettaglio 78.8   <- salvata dal dettaglio
#   monocroma colorata       croma 170    dettaglio  0.00  <- salvata dalla croma
#
# Servono ENTRAMBI i segnali. La sola croma scarterebbe le copertine
# legittimamente in bianco e nero; il solo dettaglio scarterebbe le
# copertine monocrome di design. La lunghezza in byte (~9103) non è un
# criterio: Google può cambiarla domani senza preavviso.
_SOGLIA_CROMA = 2.0
_SOGLIA_DETTAGLIO = 25.0

# Una copertina di libro ha proporzioni di libro. Google, per i volumi
# digitalizzati da biblioteca (identificativi che finiscono in MAAJ), non
# restituisce la copertina ma un FRAMMENTO della scansione: misurato dal
# vivo, "Le città invisibili" ha dato un 575x92, cioè una striscia con
# rapporto 0.16. Grigia ma piena di dettaglio, quindi il riconoscitore del
# segnaposto la lasciava passare, e finiva sullo scaffale come copertina.
#
# Le copertine vere misurate stanno tutte tra 1.30 e 1.51 di rapporto
# altezza/larghezza. La forbice qui sotto è larga apposta: serve a
# scartare ciò che copertina non è (strisce, doppie pagine, ritagli), non
# a giudicare i formati editoriali insoliti.
_RAPPORTO_MIN = 0.9
_RAPPORTO_MAX = 2.5

# Il colore dominante finisce sotto il titolo del segnaposto tipografico,
# composto in Fraunces chiaro (docs/design-frontend.md §7 e §13): fuori da
# questa fascia di luminanza il titolo diventa illeggibile. È un vincolo di
# leggibilità, non una preferenza estetica.
_LUMINANZA_MIN = 0.08
_LUMINANZA_MAX = 0.55


def _url_google(volume_id: str) -> str:
    # zoom=0 è la risoluzione piena. zoom=1 sarebbe la miniatura da ~128px,
    # troppo piccola perfino per la miniatura da 400 che serve a noi.
    return f"https://books.google.com/books/content?id={volume_id}&printsec=frontcover&img=1&zoom=0"


def _url_open_library(isbn13: str) -> str:
    # `default=false` fa rispondere 404 quando l'immagine non c'è, invece
    # del GIF trasparente di 43 byte che Open Library serve con stato 200
    # (verificato). Meglio un codice di stato onesto che riconoscere il
    # segnaposto dalla lunghezza.
    return f"https://covers.openlibrary.org/b/isbn/{isbn13}-L.jpg?default=false"


async def _scarica(client: httpx.AsyncClient, url: str) -> bytes | None:
    """Ritorna i byte, oppure None se la fonte dichiara di non avere nulla.

    Un 404 non è un errore da riprovare: la fonte ha risposto, e la
    risposta è "non ce l'ho".
    """
    try:
        risposta = await client.get(url)
    except httpx.HTTPError as errore:
        raise ErroreTransitorio(f"{url}: {errore}") from errore

    if risposta.status_code == 404:
        return None
    if risposta.status_code >= 500 or risposta.status_code == 429:
        raise ErroreTransitorio(f"{url}: HTTP {risposta.status_code}")
    if risposta.status_code >= 400:
        raise ErroreDefinitivo(f"{url}: HTTP {risposta.status_code}")

    contenuto = risposta.content
    # Open Library serve un GIF di 43 byte quando non ha l'immagine, con
    # stato 200: sotto questa soglia non c'è nulla di utile in nessuna
    # delle due fonti.
    return contenuto if len(contenuto) > 1024 else None


def _apri(dati: bytes) -> Image.Image:
    try:
        immagine = Image.open(io.BytesIO(dati))
        immagine.load()
    except UnidentifiedImageError as errore:
        raise ErroreDefinitivo(f"Contenuto non riconosciuto come immagine: {errore}") from errore
    except OSError as errore:
        # Risposta troncata: può essere andata male la rete, vale un
        # secondo tentativo.
        raise ErroreTransitorio(f"Immagine illeggibile: {errore}") from errore
    return immagine


def riconosci_segnaposto(immagine: Image.Image) -> bool:
    """Vero quando l'immagine è un segnaposto "copertina non disponibile"
    invece di una copertina.

    Due segnali insieme su una riduzione a 32x32: nessun colore (croma
    quasi nulla) E nessun dettaglio (deviazione standard quasi nulla).
    Vedi le soglie in cima al modulo per i valori misurati e per il motivo
    per cui uno solo dei due non basterebbe.
    """
    piccola = immagine.convert("RGB").resize((32, 32))
    statistiche = ImageStat.Stat(piccola)
    medie = statistiche.mean
    croma = max(
        abs(medie[0] - medie[1]),
        abs(medie[1] - medie[2]),
        abs(medie[0] - medie[2]),
    )
    dettaglio = max(statistiche.stddev)
    return croma < _SOGLIA_CROMA and dettaglio < _SOGLIA_DETTAGLIO


def ha_proporzioni_da_copertina(immagine: Image.Image) -> bool:
    """Falso quando l'immagine non ha la forma di una copertina.

    Serve perché una fonte può rispondere 200 con un'immagine che non è la
    copertina richiesta: vedi la nota sulle proporzioni in cima al modulo
    per il caso reale che ha reso necessario questo controllo.
    """
    larghezza, altezza = immagine.size
    if larghezza <= 0 or altezza <= 0:
        return False
    rapporto = altezza / larghezza
    return _RAPPORTO_MIN <= rapporto <= _RAPPORTO_MAX


def colore_dominante(immagine: Image.Image) -> str:
    """Il colore più rappresentativo della copertina, in #rrggbb.

    Non la media dei pixel, che su una copertina a contrasto alto dà
    sempre un grigio fangoso: si riduce a otto colori e si prende il più
    frequente che stia nella fascia di luminanza leggibile. Se nessuno ci
    sta, si scurisce la media finché ci rientra — meglio un colore
    approssimativo e leggibile che uno esatto su cui il titolo sparisce.
    """
    piccola = immagine.convert("RGB").resize((64, 64))
    ridotta = piccola.quantize(colors=8, method=Image.Quantize.FASTOCTREE)
    tavolozza = ridotta.getpalette() or []
    # getcolors() su un'immagine a tavolozza dà (frequenza, indice); il tipo
    # dichiarato da Pillow copre anche il caso RGB, dove il secondo membro è
    # una tupla — da qui il cast esplicito.
    conteggi: list[tuple[int, int]] = sorted(
        ((int(n), int(cast("int", i))) for n, i in (ridotta.getcolors() or [])),
        reverse=True,
    )

    ripiego: tuple[int, int, int] | None = None
    for _, voce in conteggi:
        indice = voce * 3
        rgb = (tavolozza[indice], tavolozza[indice + 1], tavolozza[indice + 2])
        if ripiego is None:
            ripiego = rgb
        if _LUMINANZA_MIN <= _luminanza(rgb) <= _LUMINANZA_MAX:
            return _esadecimale(rgb)

    if ripiego is None:
        medie = ImageStat.Stat(piccola).mean
        ripiego = (int(medie[0]), int(medie[1]), int(medie[2]))

    while _luminanza(ripiego) > _LUMINANZA_MAX:
        ripiego = (int(ripiego[0] * 0.8), int(ripiego[1] * 0.8), int(ripiego[2] * 0.8))
    return _esadecimale(ripiego)


def _luminanza(rgb: tuple[int, int, int]) -> float:
    """Luminanza relativa secondo WCAG, la stessa base su cui il frontend
    verifica i contrasti (`npm run check:contrast`)."""

    def canale(valore: int) -> float:
        v = valore / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    return 0.2126 * canale(rgb[0]) + 0.7152 * canale(rgb[1]) + 0.0722 * canale(rgb[2])


def _esadecimale(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, c)) for c in rgb))


def converti(immagine: Image.Image, lato_lungo: int) -> bytes:
    """Ridimensiona a `lato_lungo` sul lato maggiore e codifica in WebP.

    WebP e non AVIF: la codifica AVIF è di un ordine di grandezza più
    lenta, e su un piano gratuito il tempo di CPU del lavoro in secondo
    piano conta più del venti per cento di byte risparmiati.

    Mai ingrandire: una copertina già più piccola del formato richiesto
    resta com'è, perché interpolarla non aggiunge dettaglio e i byte in
    più li paga comunque.
    """
    rgb = immagine.convert("RGB")
    larghezza, altezza = rgb.size
    massimo = max(larghezza, altezza)
    if massimo > lato_lungo:
        fattore = lato_lungo / massimo
        rgb = rgb.resize(
            (max(1, round(larghezza * fattore)), max(1, round(altezza * fattore))),
            Image.Resampling.LANCZOS,
        )
    buffer = io.BytesIO()
    rgb.save(buffer, format="WEBP", quality=82, method=6)
    return buffer.getvalue()


async def esegui(payload: dict[str, Any]) -> None:
    """Recupera la copertina di un libro e la conserva nei due formati.

    L'assenza della copertina alla fonte non è un fallimento ma un esito:
    si scrive `copertina_stato = 'assente'` e il lavoro RIESCE. È così che
    la regola del PRD ("senza ulteriori tentativi automatici") si realizza
    senza casi particolari — nessuno chiede un altro tentativo, quindi
    nessuno lo fa.
    """
    libro_id = str(payload["libro_id"])
    volume_id = payload.get("google_volume_id")
    isbn13 = payload.get("isbn13")

    dati: bytes | None = None
    async with httpx.AsyncClient(
        timeout=_TIMEOUT, follow_redirects=True, headers=_INTESTAZIONI
    ) as client:
        if volume_id:
            dati = await _scarica(client, _url_google(str(volume_id)))
            if dati is not None and not _e_una_copertina(dati, libro_id, "Google"):
                dati = None
        if dati is None and isbn13:
            dati = await _scarica(client, _url_open_library(str(isbn13)))
            if dati is not None and not _e_una_copertina(dati, libro_id, "Open Library"):
                dati = None

    if dati is None:
        await _scrivi_stato(libro_id, "assente")
        return

    immagine = _apri(dati)
    colore = colore_dominante(immagine)
    miniatura = converti(immagine, LATO_MINIATURA)
    grande = converti(immagine, LATO_GRANDE)

    percorso_miniatura = storage.percorso_miniatura(libro_id)
    percorso_grande = storage.percorso_grande(libro_id)
    await run_in_threadpool(storage.carica, percorso_miniatura, miniatura)
    await run_in_threadpool(storage.carica, percorso_grande, grande)

    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.aggiorna_copertina(
                connessione, libro_id, percorso_miniatura, percorso_grande, colore
            )

    await run_in_threadpool(_scrivi)


def _e_una_copertina(dati: bytes, libro_id: str, fonte: str) -> bool:
    """Vero solo se i byte scaricati sono una copertina utilizzabile.

    Due modi diversi di non esserlo, entrambi con stato 200: il segnaposto
    "copertina non disponibile", e un'immagine che copertina non è (un
    frammento di scansione). Entrambi vanno trattati come "questa fonte
    non ce l'ha", non come errori.
    """
    immagine = _apri(dati)
    if riconosci_segnaposto(immagine):
        logger.info("%s non ha la copertina di %s (segnaposto).", fonte, libro_id)
        return False
    if not ha_proporzioni_da_copertina(immagine):
        logger.info(
            "%s ha restituito per %s un'immagine %sx%s, che non ha proporzioni da copertina.",
            fonte,
            libro_id,
            immagine.size[0],
            immagine.size[1],
        )
        return False
    return True


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Rende osservabile il fallimento sulla scheda, non solo nella coda."""
    logger.warning("Copertina di %s non recuperata: %s", payload.get("libro_id"), errore)
    await _scrivi_stato(str(payload["libro_id"]), "fallita")


async def _scrivi_stato(libro_id: str, stato: str) -> None:
    def _scrivi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.segna_copertina(connessione, libro_id, stato)

    await run_in_threadpool(_scrivi)
