"""Ricerca e aggiunta di un libro dai cataloghi.

Due percorsi con costi molto diversi, ed è la ragione per cui sono due
endpoint e non uno:

- la ricerca locale è una query, dieci millisecondi, nessuna rete;
- la ricerca esterna è una chiamata a Google, qualche centinaio di
  millisecondi, e consuma quota.

Il design (§13) chiede che le schede già nel sistema compaiano "per prime
perché non richiedono una chiamata esterna" — prime nel TEMPO, non solo
nell'ordine. Un endpoint solo sarebbe lento quanto la sua fonte più lenta
e butterebbe via quel vantaggio.

La risoluzione dell'identità dell'opera non avviene mai qui: costa
chiamate esterne e sta tutta dietro l'aggiunta, mai dietro la digitazione.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import google_books
from app.core import storage
from app.core.supabase import get_user_client
from app.repositories import (
    catalogo_repository,
    database,
    popolari_repository,
    ricerca_repository,
    voce_repository,
)
from app.services import risoluzione

logger = logging.getLogger("app.ricerca")


class VolumeInesistenteError(Exception):
    """L'identificativo di volume non è più tra i risultati del catalogo.

    Ora significa una cosa sola: Google non conosce più quel volume (404).
    Prima significava anche "la cache di questo processo non ce l'ha più",
    che è una circostanza nostra e non dell'Utente — e con più Utenti o più
    processi capitava su risultati validi. Da quando
    `google_books.opera_per_identificativi` rifà la fetch su cache mancata,
    un risultato valido resta aggiungibile comunque, e questo errore torna
    a dire quello che dice.
    """


async def cerca_locale(
    access_token: str, termine: str, lingua: str = "it", limite: int = 20
) -> list[dict[str, Any]]:
    """Le schede già nel sistema, con la Voce di chi cerca."""
    client = get_user_client(access_token)
    righe = await run_in_threadpool(ricerca_repository.cerca, client, termine, lingua, limite)
    return [_riga_locale(r) for r in righe]


def _riga_locale(riga: dict[str, Any]) -> dict[str, Any]:
    percorso = riga.get("copertina_miniatura_path")
    firmati = storage.firma_in_blocco([percorso]) if percorso else {}
    return {
        "libro_id": riga["libro_id"],
        "titolo": riga["titolo"],
        "autori": riga.get("autori") or [],
        "anno_prima_pubblicazione": riga.get("anno_prima_pubblicazione"),
        "copertina_url": firmati.get(percorso) if percorso else None,
        "copertina_colore_dominante": riga.get("copertina_colore_dominante"),
        "copertina_colore_dominante_scuro": riga.get("copertina_colore_dominante_scuro"),
        "copertina_stato": riga.get("copertina_stato") or "assente",
        "voce": _voce(riga),
    }


def _voce(riga: dict[str, Any]) -> dict[str, Any] | None:
    if not riga.get("voce_id"):
        return None
    return {
        "id": riga["voce_id"],
        "stato": riga["voce_stato"],
        "voto": riga.get("voce_voto"),
        "pagina_corrente": riga.get("voce_pagina_corrente"),
        "anno_ultima_lettura": riga.get("voce_anno_ultima_lettura"),
    }


async def popolari(access_token: str, lingua: str = "it", limite: int = 12) -> list[dict[str, Any]]:
    """«I titoli che tornano» (§13): i titoli più amati dell'istanza, mai
    uno che chi chiama ha già. Una sola query aggregata, nessuna Voce da
    portare — a differenza di `cerca_locale` non c'è nulla da rattoppare
    dopo un'aggiunta, perché da questa lista non si aggiunge: si va alla
    scheda."""
    client = get_user_client(access_token)
    righe = await run_in_threadpool(popolari_repository.elenco, client, limite, lingua)
    return [_riga_popolare(r) for r in righe]


def _riga_popolare(riga: dict[str, Any]) -> dict[str, Any]:
    percorso = riga.get("copertina_miniatura_path")
    firmati = storage.firma_in_blocco([percorso]) if percorso else {}
    return {
        "libro_id": riga["libro_id"],
        "titolo": riga["titolo"],
        "autori": riga.get("autori") or [],
        "anno_prima_pubblicazione": riga.get("anno_prima_pubblicazione"),
        "copertina_url": firmati.get(percorso) if percorso else None,
        "copertina_colore_dominante": riga.get("copertina_colore_dominante"),
        "copertina_colore_dominante_scuro": riga.get("copertina_colore_dominante_scuro"),
        "copertina_stato": riga.get("copertina_stato") or "assente",
        "pagine_mediane_catalogo": riga.get("pagine_mediane_catalogo"),
    }


async def cerca_esterna(
    access_token: str, utente_id: UUID, termine: str, limite: int = 20
) -> list[dict[str, Any]]:
    """Le opere trovate sui cataloghi esterni, collassate per opera.

    Una riga per opera e non per edizione: mostrare gli otto volumi che
    Google restituisce per "1984" significherebbe chiedere all'Utente di
    scegliere l'edizione, che il PRD vieta.

    Ogni riga porta il `libro_id` se i suoi identificativi sono già nel
    catalogo locale, così la schermata può mostrare il verbo giusto senza
    aspettare l'aggiunta. È una lettura sola, sulla chiave primaria di
    `libro_riferimento_esterno`.
    """
    volumi = await google_books.cerca(termine, massimo=min(limite * 2, 40))
    opere = google_books.collassa_per_opera(volumi)[:limite]
    if not opere:
        return []

    noti = await run_in_threadpool(_libri_noti, opere)
    voci = await run_in_threadpool(_voci_per_libri, access_token, utente_id, list(noti.values()))

    risultati = []
    for opera in opere:
        v = opera.rappresentante
        libro_id = noti.get(v.volume_id)
        risultati.append(
            {
                "volume_id": v.volume_id,
                "volumi_alternativi": [a.volume_id for a in opera.alternativi],
                "titolo": v.titolo,
                "autori": list(v.autori),
                "anno_pubblicazione": v.anno_pubblicazione,
                "copertina_url": v.copertina_url,
                "libro_id": libro_id,
                "voce": voci.get(libro_id) if libro_id else None,
            }
        )
    return risultati


def _libri_noti(opere: list[google_books.Opera]) -> dict[str, UUID]:
    """Per ogni opera trovata, il `libro_id` se già la conosciamo.

    Si interroga con tutti gli identificativi del gruppo — quelli di
    volume e tutti gli ISBN — perché basta che uno solo sia già noto
    perché la scheda lo sia.
    """
    noti: dict[str, UUID] = {}
    with database.apri_connessione() as connessione:
        for opera in opere:
            riferimenti: list[tuple[str, str]] = [
                ("google_books", opera.rappresentante.volume_id),
                *[("google_books", a.volume_id) for a in opera.alternativi],
                *[("isbn13", i) for i in opera.isbn_disponibili],
            ]
            libro_id = catalogo_repository.libro_per_riferimenti(connessione, riferimenti)
            if libro_id is not None:
                noti[opera.rappresentante.volume_id] = libro_id
    return noti


def _voci_per_libri(
    access_token: str, utente_id: UUID, libri: list[UUID]
) -> dict[UUID, dict[str, Any]]:
    """La propria Voce per ciascuno dei libri già noti.

    Passa da `get_by_libro`, che filtra esplicitamente su utente_id e non
    si affida alla sola RLS: da quando un collegato attivo può leggere le
    stesse righe, senza quel filtro qui comparirebbe la sua Voce al posto
    della propria — e la riga di ricerca direbbe "Letto nel 2023" per una
    lettura che non è la tua.
    """
    if not libri:
        return {}
    client = get_user_client(access_token)
    voci: dict[UUID, dict[str, Any]] = {}
    for libro_id in dict.fromkeys(libri):
        riga = voce_per_libro(client, utente_id, libro_id)
        if riga is not None:
            voci[libro_id] = riga
    return voci


def voce_per_libro(client: Any, utente_id: UUID, libro_id: UUID) -> dict[str, Any] | None:
    """La propria Voce su un libro, nella forma che regge il verbo della
    riga di ricerca e della scheda pubblica (`VoceDelRisultato`).

    Pubblica e non più solo interna a `_voci_per_libri` perché la scheda di
    un libro non ancora in libreria (§13) ha bisogno esattamente della
    stessa riga, con lo stesso filtro esplicito su `utente_id`: un secondo
    modo di leggere la propria Voce sarebbe un secondo posto in cui
    dimenticarlo.
    """
    riga = voce_repository.get_by_libro(client, libro_id, utente_id)
    if riga is None:
        return None
    return {
        "id": riga["id"],
        "stato": riga["stato"],
        "voto": riga.get("voto"),
        "pagina_corrente": None,
        "anno_ultima_lettura": None,
    }


async def assicura_scheda(opera: google_books.Opera) -> UUID:
    """Dall'opera di Google alla scheda in catalogo, creandola se manca.

    Estratta da `aggiungi_da_catalogo` quando è nata la semina del
    catalogo (`app/lavori/semina.py`): sono due punti d'ingresso — un
    Utente che aggiunge, un lavoro che semina — e una sola catena, che
    deve restare una sola. Duplicarla significherebbe due modi di far
    nascere una scheda che divergono alla prima correzione, cioè due
    identità dove ADR 0002 ne vuole una.

    Non crea alcuna Voce: il catalogo è dato condiviso, la Voce è di un
    Utente (ADR 0001). Chi vuole entrambe le cose chiama questa e poi
    `voci_service.aggiungi_libro`.
    """
    # Passo 1 della catena, PRIMA di qualunque chiamata esterna. Gli
    # identificativi che abbiamo già in mano — quelli di volume e tutti
    # gli ISBN del gruppo — bastano a riconoscere una scheda esistente, e
    # a regime è il caso più frequente: il secondo Utente che aggiunge un
    # libro che qualcuno ha già aggiunto. Risolvere l'identità prima di
    # controllare significherebbe pagare la catena esterna (misurata:
    # oltre dieci secondi) per scoprire di sapere già la risposta.
    noti: list[tuple[str, str]] = [
        ("google_books", opera.rappresentante.volume_id),
        *[("google_books", a.volume_id) for a in opera.alternativi],
        *[("isbn13", i) for i in opera.isbn_disponibili],
    ]
    libro_id = await run_in_threadpool(_libro_per_riferimenti, noti)

    if libro_id is None:
        scheda = await risoluzione.risolvi(opera)
        libro_id = await run_in_threadpool(_trova_o_crea, scheda)
    return libro_id


async def aggiungi_da_catalogo(
    access_token: str, utente_id: UUID, volume_id: str, alternativi: list[str]
) -> tuple[UUID, dict[str, Any], bool]:
    """Dalla riga di un risultato esterno alla Voce in libreria.

    Tre passaggi, in quest'ordine e per questa ragione:

    1. si risolve l'identità dell'opera (chiamate esterne, il costo vero);
    2. si cerca se una scheda con quegli identificativi esiste già — e a
       questo punto se ne conoscono di più che al momento della ricerca,
       perché la risoluzione ne ha aggiunti;
    3. la Voce si crea con l'identità dell'UTENTE, non con la chiave di
       servizio (ADR 0001): il catalogo è dato condiviso, la Voce no.
    """
    opera = await google_books.opera_per_identificativi(volume_id, alternativi)
    if opera is None:
        raise VolumeInesistenteError(volume_id)

    libro_id = await assicura_scheda(opera)

    from app.services import voci_service

    voce, gia_esisteva = await voci_service.aggiungi_libro(access_token, utente_id, libro_id)
    return libro_id, voce, gia_esisteva


def _libro_per_riferimenti(riferimenti: list[tuple[str, str]]) -> UUID | None:
    with database.apri_connessione() as connessione:
        return catalogo_repository.libro_per_riferimenti(connessione, riferimenti)


def _trova_o_crea(scheda: risoluzione.SchedaRisolta) -> UUID:
    """Seconda ricerca, con gli identificativi che la risoluzione ha
    aggiunto: il volume di partenza poteva essere sconosciuto mentre
    l'opera a cui appartiene era già una scheda."""
    riferimenti = [(f, i) for f, i, _ in scheda.riferimenti]
    with database.apri_connessione() as connessione:
        esistente = catalogo_repository.libro_per_riferimenti(connessione, riferimenti)
        if esistente is not None:
            # La scheda c'era, ma con identificativi diversi da quelli con
            # cui l'Utente ci è arrivato: registrandoli, la prossima
            # aggiunta della stessa edizione salta l'intera catena esterna.
            nuovi = catalogo_repository.aggiungi_riferimenti(
                connessione, esistente, scheda.riferimenti
            )
            if nuovi:
                logger.info(
                    "Scheda %s riconosciuta: %d identificativi nuovi registrati.",
                    esistente,
                    nuovi,
                )
            return esistente

        libro_id = catalogo_repository.crea_scheda(
            connessione,
            titolo_canonico=scheda.titolo_canonico,
            autori=scheda.autori,
            anno_prima_pubblicazione=scheda.anno_prima_pubblicazione,
            lingua_originale=scheda.lingua_originale,
            pagine_mediane=scheda.pagine_mediane,
            generi=scheda.generi,
            soggetti=scheda.soggetti,
            riferimenti=scheda.riferimenti,
            varianti_titolo=scheda.varianti_titolo,
            descrizioni=scheda.descrizioni,
            copertina_volume_id=scheda.copertina_volume_id,
            copertina_isbn13=scheda.copertina_isbn13,
            titoli_wikipedia=scheda.titoli_wikipedia,
        )
        return libro_id
