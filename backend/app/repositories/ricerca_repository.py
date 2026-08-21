"""Ricerca sulle schede già nel sistema.

Passa dal client dell'utente e non dalla connessione diretta, a differenza
delle scritture di catalogo: qui si legge anche la Voce di chi cerca, che
è dato di proprietà, e la RLS deve restare l'unico punto in cui vive la
regola "chi vede cosa" (ADR 0001). La funzione `cerca_libri` è dichiarata
`security invoker` proprio perché questo resti vero.
"""

from typing import Any, cast

from supabase import Client


def cerca(
    client: Client, termine: str, lingua: str = "it", limite: int = 20
) -> list[dict[str, Any]]:
    """Le schede già nel sistema che corrispondono al termine, ciascuna con
    la Voce di chi cerca quando esiste."""
    risposta = client.rpc(
        "cerca_libri", {"p_termine": termine, "p_lingua": lingua, "p_limite": limite}
    ).execute()
    return cast("list[dict[str, Any]]", risposta.data or [])
