from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator


class MeResponse(BaseModel):
    """Profilo pubblico (`utente`) più stato di consenso/informativa
    (`utente_privato`).

    Nessun campo email: nel prodotto le email non esistono (docs/prd.md),
    credenziali e recupero passano fuori dall'app. Nessun campo
    scrivibile oltre a `nome_utente` in fase di creazione (vedi
    `CompleteAccountRequest`): una volta scritto non è più modificabile
    dall'utente (docs/prd.md).
    """

    id: UUID
    nome_utente: str
    consenso_elaborazione_assistita: bool
    consenso_aggiornato_at: datetime
    informativa_accettata_at: datetime | None
    indici_stato: Literal["pronti", "spenti", "in_ricostruzione"]
    """Stato osservabile della ricerca semantica (issue #6). 'pronti':
    completa. 'spenti': consenso revocato, nessun indice esiste.
    'in_ricostruzione': consenso appena riattivato, il lavoro in
    secondo piano sta ricostruendo — l'interfaccia lo deve dichiarare
    invece di far credere che gli indici siano già pronti.
    Aggiunto qui il 22 agosto 2026: la colonna esisteva già in
    `utente_privato` e il repository la selezionava, ma senza un campo
    dichiarato qui il response_model la scartava in silenzio prima che
    arrivasse al frontend — lasciando la Torre senza alcun segnale
    reale sullo stato degli indici.
    """


class CompleteAccountRequest(BaseModel):
    """Corpo di POST /me: completamento dell'account dopo l'invito del
    Manutentore (docs/adr/0013). `nome_utente` è scelto dall'Utente qui,
    non dal Manutentore; la validazione ripete quella del vincolo
    `chk_utente_nome_utente_non_vuoto` nel database, che resta l'ultima
    linea di difesa (AGENTS.md: "validazione lato server sempre, anche se
    il client valida già")."""

    nome_utente: str

    @field_validator("nome_utente")
    @classmethod
    def _nome_utente_valido(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Il nome utente non può essere vuoto.")
        if len(stripped) > 40:
            raise ValueError("Il nome utente non può superare 40 caratteri.")
        return stripped


class ConsensoUpdateRequest(BaseModel):
    """Corpo di `PATCH /me/consenso`: l'interruttore del profilo (PRD,
    "Consenso all'elaborazione assistita").

    Un booleano solo, non un consenso per funzione: ADR 0008 ha scartato
    la granularità per funzione perché nella pratica la decisione è una
    sola, se i propri testi escono o no. Nessun campo id: l'identità
    arriva dal token.
    """

    consenso: bool
