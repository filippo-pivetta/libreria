"""Route della scheda pubblica: il libro guardato prima di aggiungerlo, e
il parere che ci si può chiedere sopra (docs/design-frontend.md §13).

Una rotta sola per due origini — `/schede/catalogo/{libro_id}` e
`/schede/google/{volume_id}` — e non due rotte diverse: il PRD vuole i
risultati "presentati insieme, senza distinzione", e due contratti
separati avrebbero costretto il frontend a costruire due pagine per la
stessa carta.

`POST` e non `GET` per il parere, come per la preview della scheda del
libro: costa una chiamata al fornitore, quindi non va dietro un metodo
che browser e proxy si sentono liberi di ripetere. Ma a differenza di
quella non crea nulla — 200, non 201: non c'è nessuna risorsa nuova a cui
puntare (vedi `scheda_pubblica_service.parere`).
"""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.lingua import lingua_interfaccia
from app.core.rate_limit import (
    LIMITE_CATALOGHI_ESTERNI,
    LIMITE_FUNZIONI_ASSISTITE,
    limiter,
)
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.schede import ParereEffimero, SchedaPubblica
from app.services import consenso as consenso_service
from app.services import preview_service, scheda_pubblica_service

router = APIRouter(tags=["schede"])

_CONSENSO_REVOCATO = {
    "error_code": "consenso_revocato",
    "message": (
        "L'elaborazione assistita è disattivata. Puoi riattivarla dalle impostazioni nella Torre."
    ),
}

_NON_TROVATA = "Questo libro non è nei cataloghi. Rifai la ricerca."

_FONTE_IRRAGGIUNGIBILE = {
    "error_code": "fonte_irraggiungibile",
    "message": "I cataloghi esterni non rispondono.",
}
"""Distinto da "non esiste", come nella ricerca: senza la distinzione chi
guarda conclude che il libro non ci sia mentre è solo il catalogo che non
risponde (§13)."""


@router.get("/schede/{fonte}/{identificativo}", response_model=SchedaPubblica)
@limiter.limit(LIMITE_CATALOGHI_ESTERNI)
async def get_scheda(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    fonte: Literal["catalogo", "google"],
    identificativo: str,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    """La scheda di un libro che non si ha in libreria.

    Il limite dei cataloghi esterni e non quello globale: il ramo `google`
    consuma la stessa quota a pagamento della ricerca. Vale anche sul ramo
    `catalogo`, che non ne consuma affatto — trenta aperture di scheda al
    minuto stanno larghe per chiunque legga, e un limite solo è più facile
    da verificare di due che si distinguono per un segmento di percorso.
    """
    try:
        return await scheda_pubblica_service.dettaglio(
            current_user.access_token, current_user.id, fonte, identificativo, lingua
        )
    except scheda_pubblica_service.SchedaNonTrovataError as errore:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NON_TROVATA) from errore
    except FonteNonRaggiungibileError as errore:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _FONTE_IRRAGGIUNGIBILE) from errore


@router.post("/schede/{fonte}/{identificativo}/parere", response_model=ParereEffimero)
@limiter.limit(LIMITE_FUNZIONI_ASSISTITE)
async def post_parere(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    fonte: Literal["catalogo", "google"],
    identificativo: str,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> dict[str, Any]:
    """ "Me lo consigli?" su un libro non ancora in libreria. Non si salva.

    Nessuna rotta `GET` corrispondente, e non è una dimenticanza: non
    essendo conservato non c'è niente da rileggere. Chi ricarica la pagina
    lo chiede di nuovo, e lo sa perché è la stessa cosa che ha fatto la
    prima volta.
    """
    try:
        testo = await scheda_pubblica_service.parere(
            current_user.access_token, current_user.id, fonte, identificativo, lingua
        )
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(status.HTTP_409_CONFLICT, _CONSENSO_REVOCATO) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Il tuo account non è ancora stato completato."
        ) from errore
    except scheda_pubblica_service.SchedaNonTrovataError as errore:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NON_TROVATA) from errore
    except (FonteNonRaggiungibileError, preview_service.PreviewNonConformeError) as errore:
        # 503 e non 500, come per la preview della scheda: non è andato
        # storto nulla nel nostro sistema, e un parere mancato non blocca
        # niente — il libro si aggiunge lo stesso.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "modello_non_disponibile",
                "message": "Il parere non è arrivato. Riprova fra poco.",
            },
        ) from errore
    return {"testo": testo}
