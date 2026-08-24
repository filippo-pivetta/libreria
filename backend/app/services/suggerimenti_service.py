"""I suggerimenti di lettura (issue #27, riscritti il 22 agosto 2026 da
un elenco piatto — storico e testi propri senza gerarchia — a un profilo
in tre gruppi con ruoli diversi, verificati contro i cataloghi prima di
uscire).

PRD: "suggerimenti di lettura a partire dal solo storico personale, mai
da quello dei collegati: funzione a sé, che propone cosa leggere" —
distinta dalla preview, che dà un parere su un titolo che l'Utente ha già
indicato. Effimeri per scelta di prodotto: il PRD non li elenca fra gli
`artefatto_generato` (che cita solo preview e sintesi), quindi non si
salvano — ogni richiesta ne genera di nuovi, senza riga nel database.

**Il profilo a tre gruppi** — pilastri, recenti, delusi — vive in
`app/services/profilo_lettura.py`, non qui: dal 24 agosto 2026 lo usa
anche la preview personalizzata, e la classificazione dev'essere
un'unica fonte di verità per le due funzioni (vedi il docstring di quel
modulo per i criteri).

**La verifica, dopo il modello**: si chiedono fino a otto candidati (non
cinque) proprio perché alcuni non superano il passo successivo — ogni
titolo si cerca davvero nei cataloghi (locale poi esterno, stesso
procedimento di `/aggiungi`) e chi non risulta da nessuna parte non esce
mai dal servizio. È il correttivo al difetto osservato il 22 agosto 2026:
un titolo come "Odio e amore" di "amor di narrazione" non deve più
arrivare all'Utente, nemmeno per un istante.
"""

import asyncio
import re
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm_personale
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.supabase import get_user_client
from app.repositories import preview_repository
from app.services import consenso as consenso_service
from app.services import profilo_lettura, ricerca_service, risoluzione

MASSIMO_CANDIDATI = 8
MASSIMO_SUGGERIMENTI = 5
MASSIMO_STESSO_AUTORE = 2
"""Sovra-generazione: si chiede al modello fino a otto proposte per
poterne verificare e scartare alcune (titoli inesistenti, autori
ripetuti oltre `MASSIMO_STESSO_AUTORE`) e uscire comunque con cinque
buone, invece di cinque che diventano tre dopo la verifica."""


class ContenutoInsufficienteError(Exception):
    """Nessun libro amato, nessuna lettura conclusa, nessun deluso:
    profilo vuoto, niente su cui basare un suggerimento onesto. Sollevata
    prima di chiamare il modello."""


_PATTERN_INIEZIONE = re.compile(
    r"ignora\s+(le istruzioni|quanto (sopra|detto|scritto)|tutto (quello|ciò))"
    r"|disregard\s+(the\s+)?(above|previous|prior)"
    r"|ignore\s+(the\s+)?(above|previous|prior)\s+instructions?"
    r"|system\s?prompt"
    r"|(sei ora|d'ora in poi sei|you are now|act as|comportati come)"
    r"|(rivela|mostra|stampa)\w*\s+.{0,20}(istruzion|prompt)"
    r"|(reveal|show|print)\s+.{0,20}(instruction|prompt)",
    re.IGNORECASE,
)


def _nota_sicura(nota: str | None) -> str | None:
    """La nota libera dell'Utente entra nel prompt come preferenza da
    considerare, non come istruzione — ma è il primo testo scritto
    liberamente per QUESTA richiesta (non un insight, non una recensione
    già esistente e già filtrata dal profilo) ad avere un ruolo vicino a
    un'istruzione, ed è la prima superficie di prompt injection del
    prodotto.

    Un filtro per parole chiave non è una difesa robusta — si aggira
    parafrasando o traducendo, e non lo si presenta come tale — ma qui il
    danno massimo di un'iniezione riuscita resta comunque basso: l'output
    resta vincolato allo schema JSON di `chiama_json`
    (titolo/autori/motivazione/tipo), non c'è alcuna azione né dato di
    altri Utenti raggiungibile da questa funzione. Il filtro scarta,
    non prova a ripulire: una nota sospetta si ignora del tutto, come le
    virgolette di una preview non conforme, non si tenta di isolarne la
    parte "buona".
    """
    if not nota or not nota.strip():
        return None
    if _PATTERN_INIEZIONE.search(nota):
        return None
    return nota.strip()


