"""Contratti di `/utenti`: l'elenco membri e la libreria di un
collegato (issue #3).
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.voci import VoceConLibroResponse

StatoRelazione = Literal["assente", "in_attesa", "attiva"]


class UtenteEssenziale(BaseModel):
    id: UUID
    nome_utente: str


class MembroResponse(UtenteEssenziale):
    """Una riga dell'elenco membri (design-frontend.md §16): nome e stato
    della relazione con chi guarda, nient'altro — non un'anteprima di
    libreria o metriche, che l'elenco non deve mai mostrare."""

    stato_relazione: StatoRelazione
    # Significativo solo quando stato_relazione == "in_attesa": True se
    # la richiesta l'ha inviata l'altro (quindi accettabile/rifiutabile
    # da chi guarda), False se l'ha inviata chi guarda (solo ritirabile
    # dalla Torre). Sempre False per "assente"/"attiva".
    richiesta_ricevuta: bool


class LibreriaCollegatoResponse(BaseModel):
    """GET /utenti/{id}/voci: la libreria di un collegato, con il suo
    profilo incorporato — la pagina che la mostra deve poter scrivere il
    nome utente in cima anche a un refresh diretto, senza dipendere
    dall'elenco membri già in cache lato frontend (design-frontend.md
    §15)."""

    utente: UtenteEssenziale
    voci: list[VoceConLibroResponse]
