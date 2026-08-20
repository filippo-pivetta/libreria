"""Accesso dati grezzo a `voce_di_libreria` (+ `libro` incorporato per lo
scaffale/la scheda del libro).

Il client passato in ingresso opera sempre con l'identità dell'utente
(`get_user_client`, docs/adr/0001): le RLS restano l'unico punto in cui
vive la regola "chi vede cosa". Nessuna regola di dominio qui — la
macchina a stati e i vincoli tra righe vivono nel database (trigger/RPC,
supabase/migrations/20260820065144_ciclo_di_lettura.sql, docs/adr/0015).
"""

from datetime import date
from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT_BASE = (
    "id, utente_id, libro_id, stato, pagine_adottate, voto, nota_intenzione, creato_at, "
    "aggiornato_at"
)

_SELECT_CON_LIBRO = (
    f"{_SELECT_BASE}, "
    "libro:libro_id (id, titolo_canonico, anno_prima_pubblicazione, lingua_originale, "
    "copertina_miniatura_path, copertina_grande_path, "
    "libro_autore(ordine, autore:autore_id(id, nome_canonico)))"
)

# GET /voci: come sopra, più la pagina raggiunta nella Lettura aperta (se
# c'è), per il filo di avanzamento della fascia "in corso" dello scaffale
# (design-frontend.md §7, regola 8). Alias diverso da quello usato in
# _SELECT_DETTAGLIO sotto (che incorpora l'intero storico, non solo la
# Lettura aperta): due alias distinti sulla stessa tabella lettura non
# confliggono in PostgREST.
_SELECT_LISTA = f"{_SELECT_CON_LIBRO}, lettura_aperta:lettura(avanzamento(pagina))"

# GET /voci/{id}: come sopra, con l'intero storico delle Letture — ciascuna
# con i propri avanzamenti — annidato via le FK composite verso
# voce_di_libreria(id, utente_id) e lettura(id, utente_id) (schema
# esistente, 20260818115830). PostgREST le risolve senza bisogno di una
# seconda chiamata (verificato manualmente contro PostgREST locale).
_SELECT_DETTAGLIO = (
    f"{_SELECT_CON_LIBRO}, "
    "letture:lettura (id, data_inizio, data_fine, esito, creato_at, "
    "avanzamenti:avanzamento (id, pagina, data, generato_automaticamente, creato_at))"
)


def _appiattisci_autori(voce: dict[str, Any]) -> dict[str, Any]:
    """PostgREST restituisce gli autori imbustati nella riga di giunzione
    (`libro.libro_autore[].autore`), non come lista piatta: `autori` è la
    forma che `LibroEssenziale` (app/schemas/voci.py) si aspetta.
    Trasformazione puramente strutturale, non una regola di dominio —
    l'ordine (`ordine`, regola 18 del PRD sul peso ripartito tra più
    autori) arriva già corretto dalla query, qui non si riordina nulla."""
    libro = voce.get("libro")
    if libro is not None:
        libro["autori"] = [
            riga["autore"] for riga in libro.pop("libro_autore", []) if riga.get("autore")
        ]
    return voce


def _con_pagina_corrente(voce: dict[str, Any]) -> dict[str, Any]:
    """Estrae la pagina dell'ultimo avanzamento della sola Lettura aperta
    (se c'è) in un campo piatto `pagina_corrente`, e rimuove la busta
    `lettura_aperta` di PostgREST. La pagina più alta è per costruzione
    l'ultima raggiunta: la monotonia è garantita da trg_avanzamento_valida,
    non serve ordinare per data."""
    letture_aperte = voce.pop("lettura_aperta", [])
    avanzamenti = letture_aperte[0]["avanzamento"] if letture_aperte else []
    ultimo = max((a["pagina"] for a in avanzamenti), default=None)
    voce["pagina_corrente"] = ultimo
    return voce


