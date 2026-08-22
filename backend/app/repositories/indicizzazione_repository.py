"""Scritture su `indice_semantico` dai lavori in secondo piano, su
connessione diretta a Postgres.

Perché non PostgREST con la chiave di servizio: la tabella non ha (e non
deve avere) alcuna policy di INSERT per `authenticated`, e `service_role`
non ha comunque privilegi SQL sulle tabelle `public` — le stesse due
ragioni indipendenti che valgono per `catalogo_repository`
(docs/adr/0016).

Ogni funzione qui dentro prende un `utente_id` esplicito e lo mette in
`where`: sulla connessione diretta la RLS non protegge nulla, quindi la
proprietà è una condizione scritta a mano, non una garanzia ereditata. Un
lavoro che indicizzasse il testo di un Utente sotto l'id di un altro
violerebbe la regola 19 senza che nulla lo fermasse.
"""

from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

# La nota di intenzione non compare in nessuna di queste query, in nessuna
# forma: vive in `voce_di_libreria_privata`, tabella che questo modulo non
# nomina mai (PRD: "non viene mai inviata al fornitore né indicizzata, in
# nessuno stato del consenso").

_SQL_TESTI = {
    "insight": """
        select i.id, i.testo
          from public.insight i
         where i.utente_id = %(utente_id)s
    """,
    "recensione": """
        select r.id, r.testo
          from public.recensione r
         where r.utente_id = %(utente_id)s
    """,
}


def consenso_attivo(connection: psycopg.Connection[Any], utente_id: UUID) -> bool | None:
    """`None` quando la riga non esiste più: l'account è stato cancellato
    fra l'accodamento e l'esecuzione. Il gestore esce in silenzio, senza
    scrivere nulla su un account che non c'è più (PRD, caso limite
    "cancellazione con operazioni assistite in corso")."""
    with connection.cursor() as cursor:
        cursor.execute(
            "select consenso_elaborazione_assistita from public.utente_privato "
            "where utente_id = %(utente_id)s",
            {"utente_id": str(utente_id)},
        )
        riga = cursor.fetchone()
    return None if riga is None else bool(riga[0])


def testo_contenuto(
    connection: psycopg.Connection[Any], tipo: str, contenuto_id: UUID, utente_id: UUID
) -> str | None:
    """Il testo di un solo insight o di una sola recensione, **del solo
    Utente indicato**. `None` se la riga non esiste più o non è sua."""
    if tipo not in _SQL_TESTI:
        raise ValueError(f"tipo di contenuto sconosciuto: {tipo}")
    with connection.cursor() as cursor:
        cursor.execute(
            _SQL_TESTI[tipo] + " and id = %(contenuto_id)s",
            {"utente_id": str(utente_id), "contenuto_id": str(contenuto_id)},
        )
        riga = cursor.fetchone()
    return None if riga is None else str(riga[1])


def contenuti_da_indicizzare(
    connection: psycopg.Connection[Any], utente_id: UUID
) -> list[tuple[str, UUID, str]]:
    """Tutti gli insight e le recensioni dell'Utente, per la ricostruzione
    in blocco alla riattivazione del consenso."""
    contenuti: list[tuple[str, UUID, str]] = []
    with connection.cursor(row_factory=dict_row) as cursor:
        for tipo, sql in _SQL_TESTI.items():
            cursor.execute(sql, {"utente_id": str(utente_id)})
            contenuti.extend((tipo, UUID(str(r["id"])), str(r["testo"])) for r in cursor.fetchall())
    return contenuti


def scrivi_embedding(
    connection: psycopg.Connection[Any],
    utente_id: UUID,
    tipo: str,
    contenuto_id: UUID,
    embedding: list[float],
) -> None:
    """Sostituisce il vettore di quel contenuto, se già c'era.

    Cancellazione più inserimento invece di `on conflict`: la tabella non
    ha un vincolo unico su (tipo, contenuto), perché lo schema è stato
    scritto prima di questo codice. Le due istruzioni stanno nella stessa
    transazione della connessione del worker, quindi non esiste un istante
    in cui il vettore vecchio è sparito e il nuovo non c'è ancora per
    nessun altro lettore.
    """
    if tipo not in _SQL_TESTI:
        raise ValueError(f"tipo di contenuto sconosciuto: {tipo}")
    colonna = "insight_id" if tipo == "insight" else "recensione_id"
    vettore = "[" + ",".join(repr(float(x)) for x in embedding) + "]"
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            f"delete from public.indice_semantico "  # noqa: S608  # colonna da elenco chiuso
            f"where utente_id = %(utente_id)s and {colonna} = %(contenuto_id)s",
            {"utente_id": str(utente_id), "contenuto_id": str(contenuto_id)},
        )
        cursor.execute(
            f"insert into public.indice_semantico "  # noqa: S608
            f"(utente_id, tipo_contenuto, {colonna}, embedding) "
            f"values (%(utente_id)s, %(tipo)s, %(contenuto_id)s, "
            f"%(embedding)s::extensions.vector)",
            {
                "utente_id": str(utente_id),
                "tipo": tipo,
                "contenuto_id": str(contenuto_id),
                "embedding": vettore,
            },
        )


def cancella_indici(connection: psycopg.Connection[Any], utente_id: UUID) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "delete from public.indice_semantico where utente_id = %(utente_id)s",
            {"utente_id": str(utente_id)},
        )


def imposta_indici_stato(connection: psycopg.Connection[Any], utente_id: UUID, stato: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "update public.utente_privato set indici_stato = %(stato)s "
            "where utente_id = %(utente_id)s",
            {"stato": stato, "utente_id": str(utente_id)},
        )
