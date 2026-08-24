"""La scheda di un libro guardata PRIMA di averlo in libreria, e il
parere "me lo consigli?" che ci si può chiedere sopra
(docs/design-frontend.md §13).

Colma la lacuna che il design doc dichiarava da sé: "il parere prima
dell'aggiunta ha senso su una scheda di libro non ancora in libreria, non
in un elenco, ma oggi manca sia la scheda sia la rotta". Mancava la
scheda perché `/libro/{id}` prende un `voce_id`, cioè per costruzione un
libro che qualcuno ha già.

**Guardare non fa nascere una scheda.** È la regola che governa questo
modulo. La catena che risolve l'identità di un'opera costa oltre dieci
secondi di chiamate esterne più quattro o cinque lavori in secondo piano,
e sta dietro l'aggiunta per scelta esplicita (`ricerca_service`, ADR
0002): farla scattare su ogni sguardo la sposterebbe esattamente dove non
deve stare, e riempirebbe il catalogo di schede che nessuno ha in
libreria. Qui un volume di Google resta un volume di Google finché
qualcuno non lo aggiunge.

Da questo discendono le due asimmetrie che la carta mostra, e che non
sono difetti da nascondere:

- la descrizione di un libro esterno è quella di Google, quarta di
  copertina scritta per vendere; la prosa di Wikipedia (§21) arriva con
  un lavoro in secondo piano che parte alla nascita della scheda, quindi
  solo dopo l'aggiunta;
- l'anno che Google dà è quello dell'EDIZIONE, mai della prima
  pubblicazione dell'opera. Esce marcato come tale (`anno_di_edizione`) e
  non viene mai passato al modello come anno di prima pubblicazione: per
  un classico ristampato sarebbe plausibile e sbagliato, che è la forma
  di errore che il PRD vieta.

Un volume esterno i cui identificativi sono già noti al catalogo viene
servito **dalla scheda vera**, non dai dati di Google: stessi dati che si
vedrebbero dopo l'aggiunta, e il comando giusto (`POST /voci` con il
`libro_id`, non `POST /libri`). È la stessa logica per cui una riga di
ricerca esterna già nota mostra il verbo della propria Voce.
"""

from typing import Any, Literal
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import google_books
from app.core import storage
from app.core.supabase import get_user_client
from app.repositories import catalogo_repository, database, scheda_repository
from app.services import consenso as consenso_service
from app.services import mappatura_generi, preview_service, ricerca_service

Fonte = Literal["catalogo", "google"]


class SchedaNonTrovataError(Exception):
    """Nessun libro dietro questo identificativo: né nel catalogo né su
    Google. Non è una fonte irraggiungibile — quella ha una parola sua,
    perché per chi cerca sono due cose diverse (§13)."""


async def dettaglio(
    access_token: str,
    utente_id: UUID,
    fonte: Fonte,
    identificativo: str,
    lingua: str,
) -> dict[str, Any]:
    if fonte == "catalogo":
        try:
            libro_id = UUID(identificativo)
        except ValueError as errore:
            raise SchedaNonTrovataError from errore
        return await _dal_catalogo(access_token, utente_id, libro_id, lingua)
    return await _da_google(access_token, utente_id, identificativo, lingua)


async def _dal_catalogo(
    access_token: str, utente_id: UUID, libro_id: UUID, lingua: str
) -> dict[str, Any]:
    client = get_user_client(access_token)
    libro = await run_in_threadpool(scheda_repository.scheda, client, libro_id, lingua)
    if libro is None:
        raise SchedaNonTrovataError

    voce = await run_in_threadpool(ricerca_service.voce_per_libro, client, utente_id, libro_id)

    percorso = libro.pop("copertina_path", None)
    firmati = await run_in_threadpool(storage.firma_in_blocco, [percorso]) if percorso else {}

    return {
        "fonte": "catalogo",
        "libro_id": libro["libro_id"],
        "volume_id": None,
        "titolo": libro["titolo"],
        "autori": libro["autori"],
        "anno": libro["anno_prima_pubblicazione"],
        "anno_di_edizione": False,
        "lingua_originale": libro["lingua_originale"],
        "pagine": libro["pagine"],
        "generi": libro["generi"],
        "descrizione": libro["descrizione"],
        "descrizione_fonte": libro["descrizione_fonte"],
        "copertina_url": firmati.get(percorso) if percorso else None,
        "copertina_colore_dominante": libro["copertina_colore_dominante"],
        "copertina_colore_dominante_scuro": libro["copertina_colore_dominante_scuro"],
        "voce": voce,
    }


