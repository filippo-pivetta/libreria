"""Orchestrazione di `/me`: composizione di `utente` + `utente_privato`,
caso "non ancora provisionato", completamento dell'account dopo l'invito
del Manutentore (docs/adr/0013), cambio del consenso all'elaborazione
assistita (issue #6) e cancellazione dell'account (issue #8).
"""

import logging
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_service_client, get_user_client
from app.repositories import (
    database,
    indice_semantico_repository,
    lavoro_repository,
    utente_repository,
)
from app.services import consenso as consenso_service

logger = logging.getLogger(__name__)


class NomeUtenteInUsoError(Exception):
    """Il nome utente scelto è già assegnato a un altro account
    (vincolo `uq_utente_nome_utente`)."""


class AccountGiaCompletatoError(Exception):
    """Questo utente ha già una riga `public.utente` (vincolo
    `utente_pkey`): probabile doppio invio dello stesso completamento."""


class ContoNonTrovatoError(Exception):
    """Nessuna riga `public.utente` per questo id: l'account non è mai
    stato completato (docs/adr/0013), quindi non c'è nulla da cancellare
    da questo canale."""


class ConfermaNonCorrispondenteError(Exception):
    """La stringa digitata non coincide con `nome_utente` (PRD regola 28):
    la cancellazione non deve procedere. Non è un errore di autorizzazione
    — l'utente sta cancellando il proprio account, non quello di
    qualcun altro — per questo il router la mappa su 400, non su 403."""


async def get_me(access_token: str, utente_id: UUID) -> dict[str, Any] | None:
    # RLS valutata con l'identità dell'utente, mai con la chiave di
    # servizio, per le richieste di utenti (docs/adr/0001).
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        return None

    utente_privato = await run_in_threadpool(
        utente_repository.get_utente_privato, client, utente_id
    )
    if utente_privato is None:
        # Le due righe nascono sempre insieme dentro completa_registrazione
        # (docs/adr/0013): se manca la seconda, il completamento non è mai
        # arrivato in fondo. Stesso trattamento del caso "nessuna riga
        # utente".
        return None

    return {**utente, **utente_privato}


async def complete_account(access_token: str, nome_utente: str) -> dict[str, Any]:
    # RLS valutata con l'identità dell'utente, mai con la chiave di
    # servizio, per le richieste di utenti (docs/adr/0001).
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(utente_repository.complete_registration, client, nome_utente)
    except APIError as error:
        if error.code == "23505":
            message = error.message or ""
            if "uq_utente_nome_utente" in message:
                raise NomeUtenteInUsoError from error
            if "utente_pkey" in message:
                raise AccountGiaCompletatoError from error
        raise


async def aggiorna_consenso(
    access_token: str, utente_id: UUID, consenso: bool
) -> dict[str, Any] | None:
    """Accende o spegne l'elaborazione assistita, con le conseguenze che
    il PRD le attribuisce.

    Revoca: si scrive prima il flag e solo dopo si cancellano i vettori.
    L'ordine è deliberato — dal momento in cui il flag è a falso nessuna
    delle cinque funzioni parte più (regola 30), mentre l'ordine inverso
    lascerebbe una finestra in cui gli indici sono spariti ma una ricerca
    può ancora arrivare e restituire zero risultati fingendo che non ci
    sia nulla da trovare. La cancellazione passa dall'identità
    dell'Utente, come vuole ADR 0001 per una richiesta che nasce da una
    sua azione, e la policy `indice_semantico_delete_owner` esiste
    esattamente per questo.

    Riattivazione: gli indici si ricostruiscono in blocco (PRD), il che
    non sta nel tempo di una richiesta — un lavoro in secondo piano, con
    `indici_stato = 'in_ricostruzione'` a dire alla ricerca di dichiararsi
    incompleta finché non è finito.

    Nessun cambio: no-op idempotente. Un doppio clic sull'interruttore non
    deve cancellare due volte né accodare due ricostruzioni.

    Ciò che questa funzione **non** fa, ed è la regola 32: non tocca un
    solo contenuto della libreria. Le preview e le sintesi già generate
    restano dove sono, leggibili dal proprietario; semplicemente non se ne
    producono di nuove.
    """
    client = get_user_client(access_token)
    riga = await run_in_threadpool(utente_repository.get_utente_privato, client, utente_id)
    if riga is None:
        return None

    attuale = bool(riga["consenso_elaborazione_assistita"])
    if attuale == consenso:
        return await get_me(access_token, utente_id)

    indici_stato = (
        consenso_service.INDICI_IN_RICOSTRUZIONE if consenso else consenso_service.INDICI_SPENTI
    )
    aggiornata = await run_in_threadpool(
        utente_repository.aggiorna_consenso, client, utente_id, consenso, indici_stato
    )
    if aggiornata is None:
        return None

    if consenso:
        await run_in_threadpool(_accoda_ricostruzione, utente_id)
    else:
        await run_in_threadpool(indice_semantico_repository.cancella_tutti, client)

    return await get_me(access_token, utente_id)


