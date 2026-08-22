"""Contratto dei suggerimenti di lettura (issue #27, riscritto il 22
agosto 2026 quando la generazione ha iniziato a verificare ogni titolo
contro i cataloghi — vedi il docstring di
`app/services/suggerimenti_service.py`).

Nessun `id`, nessun campo di persistenza: sono effimeri per scelta di
prodotto, non un artefatto conservato in libreria.
"""

from typing import Literal

from pydantic import BaseModel, Field


class SuggerimentiRequest(BaseModel):
    nota: str | None = Field(default=None, max_length=200)
    """Una preferenza libera per questa sola richiesta ("qualcosa di
    breve", "niente crime stavolta"), mai salvata: vive nel corpo di
    questa singola POST, come la domanda di `GET /ricerca/semantica`.
    Il tetto di duecento caratteri è una preferenza rapida, non un
    paragrafo — un testo più lungo va scritto come insight o recensione,
    dove resta e dice qualcosa di stabile sui gusti di chi legge."""


class Suggerimento(BaseModel):
    titolo: str
    autori: list[str]
    motivazione: str
    tipo: Literal["affine", "scoperta"]
    """"Affine" (vicino ai libri amati o alle letture recenti) o
    "scoperta" (stesso territorio ma un passo di lato). Il modello lo
    dichiara, il service non lo verifica: a differenza dell'esistenza del
    titolo, non c'è un catalogo contro cui controllare una classificazione
    di gusto."""


class SuggerimentiResponse(BaseModel):
    suggerimenti: list[Suggerimento]
