"""Orchestrazione di `GET /ricerca/semantica` (issue #6).

Tre cose in fila, in quest'ordine per una ragione ciascuna:

1. Il consenso. Prima di tutto, perché senza non si chiama il fornitore
   nemmeno per l'embedding della domanda (regola 30) e perché la risposta
   dev'essere "questa funzione è spenta", non un elenco vuoto (PRD, caso
   limite).
2. L'embedding della domanda. Esce verso il fornitore solo il testo che
   l'Utente ha appena digitato: nessun contenuto suo, tantomeno di altri.
3. La RPC vettoriale, che confronta quel vettore con i soli vettori suoi.

**Nessun gating spoiler qui**, a differenza di `insight_service`. La
regola 10 del PRD ("un insight contrassegnato spoiler non è mai
restituito in chiaro in elenchi o anteprime") protegge un lettore da uno
spoiler *altrui*: il gating della scheda del libro esiste perché quella
vista serve sia il proprietario sia un collegato che guarda la stessa
Voce. Qui `cerca_semantico` filtra `utente_id = auth.uid()` sia nella RLS
sia esplicitamente nella query (regola 24, commento sulla RPC nella
migrazione): **ogni riga che arriva qui è già del richiedente**, mai di un
collegato. Nasconderla a lui stesso non proteggerebbe nessuno — l'unico
effetto sarebbe impedirgli di trovare ciò che ha scritto lui, il giorno
in cui l'ha marcato spoiler per i suoi collegati.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi.openai_client import chiama_embedding
from app.core import storage
from app.core.supabase import get_user_client
from app.repositories import indice_semantico_repository
from app.services import consenso as consenso_service

LIMITE_RISULTATI = 20


async def cerca(
    access_token: str,
    utente_id: UUID,
    domanda: str,
    *,
    tipo: str | None = None,
    solo_spoiler: bool = False,
    anno: int | None = None,
    voce_ids: list[UUID] | None = None,
    contenuto_ids: list[UUID] | None = None,
) -> dict[str, Any]:
    indici_stato = await consenso_service.esigi_consenso(access_token, utente_id)

    vettori = await chiama_embedding([domanda])

    client = get_user_client(access_token)
    righe = await run_in_threadpool(
        indice_semantico_repository.cerca,
        client,
        vettori[0],
        LIMITE_RISULTATI,
        tipo=tipo,
        solo_spoiler=solo_spoiler,
        anno=anno,
        voce_ids=voce_ids,
        contenuto_ids=contenuto_ids,
        # Il piede della carta dei risultati e quello della carta della
        # vista sfogliata devono essere lo stesso piede: se qui non
        # arrivasse il conteggio dei vicini, la stessa riga cambierebbe
        # aspetto a seconda della lente da cui la si guarda.
        con_vicini=True,
    )

    return {
        "risultati": await run_in_threadpool(_prepara, righe),
        "indici_incompleti": indici_stato == consenso_service.INDICI_IN_RICOSTRUZIONE,
    }


def _prepara(righe: list[dict[str, Any]]) -> list[dict[str, Any]]:
    percorsi = [p for riga in righe if (p := riga.get("copertina_miniatura_path"))]
    firmati = storage.firma_in_blocco(percorsi) if percorsi else {}

    risultati = []
    for riga in righe:
        percorso = riga.get("copertina_miniatura_path")
        risultati.append(
            {
                **riga,
                "titolo": riga["titolo_canonico"],
                "copertina_miniatura_url": firmati.get(percorso) if percorso else None,
            }
        )
    return risultati
