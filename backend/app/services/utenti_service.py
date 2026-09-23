"""Orchestrazione di `/utenti`: elenco membri e libreria di un
collegato (issue #3).
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import collegamento_repository, utente_repository, voce_repository
from app.services import metriche_service, voci_service


class UtenteInesistenteError(Exception):
    """Nessun utente con questo id."""


class NonCollegatoError(Exception):
    """Il chiamante non ha un collegamento attivo con `utente_id`: la
    sua libreria non è raggiungibile (PRD regola 4/7)."""


# Quanti membri senza relazione si mostrano senza aver cercato nulla.
#
# Era venticinque, la dimensione di pagina di un elenco di persone su
# un'istanza aperta a migliaia di iscritti. Il 28 agosto 2026 l'istanza è
# tornata a essere a cerchia ristretta — su invito, decine di persone —
# e con quel numero cade anche la ragione del tetto stretto: venticinque
# righe non erano "un paio di schermate di una lista infinita", erano
# quasi tutti, serviti a fette per prudenza verso uno scenario che non
# c'è.
#
# Duecento è il tetto di ciò che resta ragionevole mandare in una
# risposta sola (duecento righe di id e nome sono una decina di
# chilobyte, compressi meno), non una previsione di quanti saranno. È
# quello che rende vero `elenco_completo` sotto, e con lui la ricerca
# istantanea lato client.
#
# **Deve restare sotto il tetto della funzione SQL** (`cerca_membri`,
# migrazione 20260828100000: 500 righe). Alzarlo oltre quel tetto non dà
# più righe, dà una bugia: il servizio chiede `LIMITE_ELENCO + 1` e legge
# "ne sono tornate meno del tetto" come "ci sono tutti", quindi con un
# tetto SQL più basso della richiesta dichiarerebbe completo un elenco
# troncato, e il frontend smetterebbe di cercare le persone mancanti.
LIMITE_ELENCO = 200

# Sotto le due lettere non si interroga l'anagrafica: una lettera sola
# restituirebbe una fetta arbitraria a ogni battuta, che è enumerazione
# travestita da ricerca. Vale solo quando l'elenco NON è completo: se il
# frontend ha già tutti i nomi, filtra da sé e non chiede niente a
# nessuno, quindi non c'è nulla da enumerare.
MIN_QUERY = 2

# Soglia di somiglianza trigram (pg_trgm). 0.3 è il valore predefinito di
# `pg_trgm.similarity_threshold`, ed è quello giusto qui: il nome utente è
# un identificatore, non una frase. Serve a perdonare una lettera sbagliata
# in "chiiara", non a suggerire persone diverse da quella cercata — per
# questo la corrispondenza esatta, quella per prefisso e quella per
# sottostringa vengono comunque prima nell'ordinamento (funzione SQL
# `cerca_membri`).
SOGLIA_SOMIGLIANZA = 0.3


def _membro(
    utente: dict[str, Any],
    stato_relazione: str,
    richiesta_ricevuta: bool,
    collegamento_id: str | None,
) -> dict[str, Any]:
    return {
        "id": utente["id"],
        "nome_utente": utente["nome_utente"],
        "stato_relazione": stato_relazione,
        "richiesta_ricevuta": richiesta_ricevuta,
        "collegamento_id": collegamento_id,
    }


def _corrisponde(nome_utente: str, query: str | None) -> bool:
    """Filtro per i gruppi che sono già dati di chi guarda: i suoi
    collegati e le sue richieste pendenti.

    Sottostringa e basta, senza la tolleranza agli errori di battitura che
    la funzione SQL applica agli sconosciuti. Non è una svista: la
    somiglianza serve a ritrovare un nome che non si conosce bene, e i
    nomi dei propri collegati si conoscono. Applicarla qui allargherebbe i
    risultati proprio dove servono stretti.
    """
    if not query:
        return True
    return query.casefold() in nome_utente.casefold()


async def elenco_membri(
    access_token: str, self_id: UUID, cerca: str | None = None
) -> dict[str, Any]:
    """Elenco membri in tre gruppi (design-frontend.md §16).

    Due query totali, non N+1: una per i collegamenti di chi guarda — che
    portano già dentro id e nome dell'altro — e una per la fetta degli
    sconosciuti. Nessun conteggio totale dei membri viene calcolato né
    restituito: quanti siano gli iscritti non è un'informazione che
    l'elenco debba dare, nemmeno su un'istanza a invito.

    Oltre ai tre gruppi esce `elenco_completo`: dice se in questa
    risposta ci sono già TUTTI i membri, e quindi se chi la riceve può
    cercare fra i nomi senza tornare al server. Su un'istanza a cerchia
    ristretta è vero praticamente sempre, ed è ciò che toglie una
    richiesta per ogni battuta nel campo di ricerca dei Lettori.

    I due gruppi che nascono da una relazione (`richieste_ricevute`,
    `collegati`) sono SEMPRE completi, senza tetto: una richiesta nascosta
    da un LIMIT non si potrebbe più accettare, e un collegamento nascosto
    renderebbe irraggiungibile una libreria. Il tetto vale solo per
    `altri`, dove è il tetto di una vetrina, non di un archivio.

    Le richieste inviate stanno dentro `altri`, in cima: una richiesta
    inviata non è un altro tipo di persona, è la stessa persona in un altro
    stato, e servirle a parte costringerebbe l'interfaccia a una quarta
    sezione per due righe.
    """
    client = get_user_client(access_token)
    query = (cerca or "").strip() or None

    collegamenti = await run_in_threadpool(collegamento_repository.list_per_utente, client, self_id)

    richieste_ricevute: list[dict[str, Any]] = []
    collegati: list[dict[str, Any]] = []
    richieste_inviate: list[dict[str, Any]] = []

    for riga in collegamenti:
        altro = riga["altro"]
        if not _corrisponde(altro["nome_utente"], query):
            continue
        if riga["stato"] == "attiva":
            collegati.append(_membro(altro, "attiva", False, riga["id"]))
        elif riga["richiesto_da_me"]:
            richieste_inviate.append(_membro(altro, "in_attesa", False, riga["id"]))
        else:
            richieste_ricevute.append(_membro(altro, "in_attesa", True, riga["id"]))

    # Con una ricerca troppo corta non si interroga l'anagrafica: i gruppi
    # sopra restano filtrati (sono roba di chi guarda), questo resta vuoto.
    #
    # Si chiede una riga IN PIÙ del tetto. Se ne tornano meno del tetto,
    # allora non c'era altro da mandare e l'elenco è completo: chi lo
    # riceve ha davanti tutti i membri, e può filtrarli da sé senza
    # tornare al server a ogni battuta. Se ne torna una in più, il tetto
    # ha tagliato: si scarta l'eccedenza e si dichiara incompleto, e la
    # ricerca torna a essere una domanda al server.
    #
    # Un conteggio (`count="exact"`) avrebbe risposto alla stessa domanda
    # e a una in più che non va data: quanti sono gli iscritti. Questa
    # riga in più dice soltanto "ce n'erano altri", che è tutto ciò che
    # serve per decidere dove cercare.
    sconosciuti: list[dict[str, Any]] = []
    elenco_completo = False
    if query is None or len(query) >= MIN_QUERY:
        righe = await run_in_threadpool(
            utente_repository.cerca_membri,
            client,
            self_id,
            query,
            LIMITE_ELENCO + 1,
            SOGLIA_SOMIGLIANZA,
        )
        elenco_completo = len(righe) <= LIMITE_ELENCO
        sconosciuti = [_membro(riga, "assente", False, None) for riga in righe[:LIMITE_ELENCO]]

    collegati.sort(key=lambda m: m["nome_utente"].casefold())
    richieste_ricevute.sort(key=lambda m: m["nome_utente"].casefold())
    richieste_inviate.sort(key=lambda m: m["nome_utente"].casefold())

    return {
        "richieste_ricevute": richieste_ricevute,
        "collegati": collegati,
        "altri": richieste_inviate + sconosciuti,
        # Vero solo se questa risposta contiene già ogni membro che chi
        # guarda potrebbe cercare, ricerca vuota compresa. Con una ricerca
        # attiva non lo è per definizione: si sta guardando un
        # sottoinsieme, e il frontend non deve dedurne di avere tutto.
        "elenco_completo": elenco_completo and query is None,
    }


async def libreria_di(
    access_token: str, self_id: UUID, utente_id: UUID, lingua: str
) -> dict[str, Any]:
    """Distingue esplicitamente "non collegato" (403) da "libreria
    vuota" (200, lista vuota) — design-frontend.md §15: "quella libreria
    non è più accessibile" non è un errore generico."""
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        raise UtenteInesistenteError

    collegato = await run_in_threadpool(
        collegamento_repository.is_collegato_attivo, client, utente_id
    )
    if not collegato:
        raise NonCollegatoError

    voci = await run_in_threadpool(voce_repository.list_con_libro, client, utente_id, lingua)
    voci = await run_in_threadpool(voci_service.firma_copertine, voci)
    return {"utente": utente, "voci": voci}


async def metriche_di(
    access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
) -> dict[str, Any]:
    """GET /utenti/{id}/metriche (issue #7): le metriche del collegato,
    non le proprie — stesso controllo di accesso di `libreria_di`
    (esistenza + collegamento attivo), poi il calcolo delega a
    `metriche_service.metriche_di` con l'`utente_id` del collegato, mai
    con `self_id`: è ciò che rende vera la regola 17 del PRD ("le
    metriche di un Utente sono calcolate solo sui suoi dati") anche
    quando a chiederle è un collegato in visione reciproca."""
    client = get_user_client(access_token)

    utente = await run_in_threadpool(utente_repository.get_utente, client, utente_id)
    if utente is None:
        raise UtenteInesistenteError

    collegato = await run_in_threadpool(
        collegamento_repository.is_collegato_attivo, client, utente_id
    )
    if not collegato:
        raise NonCollegatoError

    return await metriche_service.metriche_di(access_token, utente_id, anno, lingua)
