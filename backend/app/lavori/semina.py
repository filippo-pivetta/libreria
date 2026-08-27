"""Semina di una scheda che nessun Utente ha ancora chiesto.

Il catalogo locale nasce vuoto, e un catalogo vuoto si sente: ogni ricerca
ricade sui risultati esterni, ogni aggiunta paga la catena di risoluzione
per intero (oltre dieci secondi, misurati) e due Utenti che cercano lo
stesso classico nello stesso giorno la pagano tutti e due. Seminare le
opere piu' lette anticipa quel costo una volta sola.

**Non e' una via d'ingresso nuova.** Questo modulo non sa far nascere una
scheda: trova un'opera su Google e la passa a
`ricerca_service.assicura_scheda`, la stessa funzione che serve
`POST /libri`. Una scheda seminata e' indistinguibile da una aggiunta da
un Utente, e deve restarlo — se le due vie divergessero, ADR 0002 si
troverebbe con due identita' invece di una.

Due cose che sembrano difetti e non lo sono:

- **Non crea alcuna Voce.** Il catalogo e' dato condiviso, la Voce e' di
  un Utente (ADR 0001). Seminare non mette un libro nella libreria di
  nessuno, e un libro seminato che nessuno legge resta una scheda e
  basta.
- **Non trovare l'opera e' un successo, non un fallimento.** Se Google ha
  risposto e nessun risultato regge il confronto con l'autore, il lavoro
  RIESCE: la fonte ha detto la sua, e ritentare tre volte darebbe la
  stessa risposta. E' la stessa distinzione che `app/lavori/copertine.py`
  fa fra "copertina assente" (esito) e "fonte irraggiungibile" (errore).
"""

import logging
from typing import Any

from app.cataloghi import google_books
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.testo import cognomi, normalizza
from app.lavori.errori import ErroreTransitorio

logger = logging.getLogger("app.lavori.semina")

MASSIMO_RISULTATI = 10
"""Quanti volumi chiedere a Google. Piu' in alto non aiuta: se l'opera
non e' nei primi dieci risultati di titolo + autore, non e' il titolo che
si sta cercando."""

SOGLIA_TITOLO = 0.6
"""Quota di parole in comune fra i due titoli, sul PIU' LUNGO dei due.

Non un confronto esatto: la lista di partenza porta il titolo canonico di
Open Library, che per la stessa opera puo' essere in una terza lingua
("O Alquimista" per "L'alchimista"), e i due sottotitoli non coincidono
quasi mai. Serve quindi tolleranza sulle parole in piu' — ma poca.

Il denominatore e' il titolo piu' lungo e non il piu' corto, e la
differenza non e' accademica: misurato dal vivo, cercando "Nineteen
Eighty-Four" di Orwell, Google restituisce fra i primi risultati
un'antologia tedesca intitolata "George Orwell: 1984 / Nineteen
Eighty-Four". Contiene tutte e tre le parole attese, quindi sul titolo
piu' corto prendeva punteggio pieno e veniva seminata al posto
dell'opera — con l'anno dell'antologia (1980) al posto di quello
dell'opera. Sul piu' lungo prende 3/6 e viene scartata."""


async def esegui(payload: dict[str, Any]) -> None:
    titolo = str(payload.get("titolo") or "").strip()
    autori = [str(a) for a in (payload.get("autori") or [])]
    if not titolo:
        # Un payload senza titolo non e' recuperabile da nessun tentativo,
        # ma non e' nemmeno un guasto della fonte: si chiude e si registra.
        logger.warning("Semina senza titolo, payload ignorato: %r", payload)
        return

    termine = f"{titolo} {autori[0]}" if autori else titolo
    try:
        volumi = await google_books.cerca(termine, massimo=MASSIMO_RISULTATI)
    except FonteNonRaggiungibileError as errore:
        # Quota esaurita compresa: e' il caso piu' probabile durante una
        # semina in blocco, ed e' transitorio per definizione — la quota
        # di Google si azzera ogni giorno.
        raise ErroreTransitorio(errore.motivo) from errore

    opera = _scegli(google_books.collassa_per_opera(volumi), titolo, autori)
    if opera is None:
        logger.info("Semina senza corrispondenza: %r di %r", titolo, autori)
        return

    from app.services import ricerca_service

    libro_id = await ricerca_service.assicura_scheda(opera)
    logger.info("Seminato %r -> libro %s", titolo, libro_id)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuno stato osservabile da correggere, e qui e' davvero cosi'.

    Gli altri gestori usano questo gancio per non lasciare divergere la
    coda dalla scheda (`libro.copertina_stato` che resterebbe 'in_attesa'
    per sempre). La semina non ha quella divergenza da chiudere: se
    fallisce, la scheda semplicemente non nasce, e "non nata" e' gia'
    rappresentato correttamente dall'assenza della riga.

    Resta il log, che e' l'unica traccia di un'opera della lista che il
    catalogo non ha preso — insieme allo stato 'fallito' della riga in
    coda, da cui si riaccoda.
    """
    logger.warning("Semina fallita per %r: %s", payload.get("titolo"), errore)


def _scegli(
    opere: list[google_books.Opera], titolo: str, autori: list[str]
) -> google_books.Opera | None:
    """Il primo risultato che regge il confronto con titolo E autore.

    Il vincolo sull'autore non e' pignoleria: cercando un classico per
    titolo, Google restituisce guide di lettura, riassunti e antologie
    che lo citano, e prendere il primo risultato seminerebbe quelli. Il
    confronto e' sui cognomi (`app/core/testo.py`), perche' i cataloghi
    alternano "Umberto Eco" ed "Eco, Umberto" per la stessa persona.

    Un'opera senza autori dichiarati da Google non passa: preferiamo non
    seminare che seminare la cosa sbagliata, perche' una scheda nata male
    va poi fusa a mano (`fondi_libro`), che costa piu' di una semina persa.
    """
    attesi = cognomi(autori)
    parole_attese = set(normalizza(titolo).split())
    if not parole_attese:
        return None

    migliore: google_books.Opera | None = None
    punteggio_migliore = 0.0
    for opera in opere:
        volume = opera.rappresentante
        if attesi and not (cognomi(list(volume.autori)) & attesi):
            continue
        parole = set(normalizza(volume.titolo).split())
        if not parole:
            continue
        punteggio = len(parole & parole_attese) / max(len(parole), len(parole_attese))
        # Stretto, non `>=`: a pari punteggio vince chi Google ha messo
        # prima, che e' l'unico ordinamento per rilevanza che abbiamo.
        if punteggio > punteggio_migliore:
            migliore, punteggio_migliore = opera, punteggio

    return migliore if punteggio_migliore >= SOGLIA_TITOLO else None
