"""Contratti di `/voci/{id}/insight` e `/insight/{id}` (issue #5).

`InsightEssenziale` (in `app/schemas/voci.py`, non qui) è la forma annidata
in `GET /voci/{id}`: il suo `testo` è `None` quando `spoiler` è vero **e chi
guarda non è il proprietario** (PRD regola 10, design-frontend.md §11: la
regola protegge da uno spoiler altrui, non da un proprio testo — il
proprietario lo vede sempre per intero). Gli schemi qui sotto sono l'eco di
una propria scrittura — `testo` è sempre quello appena inviato dal
chiamante, mai un elenco o un'anteprima: la regola 10 non si applica.
"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.recensioni import Visibilita


class InsightCreateRequest(BaseModel):
    """Nessun `lettura_id`: il server lo deduce dalla Lettura aperta
    corrente della Voce (PRD, entità Insight — "legato alla Lettura aperta
    se ce n'è una"), non è una scelta del chiamante."""

    testo: str
    spoiler: bool = False
    visibilita: Visibilita = "condiviso"


class InsightUpdateRequest(BaseModel):
    """Tutti i campi opzionali: `None` vuol dire "non toccare questo campo",
    non "cancellalo" — `testo` è `not null` a schema, diversamente dalla
    nota di intenzione."""

    testo: str | None = None
    spoiler: bool | None = None
    visibilita: Visibilita | None = None


class InsightResponse(BaseModel):
    id: UUID
    voce_id: UUID
    lettura_id: UUID | None
    testo: str
    spoiler: bool
    visibilita: Visibilita
    data: date
    creato_at: datetime


class RivelaInsightResponse(BaseModel):
    """GET /insight/{id}/testo: il gesto esplicito di scoprire un insight
    contrassegnato spoiler (design-frontend.md §11)."""

    testo: str
