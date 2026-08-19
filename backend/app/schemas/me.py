from datetime import datetime
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