async def _da_google(
    access_token: str, utente_id: UUID, volume_id: str, lingua: str
) -> dict[str, Any]:
    volume = await google_books.per_identificativo(volume_id)
    if volume is None:
        raise SchedaNonTrovataError

    # Prima di mostrare i dati di Google: la scheda esiste già? Una sola
    # lettura sulla chiave primaria di `libro_riferimento_esterno`, la
    # stessa che fa la ricerca per decidere il verbo di ogni riga.
    riferimenti: list[tuple[str, str]] = [("google_books", volume.volume_id)]
    if volume.isbn13:
        riferimenti.append(("isbn13", volume.isbn13))
    libro_id = await run_in_threadpool(_libro_per_riferimenti, riferimenti)

    if libro_id is not None:
        scheda = await _dal_catalogo(access_token, utente_id, libro_id, lingua)
        # L'identificativo di volume resta nella risposta: è da lì che si
        # è arrivati, e il frontend non deve dedurre di essere finito su
        # una carta diversa da quella che ha chiesto.
        scheda["volume_id"] = volume.volume_id
        return scheda

    client = get_user_client(access_token)
    generi = mappatura_generi.mappa(list(volume.categorie))
    etichette = await run_in_threadpool(scheda_repository.etichette_generi, client, generi, lingua)

    return {
        "fonte": "google",
        "libro_id": None,
        "volume_id": volume.volume_id,
        "titolo": volume.titolo,
        "autori": list(volume.autori),
        "anno": volume.anno_pubblicazione,
        "anno_di_edizione": True,
        # La lingua originale dell'opera la sa solo Wikidata, e
        # interrogarla è parte della catena di risoluzione: non si paga
        # per guardare (vedi il docstring di modulo).
        "lingua_originale": None,
        "pagine": volume.pagine,
        "generi": etichette,
        "descrizione": volume.descrizione,
        "descrizione_fonte": "google_books" if volume.descrizione else None,
        "copertina_url": volume.copertina_url,
        "copertina_colore_dominante": None,
        "copertina_colore_dominante_scuro": None,
        # Nessuna Voce possibile: se il libro fosse già in libreria, la sua
        # scheda esisterebbe e saremmo usciti dal ramo qui sopra.
        "voce": None,
    }


def _libro_per_riferimenti(riferimenti: list[tuple[str, str]]) -> UUID | None:
    with database.apri_connessione() as connessione:
        return catalogo_repository.libro_per_riferimenti(connessione, riferimenti)


async def parere(
    access_token: str,
    utente_id: UUID,
    fonte: Fonte,
    identificativo: str,
    lingua: str,
) -> str:
    """ "Me lo consigli?" su un libro che non si ha in libreria.

    **Non viene salvato**, ed è l'unica differenza con quello della scheda
    del libro: `artefatto_generato` lega una preview alla Voce da cui è
    stata invocata (vincolo di schema, regola 23 del PRD), e qui una Voce
    non c'è. Il PRD chiama l'artefatto un contenuto "conservato nella sua
    libreria": senza libreria non c'è conservazione, e inventare una
    riga slegata per tenerlo significherebbe creare un contenuto
    dell'Utente su un libro che l'Utente non ha.

    Tutto il resto è identico: stesso profilo di lettura, stesso consenso,
    stessi vincoli della regola 20 (ottanta parole, nessuna virgoletta).
    """
    await consenso_service.esigi_consenso(access_token, utente_id)

    scheda = await dettaglio(access_token, utente_id, fonte, identificativo, lingua)
    return await preview_service.parere(access_token, utente_id, _contesto(scheda))


def _contesto(scheda: dict[str, Any]) -> dict[str, Any]:
    """Cosa del libro esce verso il fornitore: gli stessi cinque campi che
    la preview manda da sempre (`preview_repository.scheda_del_libro`), né
    uno di più.

    `anno_prima_pubblicazione` resta `None` quando l'anno che abbiamo è
    quello dell'edizione: meglio non dirlo che dirlo sbagliato — un anno
    di ristampa presentato come anno dell'opera è una premessa falsa su
    cui il modello ragionerebbe senza modo di accorgersene.
    """
    return {
        "titolo": scheda["titolo"],
        "autori": scheda["autori"],
        "generi": [g["etichetta"] for g in scheda["generi"]],
        "anno_prima_pubblicazione": None if scheda["anno_di_edizione"] else scheda["anno"],
        "descrizione": scheda["descrizione"],
    }
