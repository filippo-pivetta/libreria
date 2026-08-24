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
    # da chi guarda), False se l'ha inviata chi guarda (solo ritirabile).
    # Sempre False per "assente"/"attiva".
    richiesta_ricevuta: bool
    # L'id della riga `collegamento`, quando una relazione esiste. Senza,
    # l'elenco potrebbe mostrare accetta/rifiuta/ritira/interrompi ma non
    # eseguirli: le rotte di `/collegamenti` lavorano sull'id della
    # relazione, non su quello della persona. È ciò che permette a Lettori
    # di reggere l'intero ciclo di vita di un collegamento senza una
    # seconda chiamata.
    collegamento_id: UUID | None = None


class ElencoMembriResponse(BaseModel):
    """GET /utenti in tre gruppi, non una lista piatta.

    `richieste_ricevute` e `collegati` sono sempre completi: nascere da
    una relazione con chi guarda li rende suoi dati, e un tetto li
    renderebbe inagibili — una richiesta fuori dal LIMIT non si potrebbe
    accettare, un collegamento fuori dal LIMIT renderebbe irraggiungibile
    una libreria.

    `altri` è l'unico gruppo con un tetto (utenti_service.LIMITE_ELENCO) e
    porta in cima le richieste inviate. Non esiste alcun campo di
    conteggio totale: su un'istanza pubblica quanti siano gli iscritti non
    è un'informazione che l'elenco membri debba dare.
    """

    richieste_ricevute: list[MembroResponse]
    collegati: list[MembroResponse]
    altri: list[MembroResponse]


class LibreriaCollegatoResponse(BaseModel):
    """GET /utenti/{id}/voci: la libreria di un collegato, con il suo
    profilo incorporato — la pagina che la mostra deve poter scrivere il
    nome utente in cima anche a un refresh diretto, senza dipendere
    dall'elenco membri già in cache lato frontend (design-frontend.md
    §15)."""

    utente: UtenteEssenziale
    voci: list[VoceConLibroResponse]
