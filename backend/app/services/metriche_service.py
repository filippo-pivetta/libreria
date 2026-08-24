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
from math import ceil
from typing import Any, cast
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.core.tempo import oggi_europa_centrale
from app.repositories import metriche_repository


class AnnoFuturoError(Exception):
    """`anno` è oltre l'anno corrente in Europa centrale (PRD, comportamento
    #12: "gli anni futuri non sono selezionabili")."""


def _anno(data_iso: str) -> int:
    return date.fromisoformat(data_iso).year


def _etichetta_genere(genere: dict[str, Any], lingua: str) -> str | None:
    """L'etichetta nella lingua dell'interfaccia (issue #34) se c'è.
    `genere_etichetta` copre ogni id dell'elenco chiuso in entrambe le
    lingue (migrazione 20260821120000, stessa garanzia assunta da
    `voce_repository._appiattisci_generi`): il ripiego sulla prima
    etichetta disponibile serve solo a non far sparire un genere davvero
    assegnato — e a non farlo contare per errore nello scarto "senza
    genere" — se quella garanzia venisse mai meno; non è il percorso
    atteso."""
    etichette: list[dict[str, Any]] = genere.get("genere_etichetta", [])
    for etichetta in etichette:
        if etichetta.get("lingua") == lingua:
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


def _titolo(libro: dict[str, Any], lingua: str) -> str:
    """Variante nella lingua dell'interfaccia (issue #34), altrimenti il
    titolo canonico (PRD, entità "Variante di titolo"). Stessa forma già
    usata da `export_service` e `scheda_repository`: ripetuta e non
    importata perché quei due la applicano a una `select` diversa, e
    condividerla legherebbe fra loro tre query che non hanno ragione di
    cambiare insieme."""
    varianti = libro.get("variante_titolo") or []
    variante = next((v["titolo"] for v in varianti if v.get("lingua") == lingua), None)
    return str(variante or libro["titolo_canonico"])


def _durata_giorni(lettura: dict[str, Any]) -> int:
    """Estremi inclusi: una Lettura cominciata e conclusa lo stesso
    giorno dura un giorno, non zero. `data_fine` non è mai anteriore a
    `data_inizio` (`trg_lettura_valida`), quindi il risultato è sempre
    >= 1."""
    inizio = date.fromisoformat(lettura["data_inizio"])
    fine = date.fromisoformat(lettura["data_fine"])
    return (fine - inizio).days + 1


def _giorni_trascorsi(anno_richiesto: int, oggi: date) -> int:
    """L'anno intero se è già passato, il giorno dell'anno se è quello in
    corso. È il denominatore di `giorni_con_lettura`: senza, "118 giorni"
    non si può leggere."""
    if anno_richiesto < oggi.year:
        return (date(anno_richiesto, 12, 31) - date(anno_richiesto, 1, 1)).days + 1
    return oggi.timetuple().tm_yday


def _classifica(pesi: dict[str, float], nomi: dict[str, str]) -> list[dict[str, Any]]:
    """Elenco completo ordinato per peso decrescente (poi per nome, a
    parità): design-frontend.md §14 mostra solo le prime cinque con
    "mostra tutte" — il troncamento è responsabilità del frontend, qui
    non si taglia nulla."""
    return [
        {"id": chiave, "nome": nomi[chiave], "peso": round(peso, 3)}
        for chiave, peso in sorted(pesi.items(), key=lambda kv: (-kv[1], nomi[kv[0]]))
    ]


