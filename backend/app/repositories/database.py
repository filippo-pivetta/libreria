"""Accesso diretto a Postgres, al di fuori del client Supabase.

Due usi, entrambi fuori dalla portata di PostgREST: la verifica di
raggiungibilità dell'health check, e l'apertura di connessioni per i
percorsi che hanno bisogno di una transazione su più tabelle o di
costrutti SQL che PostgREST non esprime (`FOR UPDATE SKIP LOCKED` della
coda dei lavori). Nessuna query di dominio qui: quelle stanno nei
repository che ricevono la connessione.
"""

from typing import Any

import psycopg

from app.core.config import get_settings


def ping() -> bool:
    """Esegue una query minima per verificare che il database sia raggiungibile."""
    settings = get_settings()
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return True
    except psycopg.Error:
        return False


def apri_connessione() -> psycopg.Connection[Any]:
    """Connessione diretta a Postgres, con l'identità del ruolo della
    stringa di connessione (non quella di un Utente: qui non passa alcun
    dato di proprietà di un Utente, docs/adr/0016).

    Chi la apre la chiude. `autocommit=True` perché le transazioni le
    apre esplicitamente chi ne ha bisogno, con `connection.transaction()`:
    la coda dei lavori vuole che ogni istruzione di presa in carico sia
    visibile subito agli altri worker, non trattenuta in una transazione
    implicita aperta a tempo indeterminato dal ciclo.
    """
    settings = get_settings()
    return psycopg.connect(settings.database_url, autocommit=True)
