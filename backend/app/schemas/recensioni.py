"""Contratti di `/voci/{id}/recensione` (issue #5).

Una recensione per Voce (`uq_recensione_voce`): scrivere è sempre un upsert
(PUT), mai una POST separata da un PATCH — non esiste "crea" distinto da
"sostituisci" per questa risorsa (PRD, entità Recensione: "una rilettura
non la cancella: resta quella finché l'Utente non la riscrive, e in quel
caso la precedente non viene conservata").
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

Visibilita = Literal["condiviso", "privato"]


class RecensioneRequest(BaseModel):
    testo: str
    visibilita: Visibilita = "condiviso"


class RecensioneResponse(BaseModel):
    id: UUID
    voce_id: UUID
    testo: str
    visibilita: Visibilita
    creato_at: datetime
    aggiornato_at: datetime
