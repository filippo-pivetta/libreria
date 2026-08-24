"""Contratti della scheda pubblica: un libro guardato PRIMA di averlo in
libreria (docs/design-frontend.md §13).

Una forma sola per due origini — una scheda già nel sistema e un volume
che sta solo su Google — perché il PRD vuole i risultati di ricerca
"presentati insieme, senza distinzione", e una carta che cambiasse
struttura a seconda di dove viene il libro renderebbe visibile proprio la
divisione che il prodotto nasconde. Cambia il contenuto (fuori dal
sistema non ci sono lingua originale né generi certi), non l'impianto.

`fonte` resta esposta perché il frontend deve sapere con quale comando si
aggiunge — `POST /libri` per un volume, `POST /voci` per una scheda — non
per etichettare la carta con la sua provenienza.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.ricerca import VoceDelRisultato


class GenereScheda(BaseModel):
    id: str
    etichetta: str


class SchedaPubblica(BaseModel):
    fonte: Literal["catalogo", "google"]

    libro_id: UUID | None = None
    """Valorizzato anche per `fonte = "google"` quando gli identificativi
    del volume sono già noti al catalogo: in quel caso la carta è servita
    dalla scheda vera, che ha dati migliori."""
    volume_id: str | None = None

    titolo: str
    autori: list[str]

    anno: int | None = None
    anno_di_edizione: bool = False
    """Vero quando `anno` è l'anno di QUESTA edizione e non della prima
    pubblicazione dell'opera: è ciò che Google dà, e il PRD vieta di
    confondere i due — per un classico ristampato il secondo sarebbe
    plausibile e sbagliato. Il frontend cambia l'etichetta, non il campo."""

    lingua_originale: str | None = None
    pagine: int | None = None
    generi: list[GenereScheda] = []

    descrizione: str | None = None
    descrizione_fonte: str | None = None
    """`wikipedia` o `google_books`. Fuori dal sistema è sempre la seconda:
    la prosa di Wikipedia arriva con un lavoro in secondo piano che parte
    alla nascita della scheda (§21), quindi prima dell'aggiunta si legge
    la quarta di copertina."""

    copertina_url: str | None = None
    copertina_colore_dominante: str | None = None
    copertina_colore_dominante_scuro: str | None = None

    voce: VoceDelRisultato | None = None
    """La propria Voce su questo libro, se esiste. Regge il verbo della
    carta come già fa nella riga dei risultati (§13)."""


class ParereEffimero(BaseModel):
    """Il parere "me lo consigli?" su un libro che non si ha in libreria.

    Nessun `id`, nessun `creato_at`, nessun `voce_id`: **non viene
    salvato**. Un artefatto generato è "conservato nella sua libreria"
    (PRD, entità Artefatto) e `artefatto_generato` lo lega alla Voce da cui
    è stato invocato con un vincolo di schema; senza libreria non c'è nulla
    a cui legarlo e nulla da conservare. Vive quanto la pagina.
    """

    testo: str
