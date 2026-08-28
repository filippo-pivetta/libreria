"""Route di `/voci`: la libreria personale, il ciclo di stato di una Voce
(issue #2) e la sua cancellazione intera (issue #33). Nessuna ricerca sui
cataloghi qui: `POST /voci` accetta solo un `libro_id` già presente in
`public.libro` — la ricerca esterna che lo popola è l'issue #4, separata.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.lingua import lingua_interfaccia
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.voci import (
    AggiungiVoceRequest,
    AggiungiVoceResponse,
    CambiaStatoRequest,
    CorreggiNotaIntenzioneRequest,
    CorreggiPagineRequest,
    CorreggiVotoRequest,
    VoceConLibroResponse,
    VoceDettaglioResponse,
    VoceResponse,
)
from app.services import voci_service

router = APIRouter(tags=["voci"])


@router.get("/voci", response_model=list[VoceConLibroResponse])
async def get_voci(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> list[dict[str, Any]]:
    return await voci_service.elenco_libreria(current_user.access_token, current_user.id, lingua)


@router.post("/voci", response_model=AggiungiVoceResponse)
async def post_voci(
    body: AggiungiVoceRequest,
    response: Response,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> AggiungiVoceResponse:
    try:
        voce, already_existed = await voci_service.aggiungi_libro(
            current_user.access_token, current_user.id, body.libro_id
        )
    except voci_service.LibroInesistenteError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"error_code": "libro_inesistente", "message": "Il libro indicato non esiste."},
        ) from error

    # 200 su una Voce già esistente (nessuna scrittura avvenuta), 201
    # solo quando ne è nata una nuova (PRD, comportamento #3: "non lo
    # duplica").
    response.status_code = status.HTTP_200_OK if already_existed else status.HTTP_201_CREATED
    return AggiungiVoceResponse(voce=VoceResponse(**voce), already_existed=already_existed)


@router.get("/voci/{voce_id}", response_model=VoceDettaglioResponse)
async def get_voce(
    voce_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    voce = await voci_service.dettaglio(current_user.access_token, voce_id, current_user.id, lingua)
    if voce is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return voce


@router.patch("/voci/{voce_id}/stato", response_model=VoceResponse)
async def patch_voce_stato(
    voce_id: UUID,
    body: CambiaStatoRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await voci_service.cambia_stato(
            current_user.access_token,
            voce_id,
            body.stato,
            body.data,
            body.precisione,
            body.anno_fine,
        )
    except voci_service.VoceNonTrovataError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.") from error
    except voci_service.TransizioneNonAmmessaError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "transizione_stato_non_ammessa",
                "message": f'La transizione a "{body.stato}" non è ammessa da questo stato.',
            },
        ) from error
    except voci_service.ChiusuraPrecedeUltimoAvanzamentoError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "lettura_chiusura_precede_ultimo_avanzamento",
                "message": "La data di fine non può precedere l’ultimo avanzamento registrato.",
            },
        ) from error
    except voci_service.AnnoFineNonValidoError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "anno_fine_non_valido",
                "message": "L’anno in cui hai finito il libro non può essere nel futuro.",
            },
        ) from error


@router.patch("/voci/{voce_id}/pagine-adottate", response_model=VoceResponse)
async def patch_voce_pagine_adottate(
    voce_id: UUID,
    body: CorreggiPagineRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        voce = await voci_service.correggi_pagine(
            current_user.access_token, voce_id, body.pagine_adottate
        )
    except voci_service.PagineSottoAvanzamentoEsistenteError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "pagine_adottate_sotto_avanzamento_esistente",
                "message": "Il nuovo totale è inferiore a un avanzamento già registrato.",
            },
        ) from error
    if voce is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return voce


@router.patch("/voci/{voce_id}/voto", response_model=VoceResponse)
async def patch_voce_voto(
    voce_id: UUID,
    body: CorreggiVotoRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    voce = await voci_service.correggi_voto(current_user.access_token, voce_id, body.voto)
    if voce is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return voce


@router.delete("/voci/{voce_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voce(
    voce_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    """Cancella l'intera Voce e tutto ciò che le appartiene — letture,
    avanzamenti, voto, recensione, insight, nota di intenzione, preview
    personalizzata, indici semantici derivati (issue #33, PRD: "cancellare
    ... la Voce intera") — via la cascata dello schema, non riga per riga.
    Non tocca il Libro né le Voci di altri Utenti sullo stesso Libro."""
    cancellata = await voci_service.cancella(current_user.access_token, voce_id)
    if not cancellata:
        # Non trovata o non di proprietà: stessa risposta, RLS le rende
        # indistinguibili (PRD, casi limite) — come DELETE /letture/{id}.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")


@router.patch("/voci/{voce_id}/nota-intenzione", response_model=VoceResponse)
async def patch_voce_nota_intenzione(
    voce_id: UUID,
    body: CorreggiNotaIntenzioneRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    voce = await voci_service.correggi_nota_intenzione(
        current_user.access_token, current_user.id, voce_id, body.nota_intenzione
    )
    if voce is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.")
    return voce
