"""Contratti di `/voci`: la libreria personale e le sue Voci.

Nessun campo `id`/`utente_id` in ingresso in nessuno schema (AGENTS.md):
l'identità arriva sempre da `get_current_user`, mai dal body.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.letture import EsitoLettura

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


class LibroEssenziale(BaseModel):
    """Il sottoinsieme del Libro che serve allo scaffale/alla scheda:
    dato condiviso, sola lettura in questa issue. `autori` arriva già
    ordinato per `ordine` (PRD regola 18, peso ripartito tra più autori)
    — vedi `app/repositories/voce_repository.py::_appiattisci_autori`."""

    id: UUID
    titolo_canonico: str
    anno_prima_pubblicazione: int | None
    lingua_originale: str | None
    copertina_miniatura_path: str | None
    copertina_grande_path: str | None
    autori: list[AutoreEssenziale]


class VoceResponse(BaseModel):
    id: UUID
    libro_id: UUID
    stato: StatoVoce
    pagine_adottate: int | None
    voto: int | None
    nota_intenzione: str | None
    creato_at: datetime
    aggiornato_at: datetime
    # Pagina dell'ultimo avanzamento della Lettura aperta, se c'è: solo
    # GET /voci la valorizza davvero (design-frontend.md §7, filo di
    # avanzamento sulla fascia "in corso"); altrove resta None per
    # costruzione della query, non per assenza di dato.
    pagina_corrente: int | None = None


class VoceConLibroResponse(VoceResponse):
    """Per lo scaffale e la scheda: la Voce con il Libro incorporato,
    così il frontend non deve fare una seconda chiamata per ogni dorso."""

    libro: LibroEssenziale


class AvanzamentoEssenziale(BaseModel):
    """Il sottoinsieme dell'Avanzamento incorporato nella scheda del
    libro (GET /voci/{id}): niente `lettura_id`, già implicito
    nell'annidamento sotto la sua Lettura."""

    id: UUID
    pagina: int
    data: date
    generato_automaticamente: bool


class LetturaConAvanzamenti(BaseModel):
    """Una Lettura con i propri avanzamenti, per lo storico delle
    letture nella scheda del libro (design-frontend.md §9, "sotto le due
    pagine")."""

    id: UUID
    data_inizio: date
    data_fine: date | None
    esito: EsitoLettura | None
    avanzamenti: list[AvanzamentoEssenziale]


class VoceDettaglioResponse(VoceResponse):
    """GET /voci/{id}: la Voce con il Libro e l'intero storico delle
    Letture (ciascuna con i propri avanzamenti) — quanto serve alla
    scheda del libro senza ulteriori chiamate."""

    libro: LibroEssenziale
    letture: list[LetturaConAvanzamenti]


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
