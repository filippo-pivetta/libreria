"""Accesso dati grezzo alla coda dei lavori in secondo piano (`lavoro`).

Unico repository che non riceve un client Supabase ma una connessione
diretta a Postgres, e non è una scorciatoia: `FOR UPDATE SKIP LOCKED` non
è esprimibile in PostgREST, e una RPC che lo incapsulasse andrebbe esposta
al Data API e poi difesa dall'essere invocata da un Utente — si
costruirebbe una superficie pubblica per un'operazione che nessun Utente
deve poter chiamare. La tabella infatti non concede alcun privilegio a
`authenticated`, nemmeno SELECT (migrazione 20260821120000, docs/adr/0016).

Funzioni sincrone come tutti gli altri repository: chi le chiama dal mondo
asincrono passa da `run_in_threadpool`.
"""

from datetime import timedelta
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

# La presa in carico è UNA sola istruzione, non un SELECT seguito da un
# UPDATE: così resta atomica anche dietro un pooler in modalità
# transazione, dove due istruzioni separate potrebbero finire su
# connessioni diverse. `skip locked` fa sì che due worker in parallelo si
# spartiscano la coda invece di aspettarsi a vicenda.
_SQL_PRENDI_IN_CARICO = """
with preso as (
    select id
      from public.lavoro
     where stato = 'in_attesa'
       and esegui_dopo <= now()
     order by esegui_dopo, id
     for update skip locked
     limit %(lotto)s
)
update public.lavoro l
   set stato = 'in_corso',
       preso_at = now(),
       -- Incrementato QUI e non al fallimento: un worker ucciso a metà
       -- lavoro brucia comunque un tentativo. Senza, un lavoro che fa
       -- cadere il processo verrebbe ripreso all'infinito a ogni riavvio.
       tentativi = l.tentativi + 1,
       aggiornato_at = now()
  from preso
 where l.id = preso.id
returning l.id, l.tipo, l.chiave, l.payload, l.tentativi;
"""

_SQL_ACCODA = """
insert into public.lavoro (tipo, chiave, payload)
values (%(tipo)s, %(chiave)s, %(payload)s)
on conflict do nothing;
"""

_SQL_RECUPERA_ORFANI = """
update public.lavoro
   set stato = 'in_attesa',
       esegui_dopo = now(),
       aggiornato_at = now()
 where stato = 'in_corso'
   and preso_at < now() - %(oltre)s::interval;
"""


def accoda(
    connection: psycopg.Connection[Any], tipo: str, chiave: str, payload: dict[str, Any]
) -> None:
    """Accoda un lavoro, ignorando in silenzio il duplicato.

    `on conflict do nothing` contro `uq_lavoro_pendente`: due Utenti che
    aggiungono la stessa opera nello stesso minuto non devono accodare due
    recuperi della stessa copertina. Non è un errore da segnalare — il
    lavoro che serve è già in coda.
    """
    with connection.cursor() as cursor:
        cursor.execute(_SQL_ACCODA, {"tipo": tipo, "chiave": chiave, "payload": Jsonb(payload)})


def prendi_in_carico(connection: psycopg.Connection[Any], lotto: int) -> list[dict[str, Any]]:
    """Marca `in_corso` fino a `lotto` lavori pronti e li restituisce."""
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(_SQL_PRENDI_IN_CARICO, {"lotto": lotto})
        return list(cursor.fetchall())


def segna_riuscito(connection: psycopg.Connection[Any], lavoro_id: int) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "update public.lavoro set stato = 'riuscito', errore = null, "
            "aggiornato_at = now() where id = %(id)s",
            {"id": lavoro_id},
        )


def segna_fallito(connection: psycopg.Connection[Any], lavoro_id: int, errore: str) -> None:
    """Esito terminale: nessun altro tentativo automatico."""
    with connection.cursor() as cursor:
        cursor.execute(
            "update public.lavoro set stato = 'fallito', errore = %(errore)s, "
            "aggiornato_at = now() where id = %(id)s",
            {"id": lavoro_id, "errore": errore[:2000]},
        )


def rimetti_in_coda(
    connection: psycopg.Connection[Any], lavoro_id: int, errore: str, riprova_fra: timedelta
) -> None:
    """Fallimento transitorio: si riproverà dopo l'attesa indicata."""
    with connection.cursor() as cursor:
        cursor.execute(
            "update public.lavoro set stato = 'in_attesa', errore = %(errore)s, "
            "esegui_dopo = now() + %(fra)s::interval, aggiornato_at = now() "
            "where id = %(id)s",
            {"id": lavoro_id, "errore": errore[:2000], "fra": riprova_fra},
        )


def recupera_orfani(connection: psycopg.Connection[Any], oltre: timedelta) -> int:
    """Rimette in coda i lavori lasciati `in_corso` da un worker morto.

    Senza questo, un processo ucciso a metà lavoro lascerebbe righe
    `in_corso` che nessuno riprenderà mai: `uq_lavoro_pendente` le
    considera pendenti, quindi bloccherebbero anche il riaccodamento
    dello stesso lavoro. `tentativi` è già stato incrementato alla presa
    in carico, quindi il conteggio resta corretto e un lavoro velenoso
    non gira all'infinito.
    """
    with connection.cursor() as cursor:
        cursor.execute(_SQL_RECUPERA_ORFANI, {"oltre": oltre})
        return cursor.rowcount