async def genera(
    access_token: str, utente_id: UUID, nota: str | None = None
) -> list[dict[str, Any]]:
    await consenso_service.esigi_consenso(access_token, utente_id)

    client = get_user_client(access_token)
    profilo = await run_in_threadpool(preview_repository.profilo_suggerimenti, client, utente_id)
    pilastri, recenti, delusi, esclusi = profilo_lettura.classifica(profilo)
    if not pilastri and not recenti and not delusi:
        raise ContenutoInsufficienteError

    grezzi = await llm_personale.genera_suggerimenti(
        pilastri, recenti, delusi, esclusi, nota=_nota_sicura(nota)
    )
    return await _verifica_e_diversifica(access_token, utente_id, grezzi, esclusi)


_TRATTINO = re.compile(r"\s*[—–]\s*")
_PUNTEGGIATURA_DOPPIA = re.compile(r",\s*([,.;:!?])")


def _senza_trattini(testo: str) -> str:
    """Sostituisce ogni trattino lungo (—) o medio (–) con una virgola,
    mai chiesto come garanzia al modello (che pure lo riceve nel prompt)
    ma applicato qui: a differenza delle virgolette nella preview — dove
    un output fuori regola si scarta e basta, perché non c'è modo di
    correggerlo senza mutilare una citazione — un trattino sostituito con
    una virgola non toglie né altera nulla del contenuto, è normalizzazione
    di punteggiatura, non un tentativo di salvare un testo scorretto.
    """
    senza_trattini = _TRATTINO.sub(", ", testo)
    return _PUNTEGGIATURA_DOPPIA.sub(r"\1", senza_trattini).strip()


async def _verifica_e_diversifica(
    access_token: str, utente_id: UUID, grezzi: list[dict[str, Any]], esclusi: set[str]
) -> list[dict[str, Any]]:
    candidati: list[dict[str, Any]] = []
    for grezzo in grezzi:
        titolo = str(grezzo.get("titolo") or "").strip()
        if not titolo or titolo.casefold() in esclusi:
            continue
        autori_grezzi = grezzo.get("autori")
        autori = [str(a) for a in autori_grezzi] if isinstance(autori_grezzi, list) else []
        tipo = grezzo.get("tipo") if grezzo.get("tipo") in ("affine", "scoperta") else "affine"
        candidati.append(
            {
                "titolo": titolo,
                "autori": autori,
                "motivazione": _senza_trattini(str(grezzo.get("motivazione") or "")),
                "tipo": tipo,
            }
        )
        if len(candidati) >= MASSIMO_CANDIDATI:
            break

    esistenze = await asyncio.gather(
        *(_esiste_nei_cataloghi(access_token, utente_id, c) for c in candidati)
    )

    finali: list[dict[str, Any]] = []
    per_autore: dict[str, int] = {}
    for candidato, esiste in zip(candidati, esistenze, strict=True):
        if not esiste:
            continue
        primo_autore = candidato["autori"][0].casefold() if candidato["autori"] else None
        if primo_autore and per_autore.get(primo_autore, 0) >= MASSIMO_STESSO_AUTORE:
            continue
        if primo_autore:
            per_autore[primo_autore] = per_autore.get(primo_autore, 0) + 1
        finali.append(candidato)
        if len(finali) >= MASSIMO_SUGGERIMENTI:
            break
    return finali


