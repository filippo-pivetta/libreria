"""Route della preview personalizzata "me lo consigli?" (issue #6):
generarla, rileggere l'ultima, cancellarla.

`POST` e non `GET` per generarla: crea una riga in `artefatto_generato` e
costa una chiamata al fornitore, quindi non è idempotente e non va dietro
un metodo che i browser e i proxy si sentono liberi di ripetere.

Nessuna rotta di modifica: un artefatto generato esiste o sparisce, non si
riscrive (migrazione 20260822090000, che toglie anche il privilegio di
UPDATE dal database).
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.rate_limit import LIMITE_FUNZIONI_ASSISTITE, limiter
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.preview import PreviewResponse
from app.services import consenso as consenso_service
from app.services import preview_service

router = APIRouter(tags=["preview"])

_CONSENSO_REVOCATO = {
    "error_code": "consenso_revocato",
    "message": ("L’elaborazione assistita è spenta. Puoi riaccenderla dal tuo profilo."),
}
"""409 e non 403: non è un permesso mancante, è una funzione che l'Utente
ha scelto di spegnere, e l'interfaccia deve poterlo dire invece di far
finta che la funzione non esista (PRD, caso limite)."""


@router.post(
    "/voci/{voce_id}/preview",
    response_model=PreviewResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(LIMITE_FUNZIONI_ASSISTITE)
async def post_preview(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    voce_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await preview_service.genera(current_user.access_token, current_user.id, voce_id)
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(status.HTTP_409_CONFLICT, _CONSENSO_REVOCATO) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Il tuo account non è ancora stato completato."
        ) from errore
    except preview_service.VoceNonTrovataError as errore:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voce non trovata.") from errore
    except (FonteNonRaggiungibileError, preview_service.PreviewNonConformeError) as errore:
        # 503 e non 500: non è andato storto nulla nel nostro sistema, e
        # una preview mancata non blocca niente — il PRD lo dice per le
        # funzioni assistite in generale ("la funzione assistita fallisce
        # senza bloccare il flusso").
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "modello_non_disponibile",
                "message": "Il parere non è arrivato. Riprova fra poco.",
            },
        ) from errore


@router.get("/voci/{voce_id}/preview", response_model=PreviewResponse)
async def get_preview(
    voce_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    """Nessun controllo di consenso in lettura: una preview già generata è
    un contenuto dell'Utente e resta leggibile a interruttore spento
    (regola 32)."""
    artefatto = await preview_service.ultima(current_user.access_token, voce_id)
    if artefatto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nessuna preview per questa voce.")
    return artefatto


@router.delete("/artefatti/{artefatto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artefatto(
    artefatto_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> None:
    cancellato = await preview_service.cancella(current_user.access_token, artefatto_id)
    if not cancellato:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artefatto non trovato.")
