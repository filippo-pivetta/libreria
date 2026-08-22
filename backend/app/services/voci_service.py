"""Orchestrazione di `/voci`: aggiunta alla libreria, scaffale/scheda,
cambio di stato, correzione delle pagine adottate.

Le eccezioni di dominio qui sotto traducono gli SQLSTATE personalizzati
sollevati dai trigger/RPC della migrazione
`supabase/migrations/20260820065144_ciclo_di_lettura.sql` (docs/adr/0015)
in un vocabolario che il router può mappare a `HTTPException` senza
conoscere Postgres.
"""

from datetime import date
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core import storage
from app.core.supabase import get_user_client
from app.repositories import recensione_repository, voce_repository
from app.services import insight_service


class LibroInesistenteError(Exception):
    """`libro_id` non esiste (violazione della FK, 23503)."""


class TransizioneNonAmmessaError(Exception):
    """La coppia (stato attuale, nuovo stato) non è nella matrice del PRD (MTG10)."""


class ChiusuraPrecedeUltimoAvanzamentoError(Exception):
    """La data di chiusura precede l'ultimo avanzamento della Lettura aperta
    (MTG07 — PRD, entità Lettura: "la data di fine non può precedere...
    l'ultimo avanzamento")."""


class VoceNonTrovataError(Exception):
    """Nessuna Voce con questo id, o non di proprietà di chi chiama
    (MTG13, sollevato dentro `cambia_stato_voce`)."""


class PagineSottoAvanzamentoEsistenteError(Exception):
    """Il nuovo totale di pagine adottate è inferiore a un avanzamento già
    registrato (MTG11 — PRD, caso limite "il totale è un tetto, non un
    moltiplicatore")."""


_ERRCODE_A_ECCEZIONE: dict[str, type[Exception]] = {
    "MTG07": ChiusuraPrecedeUltimoAvanzamentoError,
    "MTG10": TransizioneNonAmmessaError,
    "MTG13": VoceNonTrovataError,
}


async def aggiungi_libro(
    access_token: str, utente_id: UUID, libro_id: UUID
) -> tuple[dict[str, Any], bool]:
    """Non duplica (PRD, comportamento #3): se esiste già una Voce per
    (utente, libro) — regola 11 — la ritorna con `already_existed=True`,
    qualunque sia il suo stato. Decidere cosa proporre (rilettura o
    semplice rimando alla Voce esistente) spetta a chi chiama, in base
    allo stato ricevuto."""
    client = get_user_client(access_token)

    esistente = await run_in_threadpool(voce_repository.get_by_libro, client, libro_id, utente_id)
    if esistente is not None:
        return esistente, True

    try:
        creata = await run_in_threadpool(voce_repository.create, client, utente_id, libro_id)
    except APIError as error:
        if error.code == "23503":
            raise LibroInesistenteError from error
        raise
    return creata, False


def firma_copertine(voci: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sostituisce i percorsi interni delle copertine con URL firmati.

    Una chiamata sola per l'intero scaffale, non una per copertina:
    firmarne cento singolarmente sarebbe cento richieste all'API Storage
    dentro una sola richiesta di pagina (app/core/storage.py).

    I percorsi non escono mai da qui: sono chiavi interne di un bucket
    privato, e al client non servono a nulla — con la firma sono
    ridondanti, senza la firma sono inservibili.
    """
    percorsi = [
        p
        for voce in voci
        if (libro := voce.get("libro"))
        for chiave in ("copertina_miniatura_path", "copertina_grande_path")
        if (p := libro.get(chiave))
    ]
    firmati = storage.firma_in_blocco(percorsi) if percorsi else {}

    for voce in voci:
        libro = voce.get("libro")
        if libro is None:
            continue
        libro["copertina_miniatura_url"] = firmati.get(libro.pop("copertina_miniatura_path", None))
        libro["copertina_grande_url"] = firmati.get(libro.pop("copertina_grande_path", None))
        libro.setdefault("copertina_stato", "assente")
    return voci


async def elenco_libreria(access_token: str, utente_id: UUID) -> list[dict[str, Any]]:
    client = get_user_client(access_token)
    voci = await run_in_threadpool(voce_repository.list_con_libro, client, utente_id)
    return await run_in_threadpool(firma_copertine, voci)


async def dettaglio(access_token: str, voce_id: UUID) -> dict[str, Any] | None:
    """Oltre a Libro e storico delle Letture, compone recensione e insight
    (issue #5) con due query mirate invece di un embed PostgREST a più
    livelli — scomodo da esprimere (il bucket "senza lettura" richiederebbe
    un filtro `lettura_id is null` dentro l'embed) e da far convivere con
    il gating spoiler, che deve girare su una lista piatta prima di essere
    ridistribuita per Lettura (stesso schema "due query, non N+1" di
    `utenti_service.elenco_membri`)."""
    client = get_user_client(access_token)
    voce = await run_in_threadpool(voce_repository.get_dettaglio, client, voce_id)
    if voce is None:
        return None
    voce["recensione"] = await run_in_threadpool(recensione_repository.get_by_voce, client, voce_id)
    id_letture = {UUID(lettura["id"]) for lettura in voce["letture"]}
    per_lettura, senza_lettura = await insight_service.raggruppati_per_lettura(
        access_token, voce_id, id_letture
    )
    for lettura in voce["letture"]:
        lettura["insight"] = per_lettura.get(UUID(lettura["id"]), [])
    voce["insight_senza_lettura"] = senza_lettura
    return (await run_in_threadpool(firma_copertine, [voce]))[0]


async def cambia_stato(
    access_token: str, voce_id: UUID, nuovo_stato: str, data: date | None
) -> dict[str, Any]:
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(
            voce_repository.cambia_stato, client, voce_id, nuovo_stato, data
        )
    except APIError as error:
        eccezione = _ERRCODE_A_ECCEZIONE.get(error.code or "")
        if eccezione is not None:
            raise eccezione from error
        raise


async def correggi_pagine(
    access_token: str, voce_id: UUID, pagine_adottate: int | None
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(
            voce_repository.update_pagine_adottate, client, voce_id, pagine_adottate
        )
    except APIError as error:
        if error.code == "MTG11":
            raise PagineSottoAvanzamentoEsistenteError from error
        raise


async def correggi_voto(
    access_token: str, voce_id: UUID, voto: float | None
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    return await run_in_threadpool(voce_repository.update_voto, client, voce_id, voto)


async def correggi_nota_intenzione(
    access_token: str, utente_id: UUID, voce_id: UUID, nota_intenzione: str | None
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    try:
        return await run_in_threadpool(
            voce_repository.update_nota_intenzione, client, voce_id, utente_id, nota_intenzione
        )
    except APIError as error:
        if error.code == "23503":
            return None
        raise
