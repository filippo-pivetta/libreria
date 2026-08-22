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
condizioni si misurano sul testo, con `testo_generato.genera_conforme`
(estratto da qui con l'issue #27, quando la sintesi tematica ha iniziato a
chiedere la stessa disciplina con un tetto di parole diverso); la terza non
è testo che il modello debba ricordarsi di scrivere ma un campo
obbligatorio della risposta (`AVVISO`), perché un'indicazione che dipende
dall'obbedienza del modello è un'indicazione che prima o poi manca.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm_personale
from app.core.supabase import get_user_client
from app.repositories import artefatto_repository, preview_repository
from app.services import consenso as consenso_service
from app.services import testo_generato

TIPO = "preview_personalizzata"

AVVISO = "Sintesi generata"
"""L'indicazione che la regola 20 pretende. Campo della risposta e non
frase dentro il testo: così non può mancare, e non consuma nessuna delle
ottanta parole."""

MASSIMO_PAROLE = 80

PreviewNonConformeError = testo_generato.TestoNonConformeError
"""Alias e non un tipo nuovo: stesso errore di `testo_generato`, con il
nome storico di questo modulo perché router e test lo importano da qui."""


class VoceNonTrovataError(Exception):
    """La Voce non esiste o non è di chi chiede."""


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
    return await testo_generato.genera_conforme(
        lambda: llm_personale.genera_preview(
            titolo=scheda["titolo"],
            autori=scheda["autori"],
            generi=scheda["generi"],
            anno_prima_pubblicazione=scheda["anno_prima_pubblicazione"],
            descrizione=scheda["descrizione"],
            libri_letti=storico,
            testi_propri=testi,
        ),
        MASSIMO_PAROLE,
    )


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
