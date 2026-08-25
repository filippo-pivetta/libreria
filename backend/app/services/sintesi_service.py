"""La sintesi tematica trasversale (issue #27, riscritta il 22 agosto 2026
da un unico paragrafo a un elenco di temi con le prove attaccate).

Un primo giro d'uso ha mostrato il difetto della versione a prosa: duecento
parole senza vincoli di sostanza producevano una parafrasi gonfiata
dell'unico insight disponibile, non verificabile e senza alcun posto dove
andare. La versione a temi risolve tutti e tre i problemi:

- **verificabile**: ogni tema porta il numero di libri distinti che lo
  sostengono e, su richiesta, gli insight/recensioni veri che lo hanno
  generato — non un'affermazione a prendere o lasciare;
- **non un vicolo cieco**: ogni libro citato è un collegamento alla sua
  scheda;
- **onesta quando il materiale non basta**: un tema sostenuto da un solo
  libro non è "trasversale" per definizione (PRD: "tra libri diversi") e
  viene scartato, non prodotto lo stesso per riempire la pagina. Se dopo
  il filtro non resta alcun tema, non si genera né si sostituisce nulla —
  meglio nessuna sintesi che una sintesi vuota o inventata.

Il PRD non elenca duecento parole né un tetto di libri per questa
funzione, a differenza della regola 20 per la preview: le soglie sotto
sono una scelta di questa implementazione, tarate a occhio come lo è
stata la soglia di `cerca_semantico`, e riviste allo stesso modo se
l'uso reale le smentisce.
"""

import json
import logging
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm_personale
from app.core.supabase import get_user_client
from app.repositories import artefatto_repository, preview_repository
from app.services import consenso as consenso_service
from app.services import testo_generato

logger = logging.getLogger("app.services.sintesi")

TIPO = "sintesi_tematica"

AVVISO = "Sintesi generata"
"""Stessa stringa e stessa ragione della preview: un'indicazione che non
può dipendere dall'obbedienza del modello."""

MINIMO_LIBRI_PER_TEMA = 2
"""Sotto questa soglia un tema non è "trasversale ... tra libri diversi"
(PRD): è un'osservazione su un libro solo, che appartiene alla scheda di
quel libro, non a una vista che promette di attraversarli. Tarata al
minimo che la parola "trasversale" richiede letteralmente, non un valore
di comodo."""

MASSIMO_PAROLE_NOME = 6
MASSIMO_PAROLE_SINTESI = 25
"""Il tetto della preview (ottanta parole) copre un parere su un libro
solo; qui ogni tema deve stare in una riga sola, perché la pagina ne
mostra più di uno — venticinque parole bastano per una frase concreta e
non per riempire."""

MASSIMO_TENTATIVI = 2
"""Stesso principio del "un solo secondo tentativo" della preview: se due
generazioni di fila non producono alcun tema che superi i filtri, il
problema è il materiale o il prompt, non la sfortuna — e ritentare
all'infinito spenderebbe soldi per lo stesso esito."""


class ContenutoInsufficienteError(Exception):
    """Nessun insight né recensione: niente da cui trovare un tema, niente
    da pagare per scoprirlo. Sollevata prima di chiamare il modello."""


class NessunTemaRilevanteError(Exception):
    """Il materiale c'è ma non emerge alcun tema trasversale: o perché i
    testi appartengono a un solo libro (non serve nemmeno chiamare il
    modello per saperlo — nessun tema può superare `MINIMO_LIBRI_PER_TEMA`
    con un solo libro in gioco), o perché il modello non ne ha trovati
    dopo `MASSIMO_TENTATIVI` prove. Stesso trattamento in entrambi i
    casi: niente si genera, niente sostituisce la sintesi esistente."""


