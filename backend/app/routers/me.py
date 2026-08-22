from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.me import CompleteAccountRequest, ConsensoUpdateRequest, MeResponse
from app.services import me_service

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> MeResponse:
    result = await me_service.get_me(current_user.access_token, current_user.id)
    if result is None:
        # 404 e non 403: l'autenticazione è già validata a monte
        # (get_current_user), manca solo la risorsa applicativa, in
        # attesa che l'Utente completi l'invito (docs/adr/0013).
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Il tuo account non è ancora stato completato.",
        )
    return MeResponse(**result)


@router.post("/me", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
async def complete_account(
    body: CompleteAccountRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> MeResponse:
    """Completa l'account dopo l'invito: sceglie `nome_utente` e registra
    l'accettazione dell'informativa nello stesso passaggio (PRD, docs/adr/0013).
    Nessun campo id/utente_id nel corpo: lo assegna il server dal token
    (AGENTS.md)."""
    try:
        result = await me_service.complete_account(current_user.access_token, body.nome_utente)
    except me_service.NomeUtenteInUsoError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"error_code": "nome_utente_in_uso", "message": "Questo nome utente è già in uso."},
        ) from error
    except me_service.AccountGiaCompletatoError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "account_gia_completato",
                "message": "Il tuo account è già stato completato.",
            },
        ) from error
    return MeResponse(**result)


@router.patch("/me/consenso", response_model=MeResponse)
async def patch_consenso(
    body: ConsensoUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> MeResponse:
    """Accende o spegne l'elaborazione assistita.

    Non `PUT /me`: `nome_utente` non è modificabile e `informativa_accettata_at`
    non deve esserlo, quindi una rotta che accettasse il profilo intero
    inviterebbe a scrivere campi che il database ora rifiuta comunque
    (grant per colonna, migrazione 20260822090000).
    """
    result = await me_service.aggiorna_consenso(
        current_user.access_token, current_user.id, body.consenso
    )
    if result is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Il tuo account non è ancora stato completato.",
        )
    return MeResponse(**result)
