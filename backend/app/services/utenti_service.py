"""Orchestrazione di `/utenti`: elenco membri e libreria di un
collegato (issue #3).
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import collegamento_repository, utente_repository, voce_repository
from app.services import metriche_service, voci_service


class UtenteInesistenteError(Exception):
    """Nessun utente con questo id."""


class NonCollegatoError(Exception):
    """Il chiamante non ha un collegamento attivo con `utente_id`: la
    sua libreria non è raggiungibile (PRD regola 4/7)."""


def _stato_relazione(collegamento: dict[str, Any] | None) -> tuple[str, bool]:
    if collegamento is None:
        return "assente", False
    if collegamento["stato"] == "attiva":
        return "attiva", False
    return "in_attesa", not collegamento["richiesto_da_me"]


async def elenco_membri(access_token: str, self_id: UUID) -> list[dict[str, Any]]:
    """Due query totali, non N+1: una per l'elenco membri, una per tutti
    i collegamenti di chi guarda, poi un join in memoria."""
    client = get_user_client(access_token)
    membri = await run_in_threadpool(utente_repository.list_altri, client, self_id)
    collegamenti = await run_in_threadpool(collegamento_repository.list_per_utente, client, self_id)
    per_altro_id = {riga["altro"]["id"]: riga for riga in collegamenti}

    risultato = []
    for membro in membri:
        stato_relazione, richiesta_ricevuta = _stato_relazione(per_altro_id.get(membro["id"]))
        risultato.append(
            {
                **membro,
                "stato_relazione": stato_relazione,
                "richiesta_ricevuta": richiesta_ricevuta,
            }
        )
    return risultato


async def libreria_di(
    access_token: str, self_id: UUID, utente_id: UUID, lingua: str
) -> dict[str, Any]:
    """Distingue esplicitamente "non collegato" (403) da "libreria
    vuota" (200, lista vuota) — design-frontend.md §15: "quella libreria
    non è più accessibile" non è un errore generico."""
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        raise UtenteInesistenteError

    collegato = await run_in_threadpool(
        collegamento_repository.is_collegato_attivo, client, utente_id
    )
    if not collegato:
        raise NonCollegatoError

    voci = await run_in_threadpool(voce_repository.list_con_libro, client, utente_id, lingua)
    voci = await run_in_threadpool(voci_service.firma_copertine, voci)
    return {"utente": utente, "voci": voci}


async def metriche_di(
    access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
) -> dict[str, Any]:
    """GET /utenti/{id}/metriche (issue #7): le metriche del collegato,
    non le proprie — stesso controllo di accesso di `libreria_di`
    (esistenza + collegamento attivo), poi il calcolo delega a
    `metriche_service.metriche_di` con l'`utente_id` del collegato, mai
    con `self_id`: è ciò che rende vera la regola 17 del PRD ("le
    metriche di un Utente sono calcolate solo sui suoi dati") anche
    quando a chiederle è un collegato in visione reciproca."""
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        raise UtenteInesistenteError

    collegato = await run_in_threadpool(
        collegamento_repository.is_collegato_attivo, client, utente_id
    )
    if not collegato:
        raise NonCollegatoError

    return await metriche_service.metriche_di(access_token, utente_id, anno, lingua)
