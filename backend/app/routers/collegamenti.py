"""Route di `/collegamenti`: richiesta, accettazione, interruzione
(issue #3). L'elenco membri e la libreria di un collegato vivono in
`app/routers/utenti.py`."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.collegamenti import (
    CollegamentoResponse,
    InviaRichiestaRequest,
    InviaRichiestaResponse,
)
from app.services import collegamenti_service

router = APIRouter(tags=["collegamenti"])


@router.get("/collegamenti", response_model=list[CollegamentoResponse])
async def get_collegamenti(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> list[dict[str, Any]]:
    return await collegamenti_service.elenco(current_user.access_token, current_user.id)


@router.post("/collegamenti", response_model=InviaRichiestaResponse)
async def post_collegamenti(
    body: InviaRichiestaRequest,
    response: Response,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> InviaRichiestaResponse:
    try:
        collegamento, already_existed = await collegamenti_service.invia_richiesta(
            current_user.access_token, current_user.id, body.utente_id
        )
    except collegamenti_service.RichiestaASeStessiError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {
                "error_code": "richiesta_a_se_stessi",
                "message": "Non puoi inviare una richiesta di collegamento a te stesso.",
            },
        ) from error
    except collegamenti_service.UtenteInesistenteError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"error_code": "utente_inesistente", "message": "Questo utente non esiste."},
        ) from error

    # 200 su una richiesta già esistente (nessuna scrittura avvenuta), 201
    # solo quando ne è nata una nuova — stesso pattern di POST /voci.
    response.status_code = status.HTTP_200_OK if already_existed else status.HTTP_201_CREATED
    return InviaRichiestaResponse(
        collegamento=CollegamentoResponse(**collegamento), already_existed=already_existed
    )


@router.patch("/collegamenti/{collegamento_id}", response_model=CollegamentoResponse)
async def patch_collegamento(
    collegamento_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await collegamenti_service.accetta(
            current_user.access_token, current_user.id, collegamento_id
        )
    except collegamenti_service.CollegamentoNonTrovatoError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collegamento non trovato.") from error


@router.delete("/collegamenti/{collegamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collegamento(
    collegamento_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    terminato = await collegamenti_service.termina(current_user.access_token, collegamento_id)
    if not terminato:
        # Copre rifiuto/ritiro/interruzione: non trovato o non tuo sono
        # indistinguibili (PRD, "un rifiuto non lascia traccia").
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collegamento non trovato.")
