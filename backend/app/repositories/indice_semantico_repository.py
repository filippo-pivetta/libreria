"""Accesso dati grezzo a `indice_semantico` con l'identità dell'Utente.

Solo due operazioni sono raggiungibili da qui, ed è voluto: la tabella
concede a `authenticated` unicamente SELECT e DELETE (migrazione
20260818115830). Gli INSERT vivono nei lavori in secondo piano, su
connessione diretta — vedi `indicizzazione_repository`.

    cancella_tutti   la revoca del consenso, che nasce da un'azione
                     dell'Utente e va quindi eseguita con la sua identità
                     (docs/adr/0001)
    cerca            la RPC vettoriale, che PostgREST non sa esprimere
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_ID_IMPOSSIBILE = "00000000-0000-0000-0000-000000000000"
"""PostgREST rifiuta una DELETE senza filtro. Il filtro c'è ma non
seleziona nulla: la restrizione alle proprie righe la fa la RLS, non
questa condizione."""


def formatta_embedding(embedding: list[float]) -> str:
    """La forma testuale che `extensions.vector` accetta in ingresso.

    PostgREST passa gli argomenti di una RPC come JSON; un elenco di
    numeri arriverebbe comunque a Postgres come testo da convertire, e
    costruirlo qui rende la conversione esplicita invece che implicita.
    """
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


def cancella_tutti(client: Client) -> int:
    """Tutti i vettori del chiamante, nessuno di altri: ci pensa la policy
    `indice_semantico_delete_owner`. È il cuore della regola 30 ("nessun
    indice semantico costruito su quei contenuti sopravvive")."""
    response = client.table("indice_semantico").delete().neq("id", _ID_IMPOSSIBILE).execute()
    return len(cast("list[dict[str, Any]]", response.data))


def cerca(
    client: Client,
    embedding: list[float],
    limite: int,
    *,
    tipo: str | None = None,
    solo_spoiler: bool = False,
    anno: int | None = None,
    voce_ids: list[UUID] | None = None,
    contenuto_ids: list[UUID] | None = None,
    con_vicini: bool = False,
) -> list[dict[str, Any]]:
    """I filtri viaggiano DENTRO la RPC, non attorno.

    Applicarli qui, dopo che `cerca_semantico` ha già tagliato ai venti
    piu\u0300 vicini, darebbe un elenco vuoto ogni volta che quei venti sono
    tutti dell'anno sbagliato \u2014 e un elenco vuoto in questa pagina dice
    "non hai scritto nulla che somigli a questa domanda", che sarebbe
    falso. La funzione cerca quindi i venti piu\u0300 vicini FRA quelli che
    passano il filtro (migrazione 20260825170000_quaderni_corpus.sql).
    """
    response = client.rpc(
        "cerca_semantico",
        {
            "p_embedding": formatta_embedding(embedding),
            "p_limite": limite,
            "p_tipo": tipo,
            "p_solo_spoiler": solo_spoiler,
            "p_anno": anno,
            "p_voce_ids": [str(v) for v in voce_ids] if voce_ids else None,
            "p_contenuto_ids": [str(c) for c in contenuto_ids] if contenuto_ids else None,
            "p_con_vicini": con_vicini,
        },
    ).execute()
    return cast("list[dict[str, Any]]", response.data)
