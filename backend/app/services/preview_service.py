"""La preview personalizzata "me lo consigli?" (issue #6).

Il PRD la descrive come "un parere su quel titolo a partire dallo storico
e dagli insight di chi la chiede: privata per costruzione, non
condivisibile, e distinta dai suggerimenti di lettura". È una delle cinque
funzioni che il consenso copre, e l'unica di questo branch che *scrive* un
contenuto nuovo nella libreria — un `artefatto_generato`, che da quel
momento è roba dell'Utente e sopravvive alla revoca del consenso (regola
32).

**Il profilo è lo stesso dei suggerimenti di lettura, dal 24 agosto
2026.** Fino a quel giorno la preview costruiva da sola un contesto più
povero — solo i libri `stato = 'letto'` (mai un abbandono), ordinati per
`voce.aggiornato_at` invece che per la vera data di chiusura della
Lettura, insight e recensioni passati come pool piatto senza dire a
quale libro appartenessero. Tre difetti che `suggerimenti_service` aveva
già risolto il 22 agosto (issue #27) senza che nessuno tornasse a
riportare la preview allo stesso livello. Ora entrambe le funzioni
chiamano `preview_repository.profilo_suggerimenti` e
`app/services/profilo_lettura.classifica`: un lettore che chiede un
parere su un libro vede lo stesso profilo di sé che il sistema usa per
suggerirgli cosa leggere.

La regola 20 è verificata qui e non delegata al prompt: "una preview
generata non supera le ottanta parole e non contiene testo tra
virgolette". Entrambe si misurano sul testo, con
`testo_generato.genera_conforme` (estratto da qui con l'issue #27, quando
la sintesi tematica ha iniziato a chiedere la stessa disciplina con un
tetto di parole diverso).

La regola aveva una terza condizione — "riporta l'indicazione di essere
una sintesi generata" — servita da un campo obbligatorio `avviso` che
valeva sempre "Sintesi generata". È stata tolta dal PRD e da qui: la
preview esce solo a chi l'ha chiesta un momento prima premendo un
pulsante, sotto il titolo che è la domanda stessa, e la regola 23 vieta
che la veda chiunque altro. Non restava nessuno da avvertire. La sintesi
tematica conserva il proprio `avviso`, che risponde a un'altra regola.
"""

from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm_personale
from app.core.supabase import get_user_client
from app.repositories import artefatto_repository, preview_repository
from app.services import consenso as consenso_service
from app.services import profilo_lettura, testo_generato

TIPO = "preview_personalizzata"

MASSIMO_PAROLE = 80

PreviewNonConformeError = testo_generato.TestoNonConformeError
"""Alias e non un tipo nuovo: stesso errore di `testo_generato`, con il
nome storico di questo modulo perché router e test lo importano da qui."""


class VoceNonTrovataError(Exception):
    """La Voce non esiste o non è di chi chiede."""


async def genera(access_token: str, utente_id: UUID, voce_id: UUID) -> dict[str, Any]:
    await consenso_service.esigi_consenso(access_token, utente_id)

    client = get_user_client(access_token)
    scheda = await run_in_threadpool(
        preview_repository.scheda_del_libro, client, voce_id, utente_id
    )
    if scheda is None:
        raise VoceNonTrovataError

    testo = await parere(access_token, utente_id, scheda, escludi_voce_id=str(voce_id))

    artefatto = await run_in_threadpool(
        artefatto_repository.create, client, utente_id, TIPO, voce_id, testo
    )
    return artefatto


async def parere(
    access_token: str,
    utente_id: UUID,
    scheda: dict[str, Any],
    escludi_voce_id: str | None = None,
) -> str:
    """Il testo del parere, e nient'altro: né consenso né scrittura.

    Estratta da `genera` quando la scheda pubblica (§13) ha avuto bisogno
    dello stesso parere su un libro che non è in libreria — dove non c'è
    una Voce a cui legare un artefatto, quindi non c'è niente da salvare.
    Il profilo del richiedente e i vincoli della regola 20 sono gli stessi:
    quello che cambia è solo da dove arriva la scheda del libro (una Voce
    propria, una scheda di catalogo, un volume di Google) e se il testo
    sopravvive alla pagina.

    Il consenso resta a carico di chi chiama, come per ogni altra funzione
    assistita (`ricerca_semantica_service`, `sintesi_service`,
    `suggerimenti_service` lo chiedono ciascuna in cima): è una condizione
    d'ingresso, non un passo della generazione, e metterla qui la
    nasconderebbe due livelli sotto la rotta che la deve dichiarare.
    """
    client = get_user_client(access_token)
    profilo = await run_in_threadpool(preview_repository.profilo_suggerimenti, client, utente_id)
    # La Voce su cui si chiede il parere non deve comparire come prova di
    # sé stessa (vedi profilo_lettura.classifica). Su un libro che non si
    # ha in libreria non c'è nulla da escludere: `None`.
    pilastri, recenti, delusi, _esclusi = profilo_lettura.classifica(
        profilo, escludi_voce_id=escludi_voce_id
    )
    return await _genera_conforme(scheda, pilastri, recenti, delusi)


async def _genera_conforme(
    scheda: dict[str, Any],
    pilastri: list[dict[str, Any]],
    recenti: list[dict[str, Any]],
    delusi: list[dict[str, Any]],
) -> str:
    return await testo_generato.genera_conforme(
        lambda: llm_personale.genera_preview(
            titolo=scheda["titolo"],
            autori=scheda["autori"],
            generi=scheda["generi"],
            anno_prima_pubblicazione=scheda["anno_prima_pubblicazione"],
            descrizione=scheda["descrizione"],
            pilastri=pilastri,
            recenti=recenti,
            delusi=delusi,
        ),
        MASSIMO_PAROLE,
    )


async def ultima(access_token: str, voce_id: UUID) -> dict[str, Any] | None:
    client = get_user_client(access_token)
    artefatto = await run_in_threadpool(artefatto_repository.ultimo_per_voce, client, voce_id, TIPO)
    if artefatto is None:
        return None
    return artefatto


async def cancella(access_token: str, artefatto_id: UUID) -> bool:
    """Non c'è alcun controllo di consenso: cancellare un proprio
    contenuto resta possibile a interruttore spento, ed è l'altra faccia
    della regola 32 — la revoca non tocca gli artefatti, ma nemmeno li
    imprigiona."""
    client = get_user_client(access_token)
    return await run_in_threadpool(artefatto_repository.delete, client, artefatto_id)
