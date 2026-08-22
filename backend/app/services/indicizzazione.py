"""L'aggancio fra la scrittura di un contenuto e il suo indice semantico
(issue #6).

Un insight o una recensione appena scritti non sono ancora cercabili per
significato: serve un embedding, che è una chiamata al fornitore e non sta
nel tempo della richiesta di salvataggio. Da qui l'accodamento di un
lavoro in secondo piano — e il fatto che il salvataggio non debba mai
fallire per colpa sua: il contenuto è dell'Utente, l'indice è un derivato.

Il consenso si controlla qui **e** dentro il gestore. Non è ridondanza
inutile: qui evita di accodare lavori che nasceranno morti, là copre la
finestra fra accodamento ed esecuzione, che può durare minuti. È il
secondo controllo quello che vale per la regola 30.

Il cambio di sola visibilità non riaccoda nulla: la regola 24 vuole le
regole di accesso "verificate al momento della lettura perché la
visibilità della sorgente può cambiare", ed è esattamente ciò che fa la
RLS di `indice_semantico` interrogando `insight.visibilita` a ogni
lettura. Reindicizzare a ogni interruttore sarebbe una chiamata pagata per
un dato che non è cambiato.
"""

import logging
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import database, lavoro_repository, utente_repository

logger = logging.getLogger("app.services.indicizzazione")

TIPO_LAVORO = "indicizzazione_semantica"


async def accoda(access_token: str, utente_id: UUID, tipo: str, contenuto_id: UUID) -> None:
    """Accoda l'indicizzazione di un contenuto, se il consenso è acceso.

    Non solleva mai: un indice mancante degrada la ricerca semantica, un
    salvataggio fallito perde un testo scritto a mano — che è il contenuto
    più prezioso del prodotto (docs/adr/0011). L'asimmetria è deliberata.
    """
    try:
        client = get_user_client(access_token)
        riga = await run_in_threadpool(utente_repository.get_utente_privato, client, utente_id)
        if riga is None or not riga["consenso_elaborazione_assistita"]:
            return
        await run_in_threadpool(_accoda, utente_id, tipo, contenuto_id)
    except Exception:
        logger.exception(
            "Accodamento dell'indicizzazione di %s %s non riuscito.", tipo, contenuto_id
        )


def _accoda(utente_id: UUID, tipo: str, contenuto_id: UUID) -> None:
    # Chiave sul contenuto e non sull'utente: `uq_lavoro_pendente` collassa
    # così tre correzioni rapide dello stesso insight in un lavoro solo,
    # lasciando indipendenti insight diversi.
    with database.apri_connessione() as connessione:
        lavoro_repository.accoda(
            connessione,
            TIPO_LAVORO,
            f"{tipo}:{contenuto_id}",
            {"utente_id": str(utente_id), "tipo": tipo, "contenuto_id": str(contenuto_id)},
        )
