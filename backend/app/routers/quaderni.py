"""Route di `/scritti`: il corpus dei Quaderni e le sue lenti
(design-frontend.md §22).

**Nessun limite di frequenza proprio**, a differenza di ogni altra rotta
delle funzioni assistite personali: qui non parte alcuna chiamata al
fornitore. Sfogliare, filtrare, ripescare un vecchio pensiero e contare
i vicini sono tutte operazioni che vivono e muoiono dentro Postgres. La
rete di sicurezza globale per IP (`app/core/rate_limit.py`, 120/minuto)
resta e basta: mettere qui `LIMITE_FUNZIONI_ASSISTITE` direbbe che
questa pagina costa, e non costa.

`GET /scritti` e `GET /scritti/che-torna` **non rispondono mai 409**.
Sono l'unica parte dei Quaderni che il consenso non governa: i propri
scritti esistono comunque, ed è solo il modo di interrogarli che si
spegne (§5). Lo stato del consenso arriva nella risposta
(`indici_spenti`), perché la pagina lo dichiari invece di sparire.
`GET /scritti/{id}/vicini` invece 409 come le altre: senza indici non
c'è niente da confrontare.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.quaderni import (
    ElencoScrittiResponse,
    PensieroCheTornaResponse,
    SfaccettatureResponse,
    ViciniResponse,
)
from app.services import consenso as consenso_service
from app.services import quaderni_service

router = APIRouter(tags=["quaderni"])

_CONSENSO_REVOCATO = {
    "error_code": "consenso_revocato",
    "message": "L’elaborazione assistita è spenta. Puoi riaccenderla dal tuo profilo.",
}
_PROFILO_ASSENTE = "Il tuo account non è ancora stato completato."


@router.get("/scritti", response_model=ElencoScrittiResponse)
async def get_scritti(
    tipo: str | None = Query(default=None, pattern="^(insight|recensione)$"),
    solo_spoiler: bool = Query(default=False),
    anno: int | None = Query(default=None, ge=1900, le=2200),
    # Elenchi e non valori singoli: `voce_id` regge il menù "ogni libro",
    # che ne passa uno, ma anche la lente di un tema quando deve ricadere
    # sui suoi libri; `contenuto_id` è la lente di un tema vera e propria,
    # cioè l'elenco degli scritti che il modello ha messo insieme. Un tema
    # non è un attributo dello scritto, è un insieme di scritti.
    #
    # noqa come su ogni `Depends` dei router: B008 salta la chiamata nel
    # default solo per le annotazioni che ruff sa immutabili (int, str,
    # bool), e una lista di UUID non è fra quelle.
    voce_id: list[UUID] | None = Query(default=None),  # noqa: B008
    contenuto_id: list[UUID] | None = Query(default=None),  # noqa: B008
    limite: int = Query(default=quaderni_service.LIMITE_PAGINA, ge=1, le=100),
    scarto: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await quaderni_service.elenco(
            current_user.access_token,
            current_user.id,
            tipo=tipo,
            solo_spoiler=solo_spoiler,
            anno=anno,
            voce_ids=voce_id,
            contenuto_ids=contenuto_id,
            limite=limite,
            scarto=scarto,
        )
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _PROFILO_ASSENTE) from errore


@router.get("/scritti/sfaccettature", response_model=SfaccettatureResponse)
async def get_sfaccettature(
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    return await quaderni_service.sfaccettature(current_user.access_token)


@router.get("/scritti/che-torna", response_model=PensieroCheTornaResponse)
async def get_pensiero_che_torna(
    scarto: int = Query(default=0, ge=0, le=1000),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    """Lo slot in cima alla pagina.

    `scarto` serve al comando "mostrane un altro": la scelta di base è
    deterministica sul giorno e resta ferma per ventiquattr'ore, e questo
    è il modo di scorrere senza aspettare domani. Un tetto c'è perché un
    valore enorme farebbe girare il modulo su un corpus piccolo per
    niente.
    """
    return await quaderni_service.pensiero_che_torna(
        current_user.access_token, current_user.id, scarto
    )


@router.get("/scritti/{contenuto_id}/vicini", response_model=ViciniResponse)
async def get_vicini(
    contenuto_id: UUID,
    limite: int = Query(default=quaderni_service.LIMITE_VICINI, ge=1, le=20),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await quaderni_service.vicini(
            current_user.access_token, current_user.id, contenuto_id, limite
        )
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(status.HTTP_409_CONFLICT, _CONSENSO_REVOCATO) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _PROFILO_ASSENTE) from errore
