"""Accesso dati grezzo per l'esportazione dei libri letti (issue #8, ADR
0011 rivisto): sola lettura su `voce_di_libreria` con stato "letto" e il
Libro incorporato.

Il client passato in ingresso opera sempre con l'identità di chi chiama
(`get_user_client`, docs/adr/0001): le RLS restano l'unico punto in cui
vive "chi vede cosa". Filtro esplicito su `utente_id`, non solo la RLS —
stesso motivo di `voce_repository`/`metriche_repository`: da quando un
collegato attivo può leggere le Voci "letto" altrui, una query senza
questo filtro mescolerebbe qui i libri di un collegato con i propri
(PRD, regola 33 di questa stessa issue).
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = (
    "pagine_adottate, voto, "
    "libro:libro_id (titolo_canonico, anno_prima_pubblicazione, lingua_originale, "
    "libro_autore(ordine, autore:autore_id(nome_canonico)), "
    "libro_genere(genere:genere_id(genere_etichetta(lingua, etichetta))), "
    "variante_titolo(lingua, titolo)), "
    "letture:lettura(data_inizio, data_fine, anno_fine, esito), "
    "recensione(testo)"
)


def list_libri_letti(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """Ogni Voce con stato "letto" dell'utente, Libro e Letture concluse
    incorporati: la scelta di quale Lettura sia "l'ultima conclusa" e come
    appiattire autori/generi/titolo spetta a `export_service`, non a
    questo repository (stessa divisione di `metriche_repository`/
    `metriche_service`)."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT)
        .eq("utente_id", str(utente_id))
        .eq("stato", "letto")
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)