def _autori_si_sovrappongono(dichiarati: list[str], verificati: list[str]) -> bool:
    """Vero se il cognome di almeno un autore coincide fra ciò che il
    modello dichiara e ciò che il catalogo dice davvero.

    Riusa `risoluzione.autori_compatibili` invece di un confronto scritto
    qui: stesso identico problema che quella funzione già risolve per la
    risoluzione bibliografica (due fonti che traslitterano lo stesso
    autore in forme diverse — "Michail Bulgakov" contro "Mikhail
    Bulgakov" — e il cognome, di solito più stabile del nome, è ciò che
    fa coincidere il confronto). Tenerne una seconda copia qui sarebbe
    esattamente il difetto che il docstring di `app/core/testo.py`
    descrive: una correzione a una non raggiungerebbe l'altra.

    Nessun autore dichiarato non è un disaccordo, a differenza di
    `autori_compatibili` (che lì richiede sempre due elenchi non vuoti,
    perché confronta due opere reali): un candidato senza autore non ha
    nulla da smentire."""
    if not dichiarati:
        return True
    return risoluzione.autori_compatibili(dichiarati, verificati)


async def _esiste_nei_cataloghi(
    access_token: str, utente_id: UUID, candidato: dict[str, Any]
) -> bool:
    """Vero se il titolo proposto risulta davvero da qualche parte, **con
    l'autore che il modello dichiara** — prima il catalogo locale (gratis,
    niente quota), poi quello esterno solo se il primo non trova nulla.
    Procedimento imparentato con quello di `/aggiungi`, ma non identico:
    lì si cerca per farsi trovare risultati plausibili, qui si verifica
    un'affermazione, e le due cose hanno bisogno di precisione diversa.

    **Solo il titolo** per la ricerca locale, mai titolo e autori
    insieme: `cerca_libri` confronta l'intera stringa ricevuta come
    unico blocco (`LIKE '%termine%'` contro titolo O contro autore, non
    un AND fra i due), quindi "Il barone rampante Italo Calvino" non
    risulta sottostringa né del titolo né del nome dell'autore e la
    ricerca locale fallisce sempre — anche per un libro già in catalogo
    (verificato il 22 agosto 2026: la combinazione restituiva zero
    risultati per un libro con quell'esatto titolo e autore in tabella).
    Un risultato locale si accetta senza controllare l'autore: ogni
    scheda del catalogo locale è già passata una volta dalla risoluzione
    completa (`risoluzione.py`) quando è stata aggiunta la prima volta,
    non è testo del modello.

    **`intitle:` per la ricerca esterna, non testo libero**: Google Books
    con `q="titolo autori"` fa una ricerca di rilevanza, non un confronto
    — restituisce quasi sempre qualcosa, anche per un titolo inventato
    (verificato il 22 agosto 2026: "Causa di morte sconosciuta Umberto
    Eco", titolo di un libro vero ma di Tess Gerritsen, ha restituito un
    risultato di un autore terzo che non c'entrava nulla; "Il nome del
    padre" attribuito a Silvia Avallone non esiste affatto, eppure la
    ricerca libera aveva comunque restituito qualcosa). `intitle:` cerca
    nel solo campo titolo e torna vuoto se la frase non compare in alcun
    titolo indicizzato — un confronto, non un ranking.

    Un titolo esterno che risulta ma con un autore che non condivide
    nemmeno una parola con quanto dichiarato **non basta**: è il caso
    Gerritsen/Eco, un titolo vero attribuito all'autore sbagliato, e
    mostrarlo comunque (magari correggendo l'autore in silenzio)
    lascerebbe la motivazione a lodare uno stile che non è quello del
    libro che si sta per aggiungere.
    """
    locali = await ricerca_service.cerca_locale(access_token, candidato["titolo"], limite=1)
    if locali:
        return True

    query_esterna = f'intitle:"{candidato["titolo"]}"'
    try:
        esterni = await ricerca_service.cerca_esterna(
            access_token, utente_id, query_esterna, limite=5
        )
    except FonteNonRaggiungibileError:
        # Il catalogo esterno non risponde: non è una prova che il libro
        # non esista, ma nemmeno lo si può confermare — si scarta questo
        # candidato piuttosto che mostrarlo non verificato (stessa scelta
        # del PRD sulla foto illeggibile: "nessun testo inventato").
        return False

    return any(
        _autori_si_sovrappongono(candidato["autori"], r.get("autori") or []) for r in esterni
    )
