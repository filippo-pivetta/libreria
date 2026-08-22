"""Orchestrazione delle metriche di lettura (issue #7): aggregato su
anno solare per singolo Utente — libri finiti, pagine lette, autori più
letti, generi principali (PRD, entità "Metrica di lettura"). Non è un
dato conservato (ADR 0004): si ricalcola da `lettura`/`avanzamento`/
`libro` a ogni richiesta, mai da una fotografia — nessuna tabella nuova.

Serve sia le proprie metriche (`GET /metriche`) sia quelle di un
collegato (`GET /utenti/{id}/metriche`, `app/services/utenti_service.py`):
`utente_id` è sempre quello di chi possiede i dati, mai quello di chi
chiama — è ciò che rende vera la regola 17 del PRD ("le metriche di un
Utente sono calcolate solo sui suoi dati") anche quando le richiede un
collegato.
"""

from collections import defaultdict
from datetime import date
from typing import Any, cast
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.core.tempo import oggi_europa_centrale
from app.repositories import metriche_repository

_LINGUA_INTERFACCIA = "it"
"""Stessa scelta di app/repositories/voce_repository.py: l'interfaccia
bilingue è debito noto (AGENTS.md), i generi si mostrano sempre in
italiano finché non è costruita."""


class AnnoFuturoError(Exception):
    """`anno` è oltre l'anno corrente in Europa centrale (PRD, comportamento
    #12: "gli anni futuri non sono selezionabili")."""


def _anno(data_iso: str) -> int:
    return date.fromisoformat(data_iso).year


def _etichetta_genere(genere: dict[str, Any]) -> str | None:
    """L'etichetta nella lingua dell'interfaccia se c'è. `genere_etichetta`
    copre ogni id dell'elenco chiuso in italiano (migrazione
    20260821120000, stessa garanzia assunta da `voce_repository.
    _appiattisci_generi`): il ripiego sulla prima etichetta disponibile
    serve solo a non far sparire un genere davvero assegnato — e a non
    farlo contare per errore nello scarto "senza genere" — se quella
    garanzia venisse mai meno; non è il percorso atteso."""
    etichette: list[dict[str, Any]] = genere.get("genere_etichetta", [])
    for etichetta in etichette:
        if etichetta.get("lingua") == _LINGUA_INTERFACCIA:
            return cast(str, etichetta["etichetta"])
    return cast(str, etichette[0]["etichetta"]) if etichette else None


def _calcola_incrementi(avanzamenti: list[dict[str, Any]]) -> list[tuple[str, int]]:
    """L'incremento di un Avanzamento è la differenza con la pagina
    dell'Avanzamento precedente della stessa Lettura, o con zero se è il
    primo (PRD, entità Avanzamento) — mai la pagina raggiunta in sé.
    Richiede `avanzamenti` ordinati per (lettura_id, data, creato_at),
    l'ordine già prodotto da `metriche_repository.list_avanzamenti`: un
    solo passaggio lineare basta, senza raggruppare esplicitamente per
    Lettura. La pagina non decresce mai all'interno di una Lettura
    (`trg_avanzamento_valida`), quindi ogni incremento è >= 0 per
    costruzione."""
    ultima_pagina: dict[str, int] = {}
    incrementi: list[tuple[str, int]] = []
    for avanzamento in avanzamenti:
        lettura_id = avanzamento["lettura_id"]
        precedente = ultima_pagina.get(lettura_id, 0)
        pagina = avanzamento["pagina"]
        incrementi.append((avanzamento["data"], pagina - precedente))
        ultima_pagina[lettura_id] = pagina
    return incrementi


def _anno_minimo(
    letture: list[dict[str, Any]], avanzamenti: list[dict[str, Any]], anno_corrente: int
) -> int:
    """Il primo anno con dati (PRD, comportamento #12): il primo tra le
    Letture chiuse per conclusione e gli Avanzamenti registrati. Nessun
    dato -> l'unico anno selezionabile resta quello corrente, con zeri
    ovunque."""
    anni = [
        _anno(lettura["data_fine"])
        for lettura in letture
        if lettura["esito"] == "conclusa" and lettura["data_fine"]
    ]
    anni += [_anno(avanzamento["data"]) for avanzamento in avanzamenti]
    return min(anni) if anni else anno_corrente


def _classifica(pesi: dict[str, float], nomi: dict[str, str]) -> list[dict[str, Any]]:
    """Elenco completo ordinato per peso decrescente (poi per nome, a
    parità): design-frontend.md §14 mostra solo le prime cinque con
    "mostra tutte" — il troncamento è responsabilità del frontend, qui
    non si taglia nulla."""
    return [
        {"id": chiave, "nome": nomi[chiave], "peso": round(peso, 3)}
        for chiave, peso in sorted(pesi.items(), key=lambda kv: (-kv[1], nomi[kv[0]]))
    ]