async def metriche_di(
    access_token: str, utente_id: UUID, anno: int | None, lingua: str
) -> dict[str, Any]:
    # Controllato prima di qualunque lettura: un anno futuro è sempre
    # rifiutato, quindi non vale la pena spendere due andata-e-ritorno
    # verso Supabase per una richiesta che finirà comunque in errore.
    oggi = oggi_europa_centrale()
    anno_corrente = oggi.year
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

    voci_gia_pesate: set[str] = set()
    pesi_autori: dict[str, float] = defaultdict(float)
    nomi_autori: dict[str, str] = {}
    pesi_generi: dict[str, float] = defaultdict(float)
    nomi_generi: dict[str, str] = {}
    libri_senza_genere = 0
    letture_a_cavallo_anno = 0
    libri_senza_pagine = 0
    voti: list[float] = []
    voti_per_stella = [0, 0, 0, 0, 0]

    for lettura in concluse_anno:
        if _anno(lettura["data_inizio"]) != anno_richiesto:
            letture_a_cavallo_anno += 1

        voce = voci.get(lettura["voce_id"])
        if voce is None:
            continue
        libro = voce["libro"]

        # Il voto sta sulla Voce, non sulla Lettura: due riletture della
        # stessa Voce concluse nello stesso anno porterebbero lo stesso
        # voto due volte, gonfiando il campione. Si conta una volta per
        # Voce, non una per Lettura, a differenza di `libri_finiti`.
        if lettura["voce_id"] not in voci_gia_pesate:
            voci_gia_pesate.add(lettura["voce_id"])
            if voce.get("pagine_adottate") is None:
                libri_senza_pagine += 1
            voto = voce.get("voto")
            if voto is not None:
                # numeric(2,1) fra 1,0 e 5,0 a passi di mezza stella
                # (migrazione 20260820205444). Il cast è esplicito perché
                # PostgREST può restituire un numeric come stringa a
                # seconda del driver.
                valore = float(voto)
                voti.append(valore)
                # L'istogramma ha cinque colonne e la scala dieci passi:
                # un 3,5 sta nella colonna delle quattro stelle, cioè si
                # arrotonda per eccesso. Il vincolo di schema garantisce
                # 1,0 <= valore <= 5,0, quindi l'indice sta sempre in 0..4.
                voti_per_stella[ceil(valore) - 1] += 1

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
            etichetta = genere and _etichetta_genere(genere, lingua)
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
    # Un solo passaggio per tre risultati: il totale, i dodici mesi e le
    # date distinte. Sono la stessa somma a tre risoluzioni diverse,
    # quindi `sum(pagine_per_mese) == pagine_lette` per costruzione.
    pagine_per_mese = [0] * 12
    giorni_letti: set[str] = set()
    pagine_lette = 0
    for data_iso, incremento in incrementi:
        if _anno(data_iso) != anno_richiesto:
            continue
        pagine_lette += incremento
        pagine_per_mese[date.fromisoformat(data_iso).month - 1] += incremento
        # Un incremento nullo (una correzione, la stessa pagina segnata
        # due volte) non fa di quel giorno un giorno di lettura.
        if incremento > 0:
            giorni_letti.add(data_iso)

    # Un abbandono chiude la Lettura come una conclusione (`data_fine` +
    # `esito`, cambia_stato_voce): si conta nell'anno di chiusura, come i
    # libri finiti, ed è l'unico posto in cui l'esito 'abbandonata'
    # compare in una metrica.
    abbandoni = sum(
        1
        for lettura in letture
        if lettura["esito"] == "abbandonata"
        and lettura["data_fine"]
        and _anno(lettura["data_fine"]) == anno_richiesto
    )

    durate = [_durata_giorni(lettura) for lettura in concluse_anno]
    lettura_piu_lunga = max(concluse_anno, key=_durata_giorni, default=None)
    voce_piu_lunga = voci.get(lettura_piu_lunga["voce_id"]) if lettura_piu_lunga else None

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
        "ha_letture_a_cavallo_anno": letture_a_cavallo_anno > 0,
        "letture_a_cavallo_anno": letture_a_cavallo_anno,
        "pagine_per_mese": pagine_per_mese,
        "giorni_con_lettura": len(giorni_letti),
        "giorni_trascorsi": _giorni_trascorsi(anno_richiesto, oggi),
        "voto_medio": round(sum(voti) / len(voti), 1) if voti else None,
        "libri_votati": len(voti),
        "voti_per_stella": voti_per_stella,
        "abbandoni": abbandoni,
        "durata_media_giorni": round(sum(durate) / len(durate)) if durate else None,
        "durata_massima_giorni": max(durate) if durate else None,
        "durata_massima_titolo": (
            _titolo(voce_piu_lunga["libro"], lingua) if voce_piu_lunga else None
        ),
        "libri_senza_pagine": libri_senza_pagine,
    }
