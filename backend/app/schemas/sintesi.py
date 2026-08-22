"""Contratto della sintesi tematica (issue #27, riscritta il 22 agosto
2026 da un unico paragrafo a un elenco di temi con le prove attaccate —
vedi il docstring di `app/services/sintesi_service.py`)."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RiferimentoTema(BaseModel):
    """Un insight o una recensione che sostiene un tema. Sempre del
    proprietario (regola 19): il testo qui è una fotografia di ciò che
    l'insight o la recensione dicevano al momento della generazione, non
    un collegamento vivo — coerente con il fatto che l'intero artefatto è
    una fotografia (`artefatto_repository.py`)."""

    voce_id: UUID
    titolo: str
    tipo: Literal["insight", "recensione"]
    testo: str
    data: date


class Tema(BaseModel):
    nome: str
    sintesi: str
    """Non supera i vincoli di forma verificati dal service (niente
    virgolette, tetto di parole): stessa disciplina della regola 20 per
    la preview, applicata qui riga per riga invece che sull'intero
    testo."""
    riferimenti: list[RiferimentoTema]


class SintesiTematicaResponse(BaseModel):
    id: UUID
    creato_at: datetime
    avviso: str
    """Come per la preview: campo obbligatorio della risposta, non frase
    dentro un testo, così non dipende dall'obbedienza del modello."""
    temi: list[Tema]
