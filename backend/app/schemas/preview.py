"""Contratti della preview personalizzata (issue #6).

Nessun campo di visibilità, in nessuna forma: la regola 23 del PRD vieta
che una preview sia condivisibile, e il modo di garantirlo è che non
esista alcuna operazione per renderla tale — non un campo di default
privato che qualcuno un giorno potrebbe scrivere. Lo stesso vale nello
schema del database, dove `artefatto_generato` non ha colonna di
visibilità.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PreviewResponse(BaseModel):
    id: UUID
    voce_id: UUID
    testo: str
    creato_at: datetime
    avviso: str
    """L'indicazione, imposta dalla regola 20, che il testo è una sintesi
    generata. Campo obbligatorio e non frase dentro `testo`: così non
    dipende dall'obbedienza del modello e non consuma nessuna delle
    ottanta parole concesse."""