async def genera(access_token: str, utente_id: UUID) -> dict[str, Any]:
    await consenso_service.esigi_consenso(access_token, utente_id)

    client = get_user_client(access_token)
    riferimenti = await run_in_threadpool(
        preview_repository.testi_propri_con_riferimenti, client, utente_id
    )
    if not riferimenti:
        raise ContenutoInsufficienteError

    libri_distinti = {r["voce_id"] for r in riferimenti if r.get("voce_id")}
    if len(libri_distinti) < MINIMO_LIBRI_PER_TEMA:
        # Nessuna chiamata al modello: con un libro solo in gioco nessun
        # tema può superare la soglia, il risultato è già certo.
        raise NessunTemaRilevanteError

    temi = await _genera_temi_validi(riferimenti)
    if not temi:
        raise NessunTemaRilevanteError

    # Si cancella la sintesi precedente SOLO dopo avere quella nuova
    # pronta: un fallimento a metà non deve lasciare l'Utente senza
    # alcuna sintesi (stessa ragione della preview per la regola 32).
    precedente = await run_in_threadpool(
        artefatto_repository.ultimo_per_utente_e_tipo, client, utente_id, TIPO
    )
    if precedente is not None:
        await run_in_threadpool(artefatto_repository.delete, client, UUID(str(precedente["id"])))

    corpo = json.dumps({"temi": temi}, ensure_ascii=False)
    artefatto = await run_in_threadpool(
        artefatto_repository.create, client, utente_id, TIPO, None, corpo
    )
    return _rispondi(artefatto)


async def _genera_temi_validi(riferimenti: list[dict[str, Any]]) -> list[dict[str, Any]]:
    coppie = [(r["titolo"], r["testo"]) for r in riferimenti]
    for tentativo in (1, 2):
        grezzi = await llm_personale.genera_temi(coppie)
        validi = _filtra(grezzi, riferimenti)
        if validi:
            return validi
        logger.warning("Nessun tema valido al tentativo %s (%s proposti).", tentativo, len(grezzi))
    return []


def _filtra(
    grezzi: list[dict[str, Any]], riferimenti: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Ogni tema grezzo del modello passa tre controlli indipendenti,
    nessuno dei quali si fida di ciò che il modello dichiara: la
    conformità di forma di `nome` e `sintesi` (stesso meccanismo della
    regola 20 per la preview), e la soglia sui libri distinti — ricalcolata
    qui sugli indici risolti, non presa dal conteggio del modello."""
    validi = []
    for grezzo in grezzi:
        if not isinstance(grezzo, dict):
            continue
        nome = str(grezzo.get("nome") or "").strip()
        sintesi = str(grezzo.get("sintesi") or "").strip()
        if not testo_generato.conforme(nome, MASSIMO_PAROLE_NOME):
            continue
        if not testo_generato.conforme(sintesi, MASSIMO_PAROLE_SINTESI):
            continue

        indici = grezzo.get("indici")
        if not isinstance(indici, list):
            continue
        visti: set[int] = set()
        risolti: list[dict[str, Any]] = []
        for indice in indici:
            if not isinstance(indice, int) or indice in visti:
                continue
            if indice < 0 or indice >= len(riferimenti):
                continue
            visti.add(indice)
            risolti.append(riferimenti[indice])

        libri_distinti = {r["voce_id"] for r in risolti if r.get("voce_id")}
        if len(libri_distinti) < MINIMO_LIBRI_PER_TEMA:
            continue

        validi.append(
            {
                "nome": nome,
                "sintesi": sintesi,
                "riferimenti": [
                    {
                        "contenuto_id": str(r["contenuto_id"]),
                        "voce_id": str(r["voce_id"]),
                        "titolo": r["titolo"],
                        "tipo": r["tipo"],
                        "testo": r["testo"],
                        "data": r["data"],
                    }
                    for r in risolti
                ],
            }
        )
    return validi


async def ultima(access_token: str, utente_id: UUID) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    artefatto = await run_in_threadpool(
        artefatto_repository.ultimo_per_utente_e_tipo, client, utente_id, TIPO
    )
    if artefatto is None:
        return None
    return _rispondi(artefatto)


def _rispondi(artefatto: dict[str, Any]) -> dict[str, Any]:
    corpo = json.loads(artefatto["testo"])
    return {
        "id": artefatto["id"],
        "creato_at": artefatto["creato_at"],
        "avviso": AVVISO,
        "temi": corpo["temi"],
    }
