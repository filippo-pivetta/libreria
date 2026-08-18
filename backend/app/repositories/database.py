"""Accesso diretto a Postgres, al di fuori del client Supabase.

Usato oggi solo per verificare la raggiungibilità del database dall'health
check; non contiene query di dominio.
"""

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