async def metriche_di(access_token: str, utente_id: UUID, anno: int | None) -> dict[str, Any]:
    # Controllato prima di qualunque lettura: un anno futuro è sempre
    # rifiutato, quindi non vale la pena spendere due andata-e-ritorno
    # verso Supabase per una richiesta che finirà comunque in errore.
    anno_corrente = oggi_europa_centrale().year
    anno_richiesto = anno if anno is not None else anno_corrente
    if anno_richiesto > anno_corrente:
        raise AnnoFuturoError

    client = get_user_client(access_token)

    letture = await run_in_threadpool(metriche_repository.list_letture, client, utente_id)
    avanzamenti = await run_in_threadpool(metriche_repository.list_avanzamenti, client, utente_id)

    # Un abbandono non incrementa mai il conteggio dei libri finiti (PRD
    # regola 13): solo esito 'conclusa' entra qui. Le sue pagine restano
    # comunque contate più sotto, indipendentemente dall'esito.
    concluse_anno = [
        lettura
        for lettura in letture
        if lettura["esito"] == "conclusa"
        and lettura["data_fine"]
        and _anno(lettura["data_fine"]) == anno_richiesto
    ]

    voci = await run_in_threadpool(
        metriche_repository.list_voci_con_libro,
        client,
        {UUID(lettura["voce_id"]) for lettura in concluse_anno},
    )

    libri_finiti = len(concluse_anno)
    # Distinti per voce_id, non per libro_id via il join sotto: una Voce
    # è unica per (utente, libro) — uq_voce_di_libreria_utente_libro —
    # quindi due Letture sulla stessa Voce sono per costruzione la
    # stessa rilettura, e due Voci diverse sono per costruzione due
    # libri diversi. Non dipende da `voci` (che può non risolvere ogni
    # riga in un caso limite di paginazione lato Supabase): il conteggio
    # delle riletture resta corretto anche se quella mappa fosse
    # incompleta.
    voce_id_distinti = {lettura["voce_id"] for lettura in concluse_anno}
    riletture = libri_finiti - len(voce_id_distinti)

    pesi_autori: dict[str, float] = defaultdict(float)
    nomi_autori: dict[str, str] = {}
    pesi_generi: dict[str, float] = defaultdict(float)
    nomi_generi: dict[str, str] = {}
    libri_senza_genere = 0
    ha_letture_a_cavallo_anno = False

    for lettura in concluse_anno:
        if _anno(lettura["data_inizio"]) != anno_richiesto:
            ha_letture_a_cavallo_anno = True

        libro = voci.get(lettura["voce_id"])
        if libro is None:
            continue

        # Peso ripartito tra gli autori del libro, così un libro vale
        # sempre uno (PRD regola 18) — stesso principio per i generi
        # sotto, con lo scarto dichiarato separatamente quando assenti.
        autori = [riga["autore"] for riga in libro.get("libro_autore") or [] if riga.get("autore")]
        if autori:
            peso = 1.0 / len(autori)
            for autore in autori:
                pesi_autori[autore["id"]] += peso
                nomi_autori[autore["id"]] = autore["nome_canonico"]

        generi: list[tuple[str, str]] = []
        for riga in libro.get("libro_genere") or []:
            genere = riga.get("genere")
            etichetta = genere and _etichetta_genere(genere)
            if genere and etichetta:
                generi.append((genere["id"], etichetta))
        if generi:
            peso_genere = 1.0 / len(generi)
            for genere_id, etichetta in generi:
                pesi_generi[genere_id] += peso_genere
                nomi_generi[genere_id] = etichetta
        else:
            libri_senza_genere += 1

    incrementi = _calcola_incrementi(avanzamenti)
    pagine_lette = sum(
        incremento for data, incremento in incrementi if _anno(data) == anno_richiesto
    )

    return {
        "anno": anno_richiesto,
        "anno_minimo": _anno_minimo(letture, avanzamenti, anno_corrente),
        "anno_massimo": anno_corrente,
        "libri_finiti": libri_finiti,
        "riletture": riletture,
        "pagine_lette": pagine_lette,
        "autori_piu_letti": _classifica(pesi_autori, nomi_autori),
        "generi_principali": _classifica(pesi_generi, nomi_generi),
        "libri_senza_genere": libri_senza_genere,
        "ha_letture_a_cavallo_anno": ha_letture_a_cavallo_anno,
    }
