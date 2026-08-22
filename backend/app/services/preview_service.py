"""La preview personalizzata "me lo consigli?" (issue #6).

Il PRD la descrive come "un parere su quel titolo a partire dallo storico
e dagli insight di chi la chiede: privata per costruzione, non
condivisibile, e distinta dai suggerimenti di lettura". È una delle cinque
funzioni che il consenso copre, e l'unica di questo branch che *scrive* un
contenuto nuovo nella libreria — un `artefatto_generato`, che da quel
momento è roba dell'Utente e sopravvive alla revoca del consenso (regola
32).

La regola 20 è verificata qui e non delegata al prompt: "una preview
generata non supera le ottanta parole, non contiene testo tra virgolette e
riporta l'indicazione di essere una sintesi generata". Le prime due
condizioni si misurano sul testo, ed è quello che fa `_conforme`; la terza
non è testo che il modello debba ricordarsi di scrivere ma un campo
obbligatorio della risposta (`AVVISO`), perché un'indicazione che dipende
dall'obbedienza del modello è un'indicazione che prima o poi manca.
"""

import logging
import re
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm_personale
from app.core.supabase import get_user_client
from app.repositories import artefatto_repository, preview_repository
from app.services import consenso as consenso_service

logger = logging.getLogger("app.services.preview")

TIPO = "preview_personalizzata"

AVVISO = "Sintesi generata"
"""L'indicazione che la regola 20 pretende. Campo della risposta e non
frase dentro il testo: così non può mancare, e non consuma nessuna delle
ottanta parole."""

MASSIMO_PAROLE = 80

_VIRGOLETTE = '"«»“”„‘'
"""Ogni comparsa di uno di questi caratteri è una citazione, e la regola
20 le vieta tutte: virgolette dritte, caporali, curve inglesi e tedesche,
più la singola curva di apertura (‘), che in italiano non ha altro uso.

Fuori dall'elenco stanno l'apostrofo dritto (') e quello tipografico (’),
che in italiano compaiono a ogni riga in "dell'amicizia", "un'affinità".
Vietarli — anche solo a coppie, cercando del testo racchiuso — avrebbe
respinto quasi ogni frase corretta: "e di un'affinità rara con l'autore"
contiene una coppia perfettamente apostrofata. Una citazione fra
apostrofi dritti resta quindi teoricamente possibile; il prompt la vieta,
e nessun controllo automatico può distinguerla da due elisioni vicine
senza leggere la frase.
"""


class PreviewNonConformeError(Exception):
    """Il modello ha risposto, ma fuori dai vincoli della regola 20, due
    volte di fila.

    Trattata come una fonte che non risponde e non come un errore
    interno — stessa filosofia del "JSON fuori schema" di ADR 0017: un
    output non conforme non si salva e non si aggiusta, perché aggiustarlo
    (troncare a ottanta parole, togliere le virgolette) produrrebbe un
    testo mutilato firmato come se fosse quello che il modello ha detto.
    """


class VoceNonTrovataError(Exception):
    """La Voce non esiste o non è di chi chiede."""


def _conta_parole(testo: str) -> int:
    return len([p for p in re.split(r"\s+", testo.strip()) if p])


def _conforme(testo: str) -> bool:
    if not testo.strip():
        return False
    if _conta_parole(testo) > MASSIMO_PAROLE:
        return False
    return not any(c in testo for c in _VIRGOLETTE)


async def genera(access_token: str, utente_id: UUID, voce_id: UUID) -> dict[str, Any]:
    await consenso_service.esigi_consenso(access_token, utente_id)

    client = get_user_client(access_token)
    scheda = await run_in_threadpool(
        preview_repository.scheda_del_libro, client, voce_id, utente_id
    )
    if scheda is None:
        raise VoceNonTrovataError

    storico = await run_in_threadpool(
        preview_repository.storico_personale, client, utente_id, voce_id
    )
    testi = await run_in_threadpool(preview_repository.testi_propri, client, utente_id)

    testo = await _genera_conforme(scheda, storico, testi)

    artefatto = await run_in_threadpool(
        artefatto_repository.create, client, utente_id, TIPO, voce_id, testo
    )
    return {**artefatto, "avviso": AVVISO}


async def _genera_conforme(
    scheda: dict[str, Any],
    storico: list[tuple[str, list[str], list[str], float | None]],
    testi: list[str],
) -> str:
    """Un solo secondo tentativo, non un ciclo: se due risposte di fila
    escono dai vincoli, il problema è il prompt o il modello, e insistere
    spende soldi per lo stesso esito."""
    for tentativo in (1, 2):
        testo = (
            await llm_personale.genera_preview(
                titolo=scheda["titolo"],
                autori=scheda["autori"],
                generi=scheda["generi"],
                anno_prima_pubblicazione=scheda["anno_prima_pubblicazione"],
                descrizione=scheda["descrizione"],
                libri_letti=storico,
                testi_propri=testi,
            )
        ).strip()
        if _conforme(testo):
            return testo
        logger.warning(
            "Preview fuori dai vincoli della regola 20 al tentativo %s (%s parole).",
            tentativo,
            _conta_parole(testo),
        )
    raise PreviewNonConformeError


async def ultima(access_token: str, voce_id: UUID) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    artefatto = await run_in_threadpool(artefatto_repository.ultimo_per_voce, client, voce_id, TIPO)
    if artefatto is None:
        return None
    return {**artefatto, "avviso": AVVISO}


async def cancella(access_token: str, artefatto_id: UUID) -> bool:
    """Non c'è alcun controllo di consenso: cancellare un proprio
    contenuto resta possibile a interruttore spento, ed è l'altra faccia
    della regola 32 — la revoca non tocca gli artefatti, ma nemmeno li
    imprigiona."""
    client = get_user_client(access_token)
    return await run_in_threadpool(artefatto_repository.delete, client, artefatto_id)
