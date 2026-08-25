"""Contratti di `GET /ricerca/semantica` (issue #6).

Endpoint separato da `/ricerca/catalogo` e `/ricerca/cataloghi`, che
cercano libri: questo cerca dentro i propri testi. Il design doc è
esplicito sul fatto che le due cose non vadano fuse nemmeno
nell'interfaccia (§7: "revocare il consenso lascerebbe l'utente senza il
modo di trovare un libro").
"""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

TipoContenuto = Literal["insight", "recensione"]


class RisultatoSemantico(BaseModel):
    """Un proprio insight o una propria recensione, con accanto il libro da
    cui viene (design-frontend.md §10: "una pagina di risultati non è una
    vista di navigazione: mostra l'insight con accanto il libro")."""

    tipo_contenuto: TipoContenuto
    contenuto_id: UUID
    testo: str
    """Sempre il testo pieno, spoiler compreso: ogni risultato di questa
    ricerca è già del richiedente (`cerca_semantico` filtra
    `utente_id = auth.uid()`), mai di un collegato. La regola 10 protegge
    un lettore da uno spoiler altrui, non da un proprio testo che lui
    stesso ha marcato per i suoi collegati."""
    spoiler: bool
    """Il contrassegno resta esposto come informazione, anche se il testo
    non è nascosto: sapere di aver marcato un insight come spoiler è
    comunque utile a chi legge i propri risultati."""
    visibilita: Literal["condiviso", "privato"] = "condiviso"
    """Il lucchetto di "solo tuo" nel piede della carta. Prima usciva solo
    lo spoiler, e la stessa carta scandiva un segno su due dei due che
    §10 chiede di rendere visibili senza aprire nulla."""
    data: date
    voce_id: UUID
    libro_id: UUID
    titolo: str
    autori: list[str]
    copertina_miniatura_url: str | None
    copertina_colore_dominante: str | None
    vicini: int | None = None
    """Quanti propri scritti stanno semanticamente vicino a questo: lo
    stesso dato che porta la vista sfogliata (`app/schemas/quaderni.py`),
    perché la carta sia la stessa carta sotto tutte e tre le lenti."""


class RicercaSemanticaResponse(BaseModel):
    risultati: list[RisultatoSemantico]
    indici_incompleti: bool
    """Vero mentre la ricostruzione in blocco è in corso. Il PRD non
    ammette di tacerlo: "finché non sono pronti la ricerca semantica è
    incompleta e lo dichiara" — un elenco corto senza spiegazione si legge
    come "non hai scritto nulla al riguardo", che è falso."""
