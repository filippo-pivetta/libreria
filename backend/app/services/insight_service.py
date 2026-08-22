"""Orchestrazione di `/voci/{id}/insight` e `/insight/{id}` (issue #5).

Il contrassegno spoiler (PRD regola 10) è un comportamento di presentazione,
non di accesso alla riga (commento SQL sopra `create table insight`,
`supabase/migrations/20260818115830_schema_montaigne.sql`): la RLS decide
SE la riga è visibile, `_senza_spoiler` qui sotto decide COME va resa. La
regola 10 protegge da uno spoiler *altrui*, non da un proprio testo — per
questo il gating è condizionato a `is_owner` (issue #6, dopo un primo giro
d'uso: la prima stesura lo applicava incondizionatamente, prima di
accorgersi che nascondeva al proprietario ciò che aveva scritto lui
stesso, senza proteggere nessuno). Il proprietario che guarda la propria
scheda vede sempre il testo pieno; un collegato che guarda la stessa
Voce (visione reciproca) lo vede tagliato — il solo modo per lui di
ottenerlo è `rivela_testo`, dietro un gesto esplicito.

Stessa logica in `ricerca_semantica_service` (issue #6), ma lì senza
nemmeno bisogno del parametro: ogni riga è già garantita del richiedente
(mai di un collegato, per il filtro `utente_id = auth.uid()` nella RPC),
quindi il gating non si applica mai.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import insight_repository
from app.services import indicizzazione


def _senza_spoiler(riga: dict[str, Any]) -> dict[str, Any]:
    if riga.get("spoiler"):
        return {**riga, "testo": None}
    return riga


async def raggruppati_per_lettura(
    access_token: str, voce_id: UUID, id_letture: set[UUID], is_owner: bool
) -> tuple[dict[UUID, list[dict[str, Any]]], list[dict[str, Any]]]:
    """Tutti gli insight della Voce, con il gating spoiler già applicato
    quando serve, raggruppati per Lettura (design-frontend.md §10). Un
    insight il cui `lettura_id` non compare tra `id_letture` (Lettura
    cancellata — PRD: "gli insight legati a una Lettura cancellata
    restano sulla Voce, senza più alcuna Lettura associata") finisce nel
    bucket "senza lettura", esattamente come uno scritto prima di aprirne
    una: non scompare mai.

    `is_owner` distingue le due viste che questa funzione serve: il
    proprietario che guarda la propria scheda vede sempre il testo pieno,
    spoiler compreso — un collegato che guarda la stessa Voce (visione
    reciproca) lo vede tagliato, com'è sempre stato."""
    client = get_user_client(access_token)
    righe = await run_in_threadpool(insight_repository.list_by_voce, client, voce_id)
    per_lettura: dict[UUID, list[dict[str, Any]]] = {}
    senza_lettura: list[dict[str, Any]] = []
    for riga in righe:
        gated = riga if is_owner else _senza_spoiler(riga)
        lettura_id = riga.get("lettura_id")
        lid = UUID(lettura_id) if lettura_id else None
        if lid is not None and lid in id_letture:
            per_lettura.setdefault(lid, []).append(gated)
        else:
            senza_lettura.append(gated)
    return per_lettura, senza_lettura


async def crea(
    access_token: str, utente_id: UUID, voce_id: UUID, testo: str, spoiler: bool, visibilita: str
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    lettura_id = await run_in_threadpool(insight_repository.get_lettura_aperta_id, client, voce_id)
    try:
        creato = await run_in_threadpool(
            insight_repository.create,
            client,
            utente_id,
            voce_id,
            lettura_id,
            testo,
            spoiler,
            visibilita,
        )
    except APIError as error:
        if error.code == "23503":
            return None
        raise
    await indicizzazione.accoda(access_token, utente_id, "insight", UUID(str(creato["id"])))
    return creato


async def correggi(
    access_token: str,
    utente_id: UUID,
    insight_id: UUID,
    testo: str | None,
    spoiler: bool | None,
    visibilita: str | None,
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    aggiornato = await run_in_threadpool(
        insight_repository.update, client, insight_id, testo, spoiler, visibilita
    )
    if aggiornato is not None and testo is not None:
        # Solo se il TESTO è cambiato: un insight reso privato e poi di
        # nuovo condiviso non ha un significato diverso, e la regola 24
        # vuole comunque la visibilità verificata al momento della
        # lettura, non congelata dentro l'indice.
        await indicizzazione.accoda(access_token, utente_id, "insight", insight_id)
    return aggiornato


async def cancella(access_token: str, insight_id: UUID) -> bool:
    client = get_user_client(access_token)
    return await run_in_threadpool(insight_repository.delete, client, insight_id)


async def rivela_testo(access_token: str, insight_id: UUID) -> str | None:
    """Il gesto esplicito di scoprire un insight-spoiler (`GET
    /insight/{id}/testo`): nessun gating qui, la RLS ha già deciso se la
    riga è visibile a chi chiama."""
    client = get_user_client(access_token)
    return await run_in_threadpool(insight_repository.get_testo, client, insight_id)
