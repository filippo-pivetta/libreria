"""Accesso dati grezzo a `lettura`.

Apertura e chiusura vivono nella RPC `cambia_stato_voce`
(`voce_repository.cambia_stato`, docs/adr/0015): qui solo la
cancellazione diretta di una Lettura, qualunque essa sia — aperta o
chiusa (PRD: "l'Utente può... cancellare ogni contenuto proprio...
Letture aperte per errore", generalizzato dal caso limite a qualunque
Lettura). Il ricalcolo di `voce_di_libreria.stato` è responsabilità del
trigger `trg_lettura_ricalcola_stato`, non di questo modulo.
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client


def delete(client: Client, lettura_id: UUID) -> bool:
    """True se una riga è stata cancellata. False se non trovata o non
    di proprietà (RLS la rende indistinguibile, coerente con "rifiuto
    indistinguibile da un contenuto inesistente", PRD casi limite)."""
    response = client.table("lettura").delete().eq("id", str(lettura_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0
