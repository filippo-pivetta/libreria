"""Contratti di `/collegamenti`: richieste, accettazione, interruzione
(issue #3).

Nessun campo id/utente_id che identifichi il chiamante in ingresso
(AGENTS.md): `InviaRichiestaRequest.utente_id` è un riferimento al
destinatario della richiesta, non al chiamante — stesso principio di
`AggiungiVoceRequest.libro_id` (app/schemas/voci.py).
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.utenti import UtenteEssenziale


class InviaRichiestaRequest(BaseModel):
    utente_id: UUID


class CollegamentoResponse(BaseModel):
    id: UUID
    stato: Literal["in_attesa", "attiva"]
    richiesto_da_me: bool
    altro: UtenteEssenziale
    creato_at: datetime
    aggiornato_at: datetime


class InviaRichiestaResponse(BaseModel):
    """`already_existed` distingue una richiesta appena creata da una
    già esistente per la stessa coppia — PRD, casi limite: "richieste
    doppie o inviate in contemporanea nascono come una sola relazione".
    In quel caso `collegamento` è la riga esistente as-is, qualunque sia
    il suo stato: non si forza mai un'accettazione."""

    collegamento: CollegamentoResponse
    already_existed: bool
