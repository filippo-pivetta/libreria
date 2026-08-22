"""Orchestrazione di `/voci/{id}/insight` e `/insight/{id}` (issue #5).

Il contrassegno spoiler (PRD regola 10) è un comportamento di presentazione,
non di accesso alla riga (commento SQL sopra `create table insight`,
`supabase/migrations/20260818115830_schema_montaigne.sql`): la RLS decide
SE la riga è visibile, `_senza_spoiler` qui sotto decide COME va resa in un
elenco o un'anteprima. Si applica incondizionatamente, anche al proprietario
che guarda i propri insight (design-frontend.md §11: "vale identico sugli
insight di un collegato: il taglio non è un permesso, è un avviso") — il
solo modo di ottenere il testo pieno di un insight-spoiler è
`rivela_testo`, dietro un gesto esplicito dell'utente.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from app.core.supabase import get_user_client
from app.repositories import insight_repository


def _senza_spoiler(riga: dict[str, Any]) -> dict[str, Any]:
    if riga.get("spoiler"):
        return {**riga, "testo": None}
    return riga


async def raggruppati_per_lettura(
    access_token: str, voce_id: UUID, id_letture: set[UUID]
) -> tuple[dict[UUID, list[dict[str, Any]]], list[dict[str, Any]]]:
    """Tutti gli insight della Voce, con il gating spoiler già applicato,
    raggruppati per Lettura (design-frontend.md §10). Un insight il cui
    `lettura_id` non compare tra `id_letture` (Lettura cancellata — PRD:
    "gli insight legati a una Lettura cancellata restano sulla Voce, senza
    più alcuna Lettura associata") finisce nel bucket "senza lettura",
    esattamente come uno scritto prima di aprirne una: non scompare mai."""
    client = get_user_client(access_token)
    righe = await run_in_threadpool(insight_repository.list_by_voce, client, voce_id)
    per_lettura: dict[UUID, list[dict[str, Any]]] = {}
    senza_lettura: list[dict[str, Any]] = []
    for riga in righe:
        gated = _senza_spoiler(riga)
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
        return await run_in_threadpool(
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


async def correggi(
    access_token: str,
    insight_id: UUID,
    testo: str | None,
    spoiler: bool | None,
    visibilita: str | None,
) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    return await run_in_threadpool(
        insight_repository.update, client, insight_id, testo, spoiler, visibilita
    )


async def cancella(access_token: str, insight_id: UUID) -> bool:
    client = get_user_client(access_token)
    return await run_in_threadpool(insight_repository.delete, client, insight_id)


async def rivela_testo(access_token: str, insight_id: UUID) -> str | None:
    """Il gesto esplicito di scoprire un insight-spoiler (`GET
    /insight/{id}/testo`): nessun gating qui, la RLS ha già deciso se la
    riga è visibile a chi chiama."""
    client = get_user_client(access_token)
    return await run_in_threadpool(insight_repository.get_testo, client, insight_id)
