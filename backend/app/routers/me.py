from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.lingua import lingua_interfaccia
from app.core.security import get_current_user
from app.core.tempo import oggi_europa_centrale
from app.schemas.auth import AuthenticatedUser
from app.schemas.me import (
    CompleteAccountRequest,
    ConsensoUpdateRequest,
    EliminaAccountRequest,
    MeResponse,
)
from app.services import export_service, me_service

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


@router.get("/me/export/libri-letti")
async def esporta_libri_letti(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> Response:
    """CSV dei libri con stato "letto" dell'utente (issue #8, ADR 0011
    rivisto, PRD comportamento 14bis). Nessuna conferma: non è un'azione
    distruttiva."""
    contenuto = await export_service.libri_letti_csv(
        current_user.access_token, current_user.id, lingua
    )
    nome_file = f"libri-letti-{oggi_europa_centrale().isoformat()}.csv"
    return Response(
        content=contenuto,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nome_file}"'},
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def elimina_account(
    body: EliminaAccountRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    """Cancellazione self-service dell'account (issue #8, PRD regole
    26-29): la conferma è digitare il proprio nome utente, verificata
    server-side in `me_service.elimina_account` (mai fidarsi solo del
    pulsante disabilitato lato client, AGENTS.md)."""
    try:
        await me_service.elimina_account(
            current_user.access_token, current_user.id, body.conferma_nome_utente
        )
    except me_service.ContoNonTrovatoError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Il tuo account non è ancora stato completato.",
        ) from error
    except me_service.ConfermaNonCorrispondenteError as error:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            {
                "error_code": "conferma_non_corrispondente",
                "message": "Il nome utente digitato non corrisponde.",
            },
        ) from error
