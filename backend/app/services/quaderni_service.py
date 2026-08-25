"""Orchestrazione di `/scritti`: il corpus dei Quaderni e le sue lenti
(design-frontend.md §22).

**Il consenso qui non è un cancello, è un interruttore su una parte.**
Ogni altra funzione personale chiama `esigi_consenso` e si ferma se è
spento (`app/services/consenso.py`). Qui no, e la differenza è di
prodotto, non di comodità: ciò che l'Utente ha scritto è materia sua e
continua a esistere a consenso revocato — è solo il modo di
INTERROGARLA che si spegne (design-frontend.md §5). Sfogliare, filtrare
e ripescare un vecchio pensiero non toccano il fornitore e non leggono
un solo vettore, quindi restano accesi.

Le due cose che si spengono sono dichiarate nella risposta invece che
tolte in silenzio:

    indici_spenti      il consenso è revocato: niente conteggio dei
                       vicini, e la pagina lo dice al posto del campo
    indici_incompleti  ricostruzione in corso: i conteggi sono parziali

`vicini_a` invece esige il consenso come le altre quattro, e per una
ragione che vale la pena non confondere con il costo: non costa nulla —
l'embedding è già in tabella — ma la revoca cancella gli indici (regola
30), quindi non resta niente da confrontare.
"""

from datetime import date
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.core.tempo import oggi_europa_centrale
from app.repositories import scritto_repository
from app.services import consenso as consenso_service

LIMITE_PAGINA = 30
LIMITE_VICINI = 5

GIORNI_MINIMI_CHE_TORNA = 60
"""Sotto i due mesi un pensiero non "torna": lo si ricorda. La funzione
SQL ripiega su tutto il corpus quando nessuno scritto è abbastanza
vecchio — una libreria giovane merita comunque il suo slot."""


def _scritto(riga: dict[str, Any], *, con_vicini: bool) -> dict[str, Any]:
    """La forma che l'interfaccia consuma, uguale per tutte e tre le
    lenti: se le carte devono essere la stessa carta, la riga che le
    riempie dev'essere la stessa riga."""
    return {
        "tipo_contenuto": riga["tipo_contenuto"],
        "contenuto_id": riga["contenuto_id"],
        "testo": riga["testo"],
        "spoiler": bool(riga.get("spoiler")),
        "visibilita": riga.get("visibilita") or "condiviso",
        "data": riga["data"],
        "voce_id": riga["voce_id"],
        "libro_id": riga["libro_id"],
        "titolo": riga["titolo_canonico"],
        "autori": riga.get("autori") or [],
        "copertina_colore_dominante": riga.get("copertina_colore_dominante"),
        # `None` e non 0 a indici spenti: uno 0 affermerebbe che questo
        # pensiero non ha compagnia, cosa che in quel momento nessuno sa.
        "vicini": int(riga.get("vicini") or 0) if con_vicini else None,
    }


async def elenco(
    access_token: str,
    utente_id: UUID,
    *,
    tipo: str | None = None,
    solo_spoiler: bool = False,
    anno: int | None = None,
    voce_ids: list[UUID] | None = None,
    contenuto_ids: list[UUID] | None = None,
    limite: int = LIMITE_PAGINA,
    scarto: int = 0,
) -> dict[str, Any]:
    consenso, indici_stato = await consenso_service.stato(access_token, utente_id)
    con_vicini = consenso and indici_stato != consenso_service.INDICI_SPENTI

    client = get_user_client(access_token)
    righe = await run_in_threadpool(
        scritto_repository.elenco,
        client,
        tipo=tipo,
        solo_spoiler=solo_spoiler,
        anno=anno,
        voce_ids=voce_ids,
        contenuto_ids=contenuto_ids,
        con_vicini=con_vicini,
        limite=limite,
        scarto=scarto,
    )

    # I due conteggi valgono per l'intera selezione e la funzione SQL li
    # ripete su ogni riga; a pagina vuota valgono zero per definizione.
    totale = int(righe[0]["totale"]) if righe else 0
    libri_distinti = int(righe[0]["libri_distinti"]) if righe else 0

    return {
        "scritti": [_scritto(r, con_vicini=con_vicini) for r in righe],
        "totale": totale,
        "libri_distinti": libri_distinti,
        "indici_spenti": not consenso,
        "indici_incompleti": indici_stato == consenso_service.INDICI_IN_RICOSTRUZIONE,
    }


async def sfaccettature(access_token: str) -> dict[str, Any]:
    """Gli anni e i libri per cui esiste almeno uno scritto.

    L'ordine si decide qui e non in SQL perché i due gruppi lo vogliono
    diverso: gli anni dal più recente, come ogni elenco dell'app; i libri
    da quello su cui si è scritto di più, che è l'unico ordine utile in
    un menù che può avere decine di voci.
    """
    client = get_user_client(access_token)
    righe = await run_in_threadpool(scritto_repository.sfaccettature, client)

    anni = [r for r in righe if r["tipo"] == "anno"]
    libri = [r for r in righe if r["tipo"] == "libro"]
    anni.sort(key=lambda r: r["chiave"], reverse=True)
    libri.sort(key=lambda r: (-int(r["n"]), r["etichetta"]))

    return {"anni": anni, "libri": libri}


async def pensiero_che_torna(access_token: str, utente_id: UUID, scarto: int = 0) -> dict[str, Any]:
    """Un proprio scritto vecchio, uno al giorno.

    Non chiama `esigi_consenso` di proposito: è una riga già scritta,
    ripescata dal database, e nessun testo esce verso il fornitore. È
    anche la ragione per cui lo slot resta in cima alla pagina quando
    tutto il resto delle funzioni assistite è spento.
    """
    client = get_user_client(access_token)
    riga = await run_in_threadpool(scritto_repository.pensiero_che_torna, client, scarto)
    if riga is None:
        return {"scritto": None, "giorni_fa": None}

    # Sul fuso di Europa centrale come ogni altra data dell'app (PRD,
    # "Metrica di lettura"): il browser di chi guarda può stare altrove e
    # darebbe un "due anni fa" diverso dal resto delle pagine.
    scritta_il = riga["data"]
    if isinstance(scritta_il, str):
        scritta_il = date.fromisoformat(scritta_il)
    giorni_fa = (oggi_europa_centrale() - scritta_il).days

    return {
        "scritto": _scritto(riga, con_vicini=False),
        "giorni_fa": max(giorni_fa, 0),
    }


async def vicini(
    access_token: str, utente_id: UUID, contenuto_id: UUID, limite: int = LIMITE_VICINI
) -> dict[str, Any]:
    """I propri scritti vicini a uno dato.

    `esigi_consenso` come le altre funzioni personali, ma non per il
    costo: questa è l'unica che non chiama il fornitore. La revoca
    cancella gli indici, e senza vettori non c'è confronto possibile.
    """
    indici_stato = await consenso_service.esigi_consenso(access_token, utente_id)

    client = get_user_client(access_token)
    righe = await run_in_threadpool(scritto_repository.vicini, client, contenuto_id, limite)

    return {
        "vicini": [_scritto(r, con_vicini=False) for r in righe],
        "indici_incompleti": indici_stato == consenso_service.INDICI_IN_RICOSTRUZIONE,
    }
