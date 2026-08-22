"""Route della sintesi tematica (issue #27): generarla, rileggere
l'ultima. Nessuna rotta di cancellazione propria: `DELETE
/artefatti/{artefatto_id}` (`app/routers/preview.py`) è già generica su
qualunque riga di `artefatto_generato` di proprietà del chiamante e
copre anche questa.

`POST` e non `GET` per generarla, stessa ragione della preview: crea (o
sostituisce) una riga in `artefatto_generato` e costa una chiamata al
fornitore, quindi non è idempotente.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.rate_limit import LIMITE_FUNZIONI_ASSISTITE, limiter
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.sintesi import SintesiTematicaResponse
from app.services import consenso as consenso_service
from app.services import sintesi_service

router = APIRouter(tags=["sintesi"])

_CONSENSO_REVOCATO = {
    "error_code": "consenso_revocato",
    "message": (
        "L'elaborazione assistita è disattivata. Puoi riattivarla dalle impostazioni nella Torre."
    ),
}

_CONTENUTO_INSUFFICIENTE = {
    "error_code": "contenuto_insufficiente",
    "message": "Scrivi qualche insight o recensione prima di chiedere una sintesi.",
}

_NESSUN_TEMA_RILEVANTE = {
    "error_code": "nessun_tema_rilevante",
    "message": (
        "Non emerge ancora un tema che attraversi libri diversi. Continua a scrivere e a "
        "leggere, poi riprova."
    ),
}


@router.post(
    "/sintesi-tematica",
    response_model=SintesiTematicaResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(LIMITE_FUNZIONI_ASSISTITE)
async def post_sintesi_tematica(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await sintesi_service.genera(current_user.access_token, current_user.id)
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(status.HTTP_409_CONFLICT, _CONSENSO_REVOCATO) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Il tuo account non è ancora stato completato."
        ) from errore
    except sintesi_service.ContenutoInsufficienteError as errore:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, _CONTENUTO_INSUFFICIENTE
        ) from errore
    except sintesi_service.NessunTemaRilevanteError as errore:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, _NESSUN_TEMA_RILEVANTE
        ) from errore
    except FonteNonRaggiungibileError as errore:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "modello_non_disponibile",
                "message": "La sintesi non è arrivata. Riprova fra poco.",
            },
        ) from errore


@router.get("/sintesi-tematica", response_model=SintesiTematicaResponse)
async def get_sintesi_tematica(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    """Nessun controllo di consenso in lettura: una sintesi già generata è
    un contenuto dell'Utente e resta leggibile a interruttore spento
    (regola 32)."""
    artefatto = await sintesi_service.ultima(current_user.access_token, current_user.id)
    if artefatto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nessuna sintesi tematica ancora generata.")
    return artefatto
