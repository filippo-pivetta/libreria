"""Lettura di `libri_popolari` (§13 del design, «I titoli che tornano»).

Una funzione sola, chiamata via PostgREST col client dell'utente: la RLS
non conta qui — la funzione è `security definer` apposta, perché deve
aggregare le voci di libreria di ogni utente — ma la RPC resta autenticata
comunque, così `auth.uid()` dentro la funzione risolve chi sta guardando e
può escludere i libri che ha già.
"""

from typing import Any, cast

from supabase import Client


def elenco(client: Client, limite: int, lingua: str = "it") -> list[dict[str, Any]]:
    """I titoli più amati dell'istanza, esclusi quelli già nella propria
    libreria e con al più un titolo per autore principale."""
    risposta = client.rpc("libri_popolari", {"p_limite": limite, "p_lingua": lingua}).execute()
    return cast("list[dict[str, Any]]", risposta.data or [])