def _accoda_ricostruzione(utente_id: UUID) -> None:
    """La coda non concede alcun privilegio a `authenticated`, nemmeno
    SELECT (docs/adr/0016): l'accodamento passa dalla connessione diretta,
    come già fa la nascita di una scheda in `POST /libri`.
    `uq_lavoro_pendente` rende l'operazione idempotente su doppio clic."""
    with database.apri_connessione() as connessione:
        lavoro_repository.accoda(
            connessione, "ricostruzione_indici", str(utente_id), {"utente_id": str(utente_id)}
        )


async def elimina_account(access_token: str, utente_id: UUID, conferma_nome_utente: str) -> None:
    """Cancellazione self-service dell'account (issue #8, PRD regole 26-29).

    Due passi, in quest'ordine deliberato:

    1. Cancella `public.utente` con l'identità dell'utente (RLS
       `utente_delete_owner`, docs/adr/0001, come ogni altra scrittura che
       nasce da un'azione sua). La cascata dello schema
       (migrazione 20260818115830) travolge da sola libreria, letture,
       avanzamenti, voti, recensioni, insight, note, artefatti generati e
       indici semantici: nessuna di queste tabelle va toccata qui.
    2. Solo dopo, rimuove la riga `auth.users` con l'Auth Admin API e la
       chiave di servizio (`get_service_client`, docs/adr/0001 — nessun
       ruolo `authenticated` ha privilegi su quello schema). L'ordine
       inverso lascerebbe una finestra in cui l'utente non può più
       autenticarsi ma i suoi dati applicativi sono ancora leggibili da
       un collegato, l'esatto opposto della regola 26.

    Se il passo 2 fallisce, l'eccezione è loggata e **non rilanciata**: i
    dati applicativi sono già spariti al passo 1, che è ciò che le regole
    26/27 richiedono, e non c'è nulla da far tornare indietro (il passo 1
    non è annullabile). Resta un residuo in `auth.users` senza alcun
    retry automatico — gotcha documentato in AGENTS.md, pulizia manuale
    del Manutentore (ADR 0007), scelta di semplicità per una scala di
    poche persone.
    """
    client = get_user_client(access_token)
    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        raise ContoNonTrovatoError

    if conferma_nome_utente != utente["nome_utente"]:
        raise ConfermaNonCorrispondenteError

    await run_in_threadpool(utente_repository.delete_utente, client, utente_id)

    try:
        await run_in_threadpool(get_service_client().auth.admin.delete_user, str(utente_id))
    except Exception:
        logger.error(
            "Cancellazione di auth.users fallita dopo la cascata su public.utente "
            "(utente_id=%s): residuo da rimuovere a mano, vedi AGENTS.md.",
            utente_id,
            exc_info=True,
        )
