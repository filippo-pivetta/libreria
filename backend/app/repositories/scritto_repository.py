"""Accesso dati grezzo al corpus dei Quaderni.

Tutto passa da funzioni SQL e non da PostgREST per una ragione sola:
insight e recensione sono due tabelle, e il corpus è la loro unione. La
vista `public.scritto` la fa una volta (migrazione
20260825170000_quaderni_corpus.sql), le funzioni ci costruiscono sopra
filtri, paginazione, conteggi e confronti vettoriali che PostgREST non
sa esprimere.

Tutte `security invoker`, quindi la RLS di `insight` e `recensione`
resta l'unico punto in cui vive "chi vede cosa" (docs/adr/0001), e tutte
filtrano in più esplicitamente su `auth.uid()`: è la stessa scelta di
`GET /voci` e di `cerca_semantico` — la regola di prodotto ("i propri
scritti, mai quelli condivisi da un collegato") sta scritta accanto alla
regola di accesso, non affidata solo a quest'ultima.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client


def elenco(
    client: Client,
    *,
    tipo: str | None,
    solo_spoiler: bool,
    anno: int | None,
    voce_ids: list[UUID] | None,
    contenuto_ids: list[UUID] | None,
    con_vicini: bool,
    limite: int,
    scarto: int,
) -> list[dict[str, Any]]:
    """La lente "sfoglia": i propri scritti dal più recente, filtrati.

    `totale` e `libri_distinti` arrivano ripetuti su ogni riga — è come
    la funzione li restituisce, perché il conteggio in pagina non deve
    poter divergere dalle righe che lo accompagnano. Il service li legge
    dalla prima riga.
    """
    risposta = client.rpc(
        "elenco_scritti",
        {
            "p_tipo": tipo,
            "p_solo_spoiler": solo_spoiler,
            "p_anno": anno,
            "p_voce_ids": [str(v) for v in voce_ids] if voce_ids else None,
            "p_contenuto_ids": [str(c) for c in contenuto_ids] if contenuto_ids else None,
            "p_con_vicini": con_vicini,
            "p_limite": limite,
            "p_scarto": scarto,
        },
    ).execute()
    return cast("list[dict[str, Any]]", risposta.data or [])


def sfaccettature(client: Client) -> list[dict[str, Any]]:
    risposta = client.rpc("sfaccettature_scritti", {}).execute()
    return cast("list[dict[str, Any]]", risposta.data or [])


def pensiero_che_torna(client: Client, scarto: int) -> dict[str, Any] | None:
    """Zero o una riga: la funzione ne sceglie una sola, e restituisce
    l'insieme vuoto quando non c'è ancora nulla di scritto."""
    risposta = client.rpc("pensiero_che_torna", {"p_scarto": scarto}).execute()
    righe = cast("list[dict[str, Any]]", risposta.data or [])
    return righe[0] if righe else None


def vicini(client: Client, contenuto_id: UUID, limite: int) -> list[dict[str, Any]]:
    """I propri scritti più vicini a uno dato.

    **Nessuna chiamata al fornitore**: il vettore di partenza è già in
    `indice_semantico`, scritto quando l'insight è stato salvato. È
    l'unica funzione assistita personale dell'app che non costa nulla per
    gesto — il consenso la governa comunque, perché la revoca cancella
    gli indici e non resta niente da confrontare.
    """
    risposta = client.rpc(
        "vicini_a", {"p_contenuto_id": str(contenuto_id), "p_limite": limite}
    ).execute()
    return cast("list[dict[str, Any]]", risposta.data or [])
