"""Route dei suggerimenti di lettura (issue #27, con nota libera facoltativa
dal 22 agosto 2026).

`POST` anche se non scrive nulla: come la preview e la sintesi tematica,
ogni chiamata costa una chiamata al fornitore e non va dietro un metodo
che i browser e i proxy si sentono liberi di ripetere. Il corpo della
richiesta porta solo `nota`, facoltativa: lo storico e i testi propri si
leggono comunque lato server con l'identità di chi chiama, mai dal corpo.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.rate_limit import LIMITE_FUNZIONI_ASSISTITE, limiter
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.suggerimenti import SuggerimentiRequest, SuggerimentiResponse
from app.services import consenso as consenso_service
from app.services import suggerimenti_service

router = APIRouter(tags=["suggerimenti"])

_CONSENSO_REVOCATO = {
    "error_code": "consenso_revocato",
    "message": ("L'elaborazione assistita è disattivata. Puoi riattivarla dal tuo profilo."),
}

_CONTENUTO_INSUFFICIENTE = {
    "error_code": "contenuto_insufficiente",
    "message": "Aggiungi qualche libro letto o scrivi un insight prima di chiedere suggerimenti.",
}


@router.post("/suggerimenti", response_model=SuggerimentiResponse)
@limiter.limit(LIMITE_FUNZIONI_ASSISTITE)
async def post_suggerimenti(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    body: SuggerimentiRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        suggerimenti = await suggerimenti_service.genera(
            current_user.access_token, current_user.id, nota=body.nota
        )
        return {"suggerimenti": suggerimenti}
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(status.HTTP_409_CONFLICT, _CONSENSO_REVOCATO) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Il tuo account non è ancora stato completato."
        ) from errore
    except suggerimenti_service.ContenutoInsufficienteError as errore:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, _CONTENUTO_INSUFFICIENTE
        ) from errore
    except FonteNonRaggiungibileError as errore:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "modello_non_disponibile",
                "message": "I suggerimenti non sono arrivati. Riprova fra poco.",
            },
        ) from errore
