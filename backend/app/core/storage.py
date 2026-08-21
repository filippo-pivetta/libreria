"""Spazio file delle copertine.

Il bucket è privato, e non per prudenza: la regola 6 del PRD non ammette
alternative — "nessun dato di lettura e nessun file conservato dal sistema,
copertine comprese, è accessibile senza autenticazione" — ed è accompagnata
da un test esplicito, richiesta anonima a qualunque indirizzo di immagine e
rifiuto.

Da un bucket privato le immagini escono come URL firmati. La scelta che
conta è la DURATA della firma: con un TTL breve nessun browser e nessuna
CDN può mettere in cache l'immagine, perché l'indirizzo cambia a ogni
caricamento di pagina, e uno scaffale da cento copertine le riscarica
tutte ogni volta. Una copertina però è immutabile per opera, quindi non c'è
ragione di firmare corto: sette giorni, firmati in blocco per l'intero
scaffale in una chiamata sola, e con una cache in processo che restituisce
lo stesso indirizzo finché è valido — è quest'ultima a rendere la cache del
browser davvero efficace, perché un indirizzo che cambia a ogni richiesta
non verrebbe mai riusato.
"""

import time
from typing import Any, cast

from app.core.config import get_settings
from app.core.supabase import get_service_client

BUCKET = "copertine"

DURATA_FIRMA_SECONDI = 7 * 24 * 60 * 60

# Si rifirma un giorno prima della scadenza: l'URL consegnato al browser
# deve restare valido per tutto il tempo in cui la pagina può stare aperta,
# non scadere fra le mani di chi la sta guardando.
_MARGINE_RINNOVO_SECONDI = 24 * 60 * 60

_cache_firme: dict[str, tuple[str, float]] = {}


def percorso_miniatura(libro_id: str) -> str:
    return f"{libro_id}/miniatura.webp"


def percorso_grande(libro_id: str) -> str:
    return f"{libro_id}/grande.webp"


def carica(percorso: str, contenuto: bytes, content_type: str = "image/webp") -> None:
    """Carica (o sovrascrive) un file nel bucket delle copertine.

    `upsert` attivo: un recupero rieseguito fuori banda sulla stessa opera
    deve sostituire l'immagine, non fallire perché il file esiste già.
    """
    client = get_service_client()
    client.storage.from_(BUCKET).upload(
        path=percorso,
        file=contenuto,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    _cache_firme.pop(percorso, None)


def _normalizza(url: str) -> str:
    """Supabase restituisce, secondo la versione, un indirizzo assoluto
    oppure relativo (`/object/sign/...`). Normalizzare qui evita che la
    differenza arrivi fino al `src` di un tag immagine."""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    settings = get_settings()
    return f"{settings.supabase_url}/storage/v1{url if url.startswith('/') else '/' + url}"


def firma_in_blocco(percorsi: list[str]) -> dict[str, str]:
    """Da percorsi interni a URL consegnabili al browser, in una chiamata.

    Una chiamata per l'intero scaffale, non una per copertina: firmarne
    cento singolarmente sarebbe cento richieste all'API Storage dentro una
    sola richiesta di pagina. I percorsi già in cache non vengono nemmeno
    inviati.

    Un percorso che non si riesce a firmare viene omesso dal risultato
    invece di far fallire la richiesta: una copertina mancante è un
    segnaposto, mai una pagina che non si apre.
    """
    adesso = time.time()
    risultato: dict[str, str] = {}
    da_firmare: list[str] = []

    for percorso in dict.fromkeys(percorsi):
        voce = _cache_firme.get(percorso)
        if voce is not None and voce[1] > adesso:
            risultato[percorso] = voce[0]
        else:
            da_firmare.append(percorso)

    if not da_firmare:
        return risultato

    client = get_service_client()
    try:
        firmati = cast(
            "list[dict[str, Any]]",
            client.storage.from_(BUCKET).create_signed_urls(da_firmare, DURATA_FIRMA_SECONDI),
        )
    except Exception:  # noqa: BLE001  # vedi docstring: mai far cadere la pagina
        return risultato

    scadenza = adesso + DURATA_FIRMA_SECONDI - _MARGINE_RINNOVO_SECONDI
    for riga in firmati:
        percorso_firmato = riga.get("path")
        url = riga.get("signedURL") or riga.get("signedUrl")
        if not percorso_firmato or not url:
            continue
        assoluto = _normalizza(str(url))
        _cache_firme[str(percorso_firmato)] = (assoluto, scadenza)
        risultato[str(percorso_firmato)] = assoluto

    return risultato


def svuota_cache_firme() -> None:
    """Solo per i test: la cache è di processo e sopravviverebbe tra casi."""
    _cache_firme.clear()
