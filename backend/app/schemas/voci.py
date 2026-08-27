"""Contratti di `/voci`: la libreria personale e le sue Voci.

Nessun campo `id`/`utente_id` in ingresso in nessuno schema (AGENTS.md):
l'identità arriva sempre da `get_current_user`, mai dal body.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.letture import EsitoLettura
from app.schemas.recensioni import RecensioneResponse, Visibilita

StatoVoce = Literal["da_leggere", "in_lettura", "in_pausa", "abbandonato", "letto"]


class AggiungiVoceRequest(BaseModel):
    """Corpo di POST /voci. `libro_id` deve già esistere in `public.libro`
    (in questa issue trattato come dato seminato fuori banda — la ricerca
    sui cataloghi esterni che lo popola è l'issue #4)."""

    libro_id: UUID


class AutoreEssenziale(BaseModel):
    """Identità stabile dell'Autore (ADR 0005): il Libro punta a questa,
    mai a un nome scritto a mano. Dato condiviso, sola lettura qui."""

    id: UUID
    nome_canonico: str


class GenereEssenziale(BaseModel):
    """Identità stabile del Genere (ADR 0005) più l'etichetta nella lingua
    dell'interfaccia — oggi sempre italiano, l'interfaccia bilingue resta
    debito noto (AGENTS.md). Dato condiviso, nessuna correzione da app
    (regola 21/22 del PRD)."""

    id: str
    etichetta: str


class LibroDaScaffale(BaseModel):
    """Il sottoinsieme del Libro che serve allo SCAFFALE:
    dato condiviso, sola lettura in questa issue. `autori` arriva già
    ordinato per `ordine` (PRD regola 18, peso ripartito tra più autori)
    — vedi `app/repositories/voce_repository.py::_appiattisci_autori`."""

    id: UUID
    titolo_canonico: str
    anno_prima_pubblicazione: int | None
    anno_dedotto: bool
    """Vero quando il valore viene dal modello e non dal catalogo/Wikidata
    (issue #20 punti 1+2). L'etichetta "dedotto" prevista da design §9 è
    stata costruita e poi tolta dall'interfaccia (emendamento 22 agosto
    2026): il campo resta esposto, non più mostrato in scheda."""
    lingua_originale: str | None
    lingua_dedotta: bool
    """Come `anno_dedotto`, per la lingua originale."""
    generi: list[GenereEssenziale]
    """Fino a tre (PRD), mai correggibili da app (regola 21/22): "nessun
    affordance di modifica" è il messaggio, non solo l'assenza di un
    comando (design §9)."""
    copertina_miniatura_url: str | None
    """URL firmato, non il percorso interno: il bucket è privato (PRD
    regola 6) e il percorso da solo non apre nulla. La firma dura sette
    giorni ed è stabile tra le richieste, così il browser può davvero
    metterla in cache (app/core/storage.py)."""
    copertina_grande_url: str | None
    copertina_colore_dominante: str | None
    """Governa ombra e fondo del volume sullo scaffale (design §7).
    Assente finché la copertina non è stata recuperata."""
    copertina_colore_dominante_scuro: str | None
    """Variante desaturata di `copertina_colore_dominante` per la stanza
    scura (design §3). Assente esattamente quando lo è la prima."""
    copertina_stato: str
    """`in_attesa` mentre il lavoro in secondo piano sta lavorando: è ciò
    che permette allo scaffale di sapere che vale la pena ricontrollare,
    invece di aspettare per sempre un'immagine che forse non arriverà
    (PRD, "lavori in secondo piano con uno stato osservabile")."""
    autori: list[AutoreEssenziale]


class LibroEssenziale(LibroDaScaffale):
    """Il Libro come lo vuole la SCHEDA (`GET /voci/{id}`): tutto quanto
    sopra, più la descrizione dell'opera.

    La descrizione sta qui e non in `LibroDaScaffale` perché lo scaffale
    non la disegna in nessun punto — `components/libreria/` non la
    nomina — mentre `GET /voci` la spediva per ogni volume della
    libreria. Su una libreria di qualche centinaio di titoli era la voce
    più pesante di tutta la risposta, scaricata a ogni apertura della
    home e mai letta. Non è una restrizione dell\'API: è la stessa
    distinzione che l\'interfaccia fa già da sé fra la fila dei dorsi e
    la carta aperta di un libro."""

    descrizione: str | None
    """Solo nella lingua dell'interfaccia, mai un ripiego su un'altra
    (design §9): assente se quella lingua non ha una descrizione, anche
    se un'altra ce l'ha."""
    descrizione_riformulata: bool
    """Vero quando il testo è stato riformulato dal modello (espanso se
    troppo corto, accorciato se troppo lungo) a partire dalla descrizione
    sorgente (design §24, emendamento 21 agosto 2026). L'etichetta di
    trasparenza in scheda è stata costruita e poi tolta dall'interfaccia
    (emendamento 22 agosto 2026): il campo resta esposto, non più
    distinto in scheda dalla citazione letterale della fonte."""


class VoceResponse(BaseModel):
    id: UUID
    # Proprietario della Voce: da quando GET /voci/{id} è raggiungibile
    # anche da un collegato attivo (issue #3), il frontend usa questo
    # campo per distinguere "è mia" da "è di un collegato" nella stessa
    # pagina condivisa e nascondere i controlli di scrittura di
    # conseguenza (design-frontend.md §15).
    utente_id: UUID
    libro_id: UUID
    stato: StatoVoce
    pagine_adottate: int | None
    # Mezze stelle ammesse (design doc §9): 1, 1.5, 2, ..., 5.
    voto: float | None
    nota_intenzione: str | None
    creato_at: datetime
    aggiornato_at: datetime
    # Pagina dell'ultimo avanzamento della Lettura aperta, se c'è: solo
    # GET /voci la valorizza davvero (design-frontend.md §7, filo di
    # avanzamento sulla fascia "in corso"); altrove resta None per
    # costruzione della query, non per assenza di dato.
    pagina_corrente: int | None = None
    # Conteggi, non contenuto: un conteggio non è un elenco o un'anteprima
    # ai fini della regola 10 del PRD, quindi nessun gating spoiler qui —
    # a differenza del testo vero e proprio di recensione/insight, esposto
    # solo da GET /voci/{id} con le sue regole di visibilità (issue #5).
    # Per "Nella tua libreria".
    ha_recensione: bool = False
    numero_insight: int = 0


class VoceConLibroResponse(VoceResponse):
    """Per lo scaffale e la scheda: la Voce con il Libro incorporato,
    così il frontend non deve fare una seconda chiamata per ogni dorso."""

    libro: LibroDaScaffale


class AvanzamentoEssenziale(BaseModel):
    """Il sottoinsieme dell'Avanzamento incorporato nella scheda del
    libro (GET /voci/{id}): niente `lettura_id`, già implicito
    nell'annidamento sotto la sua Lettura."""

    id: UUID
    pagina: int
    data: date
    generato_automaticamente: bool


class InsightEssenziale(BaseModel):
    """Annidato in `GET /voci/{id}` (`letture[].insight` e
    `insight_senza_lettura`, issue #5). `testo` è `None` se e solo se
    `spoiler` è vero **e chi guarda non è il proprietario** — un collegato
    in visione reciproca lo vede tagliato, il proprietario vede sempre il
    testo pieno (design-frontend.md §11, rivisto nell'issue #6: la regola
    10 protegge da uno spoiler altrui, non da un proprio testo). Per il
    collegato, il testo pieno si ottiene solo con `GET /insight/{id}/testo`,
    dietro un gesto esplicito."""

    id: UUID
    testo: str | None
    spoiler: bool
    visibilita: Visibilita
    data: date
    creato_at: datetime


class LetturaConAvanzamenti(BaseModel):
    """Una Lettura con i propri avanzamenti, per lo storico delle
    letture nella scheda del libro (design-frontend.md §9, "sotto le due
    pagine")."""

    id: UUID
    data_inizio: date
    data_fine: date | None
    esito: EsitoLettura | None
    avanzamenti: list[AvanzamentoEssenziale]
    # Raggruppati per Lettura (design-frontend.md §10, "come impone il
    # PRD"), gating spoiler già applicato — issue #5.
    insight: list[InsightEssenziale]


class VoceDettaglioResponse(VoceResponse):
    """GET /voci/{id}: la Voce con il Libro e l'intero storico delle
    Letture (ciascuna con i propri avanzamenti) — quanto serve alla
    scheda del libro senza ulteriori chiamate."""

    libro: LibroEssenziale
    letture: list[LetturaConAvanzamenti]
    # `None` se non scritta, o se scritta ma privata e chi guarda non è il
    # proprietario (RLS, non un campo booleano applicativo) — issue #5.
    recensione: RecensioneResponse | None
    # Insight non legati a nessuna Lettura: scritti prima di iniziare il
    # libro, o orfani di una Lettura poi cancellata (PRD: "restano sulla
    # Voce, senza più alcuna Lettura associata") — issue #5.
    insight_senza_lettura: list[InsightEssenziale]


class AggiungiVoceResponse(BaseModel):
    """Risposta di POST /voci. `already_existed` distingue una Voce
    appena creata da una già presente per (utente, libro) — PRD: "se il
    Libro è già in libreria, l'app non lo duplica" — così il chiamante
    decide da solo cosa fare in base allo `stato` ricevuto (in questa
    issue nessun frontend consuma questa distinzione, l'endpoint resta
    testabile via Swagger/API in attesa della ricerca di #4)."""

    voce: VoceResponse
    already_existed: bool


class CambiaStatoRequest(BaseModel):
    """Corpo di PATCH /voci/{id}/stato. `data` è opzionale: se assente,
    la RPC usa il giorno corrente in Europa centrale (PRD: "il giorno
    corrente come predefinito"). A seconda della transizione rappresenta
    la data di inizio (apertura di una Lettura) o di fine (chiusura)."""

    stato: StatoVoce
    data: date | None = None


class CorreggiPagineRequest(BaseModel):
    pagine_adottate: int | None = Field(default=None, gt=0)


class CorreggiVotoRequest(BaseModel):
    """`null` cancella il voto. Mezze stelle ammesse: il vincolo "1-5, a
    scatti di 0,5" ripete a livello applicativo `chk_voce_di_libreria_voto`
    (AGENTS.md: "validazione lato server sempre, anche se il client valida
    già")."""

    voto: float | None = Field(default=None, ge=1, le=5)

    @field_validator("voto")
    @classmethod
    def _voto_a_mezze_stelle(cls, value: float | None) -> float | None:
        if value is not None and (value * 2) % 1 != 0:
            raise ValueError("Il voto ammette solo mezze stelle (1, 1,5, 2, ... 5).")
        return value


class CorreggiNotaIntenzioneRequest(BaseModel):
    """`null` cancella la nota. Nessun limite di lunghezza: il PRD non ne
    impone uno ("nessun limite imposto, quindi nessun rifiuto previsto",
    casi limite)."""

    nota_intenzione: str | None = None
