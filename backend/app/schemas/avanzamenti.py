"""Contratti di `/letture/{id}/avanzamenti` e `/avanzamenti`.

Le regole di monotonia, tetto pagine e non-futuro (PRD, regole 14/15)
sono imposte dal trigger `trg_avanzamento_valida`
(supabase/migrations/20260820065144_ciclo_di_lettura.sql): questi schemi
validano solo la forma, non le regole tra righe — coerente con "validazione
lato server sempre" (AGENTS.md), qui il "server" ultimo è il database.
"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RegistraAvanzamentoRequest(BaseModel):
    pagina: int = Field(ge=0)
    data: date | None = None


class CorreggiAvanzamentoRequest(BaseModel):
    """Entrambi i campi opzionali: si può correggere solo la pagina, solo
    la data, o entrambe in un'unica scrittura (un solo giro dal
    trigger di monotonia, invece di due scritture che potrebbero
    violarla temporaneamente l'una senza l'altra)."""

    pagina: int | None = Field(default=None, ge=0)
    data: date | None = None


class AvanzamentoResponse(BaseModel):
    id: UUID
    lettura_id: UUID
    pagina: int
    data: date
    generato_automaticamente: bool
    creato_at: datetime
