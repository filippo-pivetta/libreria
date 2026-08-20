"""Accesso dati grezzo a `collegamento`.

Il client passato in ingresso opera sempre con l'identità dell'utente
(`get_user_client`, docs/adr/0001): le RLS restano l'unico punto in cui
vive la regola "chi vede cosa" — normalizzazione della coppia
(utente_a_id, utente_b_id) esclusa, che è responsabilità applicativa
(commento sulla tabella in supabase/migrations/20260818115830) e vive nel
service, non qui.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

# Le tre colonne che referenziano `utente` (utente_a_id, utente_b_id,
# richiesto_da_id) sono tre FK distinte verso la stessa tabella: PostgREST
# richiede l'hint esplicito `alias:colonna(...)` per disambiguare
# l'embedding, altrimenti rifiuterebbe la richiesta come ambigua.
_SELECT_CON_UTENTI = (
    "id, stato, richiesto_da_id, creato_at, aggiornato_at, "
    "utente_a:utente_a_id(id, nome_utente), utente_b:utente_b_id(id, nome_utente)"
)


def _con_altro_utente(riga: dict[str, Any], self_id: UUID) -> dict[str, Any]:
    """PostgREST restituisce entrambi i partecipanti (`utente_a`,
    `utente_b`); il chiamante vuole solo "l'altro" rispetto a `self_id`,
    più un booleano piatto per la direzione della richiesta — forma che
    `CollegamentoResponse` (app/schemas/collegamenti.py) si aspetta."""
    self_str = str(self_id)
    utente_a = riga.pop("utente_a")
    utente_b = riga.pop("utente_b")
    riga["altro"] = utente_b if utente_a["id"] == self_str else utente_a
    riga["richiesto_da_me"] = riga.pop("richiesto_da_id") == self_str
    return riga


def list_per_utente(client: Client, self_id: UUID) -> list[dict[str, Any]]:
    """Tutti i collegamenti (in attesa o attivi) di cui `self_id` è
    partecipante, con l'altro utente incorporato. Riusata sia per la
    Torre (richieste + attivi) sia per calcolare lo stato di relazione
    nell'elenco membri (`utenti_service.elenco_membri`).

    `self_id` arriva sempre da `current_user.id`, già verificato dal
    JWT (`get_current_user`), mai da input dell'utente: l'OR letterale
    sotto è sicuro solo per questo — non andrebbe mai costruito da un
    parametro non fidato, che potrebbe iniettare filtri PostgREST
    arbitrari."""
    self_str = str(self_id)
    response = (
        client.table("collegamento")
        .select(_SELECT_CON_UTENTI)
        .or_(f"utente_a_id.eq.{self_str},utente_b_id.eq.{self_str}")
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return [_con_altro_utente(riga, self_id) for riga in righe]


def create(
    client: Client, utente_a_id: UUID, utente_b_id: UUID, richiesto_da_id: UUID
) -> dict[str, Any]:
    """Nasce sempre 'in_attesa' (default di colonna). La coppia va già
    normalizzata (utente_a_id < utente_b_id) da chi chiama — vincolo
    `chk_collegamento_ordine` a livello DB, non verificato qui."""
    response = (
        client.table("collegamento")
        .insert(
            {
                "utente_a_id": str(utente_a_id),
                "utente_b_id": str(utente_b_id),
                "richiesto_da_id": str(richiesto_da_id),
            }
        )
        .select(_SELECT_CON_UTENTI)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return _con_altro_utente(rows[0], richiesto_da_id)


def get_by_coppia(
    client: Client, utente_a_id: UUID, utente_b_id: UUID, self_id: UUID
) -> dict[str, Any] | None:
    """La riga esistente per una coppia già normalizzata — usata dal
    service per il ritorno idempotente quando l'insert fallisce su
    `uq_collegamento_coppia` (23505, richiesta doppia o simultanea)."""
    response = (
        client.table("collegamento")
        .select(_SELECT_CON_UTENTI)
        .eq("utente_a_id", str(utente_a_id))
        .eq("utente_b_id", str(utente_b_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return _con_altro_utente(cast("dict[str, Any]", response.data), self_id)


def accetta(client: Client, collegamento_id: UUID, self_id: UUID) -> dict[str, Any] | None:
    """Unico canale di accettazione: `in_attesa` -> `attiva`. Il filtro
    `.eq("stato", "in_attesa")` è difesa in profondità oltre alla RLS
    (`collegamento_update_partecipante_non_richiedente`, che già
    esclude il richiedente): `None` se la riga non esiste, non è tua,
    sei tu il richiedente, o è già attiva — tutti indistinguibili."""
    response = (
        client.table("collegamento")
        .update({"stato": "attiva"})
        .eq("id", str(collegamento_id))
        .eq("stato", "in_attesa")
        .select(_SELECT_CON_UTENTI)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    if not rows:
        return None
    return _con_altro_utente(rows[0], self_id)


def delete(client: Client, collegamento_id: UUID) -> bool:
    """True se una riga è stata cancellata. Copre rifiuto (in_attesa),
    ritiro (in_attesa, dal richiedente) e interruzione (attiva) — stessa
    operazione RLS-wise per qualunque partecipante in qualunque stato
    (`collegamento_delete_partecipante`). False se non trovata o non
    tua, indistinguibili (PRD: un rifiuto non lascia traccia)."""
    response = client.table("collegamento").delete().eq("id", str(collegamento_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0


def is_collegato_attivo(client: Client, altro_utente_id: UUID) -> bool:
    """Riusa la funzione SQL `public.is_collegato_attivo` (stessa che le
    RLS di voce_di_libreria/lettura/... già usano) invece di
    reimplementare il controllo in Python — un solo posto in cui la
    regola "sono collegato con questo utente?" è definita."""
    response = client.rpc(
        "is_collegato_attivo", {"altro_utente_id": str(altro_utente_id)}
    ).execute()
    return cast(bool, response.data)
