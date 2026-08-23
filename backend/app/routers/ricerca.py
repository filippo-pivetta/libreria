"""Route di `/ricerca` e `POST /libri`: trovare un libro e aggiungerlo.

Due endpoint di ricerca e non uno perché hanno costi diversi di un ordine
di grandezza, e il design (§13) vuole che le schede già nel sistema
compaiano "per prime perché non richiedono una chiamata esterna" — prime
nel tempo, non solo nell'ordine.

I tre stati che l'interfaccia deve distinguere nascono qui, e se il back
end non li distingue il frontend non può inventarli: 200 con lista vuota
quando la fonte ha risposto e non ha nulla, 503 con `error_code`
`fonte_irraggiungibile` quando non ha risposto.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.lingua import lingua_interfaccia
from app.core.rate_limit import (
    LIMITE_CATALOGHI_ESTERNI,
    LIMITE_FUNZIONI_ASSISTITE,
    limiter,
)
from app.core.security import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.schemas.ricerca import (
    AggiungiDaCatalogoRequest,
    AggiungiDaCatalogoResponse,
    RisultatoEsterno,
    RisultatoLocale,
)
from app.schemas.ricerca_semantica import RicercaSemanticaResponse
from app.services import consenso as consenso_service
from app.services import ricerca_semantica_service, ricerca_service

router = APIRouter(tags=["ricerca"])

_LUNGHEZZA_MINIMA = 2
"""Sotto questa lunghezza non si interroga nulla: "il" non deve costare
una chiamata a un catalogo esterno."""


@router.get("/ricerca/catalogo", response_model=list[RisultatoLocale])
async def get_ricerca_catalogo(
    q: str = Query(min_length=1, max_length=200),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    lingua: str = Depends(lingua_interfaccia),  # noqa: B008
) -> list[dict[str, Any]]:
    """Le schede già nel sistema. Nessuna rete, nessun limite di quota.

    `lingua` (issue #34/#40): prima un `Query` con default `"it"` mai
    valorizzato dal frontend — la ricerca nel catalogo locale restava in
    italiano anche a interfaccia in inglese, mentre ogni altro endpoint
    bibliografico era già allineato su `Accept-Language`. Stessa
    dipendenza degli altri, non un meccanismo a parte: chiamato solo
    lato client (`lib/api/ricerca.ts::cercaNelCatalogo`), il browser
    manda già da sé l'intestazione, nessuna modifica frontend necessaria.
    """
    termine = q.strip()
    if len(termine) < _LUNGHEZZA_MINIMA:
        return []
    return await ricerca_service.cerca_locale(current_user.access_token, termine, lingua)


@router.get("/ricerca/cataloghi", response_model=list[RisultatoEsterno])
@limiter.limit(LIMITE_CATALOGHI_ESTERNI)
async def get_ricerca_cataloghi(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    q: str = Query(min_length=1, max_length=200),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """I cataloghi esterni, una riga per opera e non per edizione.

    503 e non 500 quando la fonte non risponde: non è andato storto nulla
    nel nostro sistema, ed è uno stato che l'interfaccia deve poter
    dichiarare invece di far credere che il libro non esista.
    """
    termine = q.strip()
    if len(termine) < _LUNGHEZZA_MINIMA:
        return []
    try:
        return await ricerca_service.cerca_esterna(
            current_user.access_token, current_user.id, termine
        )
    except FonteNonRaggiungibileError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "fonte_irraggiungibile",
                "message": "I cataloghi esterni non rispondono.",
                "fonte": error.fonte,
            },
        ) from error


@router.post("/libri", response_model=AggiungiDaCatalogoResponse)
async def post_libri(
    body: AggiungiDaCatalogoRequest,
    response: Response,
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> AggiungiDaCatalogoResponse:
    """Fa nascere la scheda (se non esiste) e la Voce di chi chiama.

    Un risultato già presente nel catalogo locale non passa da qui: riusa
    il normale `POST /voci` con il suo `libro_id`, senza duplicare
    l'endpoint.
    """
    try:
        libro_id, voce, gia_esisteva = await ricerca_service.aggiungi_da_catalogo(
            current_user.access_token,
            current_user.id,
            body.volume_id,
            body.volumi_alternativi,
        )
    except ricerca_service.VolumeInesistenteError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "risultato_scaduto",
                "message": "Questo risultato non è più valido. Rifai la ricerca.",
            },
        ) from error
    except FonteNonRaggiungibileError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "fonte_irraggiungibile",
                "message": "I cataloghi esterni non rispondono.",
                "fonte": error.fonte,
            },
        ) from error

    response.status_code = status.HTTP_200_OK if gia_esisteva else status.HTTP_201_CREATED
    return AggiungiDaCatalogoResponse(
        libro_id=libro_id,
        voce_id=UUID(str(voce["id"])),
        gia_in_libreria=gia_esisteva,
    )


@router.get("/ricerca/semantica", response_model=RicercaSemanticaResponse)
@limiter.limit(LIMITE_FUNZIONI_ASSISTITE)
async def get_ricerca_semantica(
    request: Request,  # noqa: ARG001  # slowapi lo richiede in firma per il limite per-route
    q: str = Query(min_length=1, max_length=500),
    current_user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
) -> dict[str, Any]:
    """La ricerca dentro i propri insight e le proprie recensioni.

    Terzo endpoint di ricerca, e il più diverso dagli altri due: quelli
    cercano libri, questo cerca dentro testi propri, dipende dal consenso
    ed è l'unico che può rispondere "sono spenta". Il design doc vieta
    esplicitamente di fonderlo con il filtro dello scaffale (§7): a
    consenso revocato l'Utente resterebbe senza il modo di trovare un
    libro.

    409 e non lista vuota a consenso revocato — il PRD è esplicito:
    "l'interfaccia dichiara che la funzione è disattivata, invece di
    restituire zero risultati come se non ci fosse nulla da trovare".
    """
    domanda = q.strip()
    if len(domanda) < _LUNGHEZZA_MINIMA:
        return {"risultati": [], "indici_incompleti": False}
    try:
        return await ricerca_semantica_service.cerca(
            current_user.access_token, current_user.id, domanda
        )
    except consenso_service.ConsensoRevocatoError as errore:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error_code": "consenso_revocato",
                "message": (
                    "L'elaborazione assistita è disattivata. Puoi riattivarla dalle "
                    "impostazioni nella Torre."
                ),
            },
        ) from errore
    except consenso_service.ProfiloAssenteError as errore:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Il tuo account non è ancora stato completato."
        ) from errore
    except FonteNonRaggiungibileError as errore:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "error_code": "fonte_irraggiungibile",
                "message": "La ricerca semantica non è disponibile in questo momento.",
                "fonte": errore.fonte,
            },
        ) from errore
