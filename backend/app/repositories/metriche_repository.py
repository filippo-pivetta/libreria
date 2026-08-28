"""Accesso dati grezzo per le metriche di lettura (issue #7): sola
lettura aggregata su `lettura`, `avanzamento` e `voce_di_libreria` (+
`libro`/`autore`/`genere` incorporati). Nessuna tabella nuova.

Il client passato in ingresso opera sempre con l'identità di chi chiama
(`get_user_client`, ADR 0001): le RLS di `lettura`/`avanzamento`/
`voce_di_libreria` restano l'unico punto in cui vive "chi vede cosa" (il
proprietario o un collegato attivo). Ogni funzione qui filtra comunque in
modo esplicito su `utente_id`, non solo per RLS — stesso motivo già
scritto in AGENTS.md per `GET /voci`: senza il filtro esplicito, una
query "tutte le righe visibili" mescolerebbe i propri dati con quelli di
un collegato, violando la regola 17 del PRD ("le metriche di un Utente
sono calcolate solo sui suoi dati") nel momento stesso in cui questo
modulo viene chiamato per le metriche di un collegato
(`GET /utenti/{id}/metriche`)."""

from typing import Any, cast
from uuid import UUID

from supabase import Client


def list_letture(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """Ogni Lettura dell'utente, aperta o chiusa, qualunque esito: serve
    sia per "libri finiti" (le concluse, filtrate per anno di chiusura
    nel service) sia per calcolare `anno_minimo`.

    `anno_fine` accanto a `data_fine` perché l'anno di chiusura può venire
    da una data piena o dalla sola annata di una lettura registrata a
    posteriori (migrazione 20260827160000): il service le mette sullo
    stesso piano con `_anno_chiusura`."""
    response = (
        client.table("lettura")
        .select("id, voce_id, data_inizio, data_fine, anno_fine, esito")
        .eq("utente_id", str(utente_id))
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)


def list_avanzamenti(client: Client, utente_id: UUID) -> list[dict[str, Any]]:
    """Ogni Avanzamento dell'utente, di qualunque Lettura e qualunque
    anno: l'incremento di un Avanzamento datato nell'anno richiesto può
    dipendere dalla pagina di un Avanzamento precedente datato l'anno
    prima (PRD, entità Avanzamento), quindi il calcolo non può limitarsi
    a filtrare per anno in questa query. Ordinata per Lettura e poi per
    (data, creato_at) — lo stesso ordine con cui `trg_avanzamento_valida`
    individua il "precedente" (supabase/migrations/
    20260820065144_ciclo_di_lettura.sql) — così il service calcola gli
    incrementi con un solo passaggio lineare."""
    response = (
        client.table("avanzamento")
        .select("lettura_id, pagina, data, creato_at")
        .eq("utente_id", str(utente_id))
        .order("lettura_id")
        .order("data")
        .order("creato_at")
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)


def list_voci_con_libro(client: Client, voce_ids: set[UUID]) -> dict[str, dict[str, Any]]:
    """La Voce (voto, pagine adottate) col suo Libro (+ titolo e sue
    varianti, + autori, + generi), indicizzata per `voce_id`. Le Voci
    arrivano già dalla FK composita `lettura -> voce_di_libreria(id,
    utente_id)`: appartengono per costruzione allo stesso utente delle
    Letture che le hanno prodotte, senza bisogno di un secondo filtro
    qui.

    Restituisce la Voce intera e non il solo Libro perché tre metriche
    stanno sulla Voce e non sull'opera: il voto medio e la sua
    distribuzione (`voto`), e lo scarto che rende concreto il limite
    sulle pagine (`pagine_adottate`). Nessuna andata-e-ritorno in più:
    sono colonne della riga che questa query già legge."""
    if not voce_ids:
        return {}
    response = (
        client.table("voce_di_libreria")
        .select(
            "id, voto, pagine_adottate, libro:libro_id (id, titolo_canonico, "
            "variante_titolo(lingua, titolo), "
            "libro_autore(autore:autore_id(id, nome_canonico)), "
            "libro_genere(genere:genere_id(id, genere_etichetta(lingua, etichetta))))"
        )
        .in_("id", [str(v) for v in voce_ids])
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return {riga["id"]: riga for riga in righe}
