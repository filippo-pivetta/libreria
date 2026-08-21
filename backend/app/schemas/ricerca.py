"""Contratti di `/ricerca` e `POST /libri`.

Nessun campo `id`/`utente_id` in ingresso in nessuno schema (AGENTS.md):
l'identità dell'Utente arriva dalla dipendenza che verifica il token.
"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.voci import StatoVoce


class VoceDelRisultato(BaseModel):
    """La propria Voce per un risultato, quando esiste.

    Regge i tre verbi della schermata di ricerca (docs/design-frontend.md
    §13): nessuna Voce -> "Aggiungi"; letto o abbandonato -> "Rileggi" con
    l'anno e il voto; ogni altro stato -> "Vai al libro" con la pagina.
    """

    id: UUID
    stato: StatoVoce
    voto: float | None = None
    pagina_corrente: int | None = None
    anno_ultima_lettura: int | None = None


class RisultatoLocale(BaseModel):
    """Una scheda già nel sistema."""

    libro_id: UUID
    titolo: str
    """Variante nella lingua richiesta, con ripiego sul titolo canonico
    (PRD: "Il titolo mostrato si sceglie in quest'ordine: la variante nella
    lingua dell'interfaccia scelta da chi guarda; altrimenti il titolo
    canonico")."""
    autori: list[str]
    anno_prima_pubblicazione: int | None = None
    copertina_url: str | None = None
    copertina_colore_dominante: str | None = None
    copertina_colore_dominante_scuro: str | None = None
    copertina_stato: str
    voce: VoceDelRisultato | None = None


class RisultatoEsterno(BaseModel):
    """Un'opera trovata su un catalogo esterno, non ancora nel sistema.

    `volume_id` e `volumi_alternativi` tornano indietro a `POST /libri`:
    più identificativi di edizione in mano significa più ISBN da provare, e
    quindi più probabilità che l'identità dell'opera si chiuda.
    """

    volume_id: str
    volumi_alternativi: list[str] = Field(default_factory=list)
    titolo: str
    autori: list[str]
    anno_pubblicazione: int | None = None
    """Anno di QUESTA edizione: è ciò che il catalogo dà, e non va mai
    confuso con l'anno di prima pubblicazione dell'opera (PRD)."""
    copertina_url: str | None = None
    """Indirizzo remoto della miniatura, o `null` quando il catalogo
    dichiara di non avere immagini: serve che sia `null` e non un indirizzo
    da provare, perché un volume senza copertina risponde comunque 200 con
    un segnaposto grigio e il browser non se ne accorgerebbe."""
    libro_id: UUID | None = None
    """Valorizzato quando gli identificativi di questo risultato sono già
    nel catalogo locale: la riga si comporta allora come un risultato
    locale, con il suo verbo."""
    voce: VoceDelRisultato | None = None


class AggiungiDaCatalogoRequest(BaseModel):
    volume_id: str
    volumi_alternativi: list[str] = Field(default_factory=list)


class AggiungiDaCatalogoResponse(BaseModel):
    libro_id: UUID
    voce_id: UUID
    gia_in_libreria: bool
    """Vero quando la Voce esisteva già: l'app non duplica (PRD,
    comportamento #3)."""