def get_by_libro(client: Client, libro_id: UUID, utente_id: UUID) -> dict[str, Any] | None:
    """La propria Voce per un Libro, se esiste. Regola 11 (al più una
    Voce per Libro) è garantita dal vincolo
    `uq_voce_di_libreria_utente_libro`: qui si interroga soltanto, per
    decidere se `POST /voci` deve creare o restituire l'esistente.

    Filtro esplicito su `utente_id`, non solo la RLS: da quando la RLS di
    `voce_di_libreria` permette anche a un collegato attivo di leggere
    questa riga (issue #3), una `.eq("libro_id", ...)` senza filtro
    troverebbe anche la Voce del collegato per lo stesso libro — al
    minimo un dedup sbagliato (creerebbe la propria come se non
    esistesse mai, o viceversa la scambierebbe per esistente), al
    peggio un errore da `.maybe_single()` se entrambe le righe sono
    visibili insieme."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_BASE)
        .eq("libro_id", str(libro_id))
        .eq("utente_id", str(utente_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return cast("dict[str, Any]", response.data)


def create(client: Client, utente_id: UUID, libro_id: UUID) -> dict[str, Any]:
    """Nasce sempre con stato 'da_leggere' (default di colonna): nessun
    altro campo è scrivibile all'aggiunta (PRD, comportamento #3)."""
    response = (
        client.table("voce_di_libreria")
        .insert({"utente_id": str(utente_id), "libro_id": str(libro_id)})
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0]


def list_con_libro(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """La libreria di `utente_id`, con Libro incorporato: filtro
    esplicito, non la sola RLS (issue #3 — la RLS permette anche a un
    collegato attivo di leggere queste righe, quindi ometterlo
    mescolerebbe qui la propria libreria con quella di un collegato).
    Riusata identica sia per `GET /voci` (con `utente_id` = chi chiama)
    sia per `GET /utenti/{id}/voci` (con l'id del collegato, dopo che
    il chiamante ha già verificato il collegamento attivo)."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_LISTA)
        .eq("utente_id", str(utente_id))
        .order("ordine", foreign_table="libro.libro_autore")
        .is_("lettura_aperta.data_fine", "null")
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return [_con_pagina_corrente(_appiattisci_autori(riga)) for riga in righe]


def get_dettaglio(client: Client, voce_id: UUID) -> dict[str, Any] | None:
    """La Voce con Libro e l'intero storico delle Letture (ciascuna con i
    propri avanzamenti), per la scheda del libro. Letture più recenti per
    prime, avanzamenti di ciascuna in ordine cronologico (design-
    frontend.md §10: "raggruppati per lettura", le letture più vecchie su
    una carta di luminanza diversa)."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_DETTAGLIO)
        .eq("id", str(voce_id))
        .order("ordine", foreign_table="libro.libro_autore")
        .order("data_inizio", desc=True, foreign_table="letture")
        .order("data", foreign_table="letture.avanzamenti")
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return _appiattisci_autori(cast("dict[str, Any]", response.data))


def update_pagine_adottate(
    client: Client, voce_id: UUID, pagine_adottate: int | None
) -> dict[str, Any] | None:
    """Il tetto/adeguamento dell'avanzamento finale (regola 14, PRD "il
    totale è un tetto, non un moltiplicatore") sono imposti dal trigger
    `trg_voce_pagine_adottate`, non da questa funzione."""
    response = (
        client.table("voce_di_libreria")
        .update({"pagine_adottate": pagine_adottate})
        .eq("id", str(voce_id))
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0] if rows else None


def update_voto(client: Client, voce_id: UUID, voto: float | None) -> dict[str, Any] | None:
    """Nessun trigger coinvolto (a differenza di pagine_adottate): il
    vincolo 1-5 è un CHECK dichiarativo sulla colonna, non un vincolo tra
    righe."""
    response = (
        client.table("voce_di_libreria")
        .update({"voto": voto})
        .eq("id", str(voce_id))
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0] if rows else None


def update_nota_intenzione(
    client: Client, voce_id: UUID, nota_intenzione: str | None
) -> dict[str, Any] | None:
    response = (
        client.table("voce_di_libreria")
        .update({"nota_intenzione": nota_intenzione})
        .eq("id", str(voce_id))
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return rows[0] if rows else None


def cambia_stato(
    client: Client, voce_id: UUID, nuovo_stato: str, data: date | None
) -> dict[str, Any]:
    """Unico canale di scrittura per `stato`: la RPC `cambia_stato_voce`
    valida la matrice di transizione e applica i suoi effetti collaterali
    (docs/adr/0015). La funzione non è SETOF: PostgREST restituisce un
    singolo oggetto, non un elenco."""
    response = client.rpc(
        "cambia_stato_voce",
        {
            "p_voce_id": str(voce_id),
            "p_nuovo_stato": nuovo_stato,
            "p_data": data.isoformat() if data is not None else None,
        },
    ).execute()
    return cast("dict[str, Any]", response.data)
