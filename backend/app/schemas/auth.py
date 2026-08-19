from uuid import UUID

from pydantic import BaseModel


class AuthenticatedUser(BaseModel):
    """Identità risolta da `Depends(get_current_user)` (app/core/security.py).

    Non è mai un `response_model`: `access_token` esiste solo per costruire
    un client Supabase con l'identità dell'utente (`get_user_client`,
    docs/adr/0001), mai per finire in una risposta HTTP.
    """

    id: UUID
    email: str | None = None
    access_token: str
