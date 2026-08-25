"""Contratti di `/scritti`: il corpus dei Quaderni e le sue tre lenti
(design-frontend.md §22).

Un endpoint a sé e non un'estensione di `/voci`: la scheda del libro
serve UNA Voce e raggruppa gli insight per Lettura, questo serve la
materia intera dell'Utente attraverso i libri. §10 rimandava da sempre
la "vista trasversale degli insight" — è questa.

Nessun campo `utente_id` in ingresso in nessuno schema (AGENTS.md):
l'identità arriva dalla dipendenza che verifica il token.
"""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

TipoContenuto = Literal["insight", "recensione"]


class Scritto(BaseModel):
    """Un proprio insight o una propria recensione, con accanto il libro da
    cui viene.

    Stessa forma di `RisultatoSemantico` e non per caso: sfogliare e
    chiedere sono due lenti sulla stessa materia, e la carta che le mostra
    è la stessa carta (design-frontend.md §22). Se le due forme
    divergessero, divergerebbero anche i due componenti.
    """

    tipo_contenuto: TipoContenuto
    contenuto_id: UUID
    testo: str
    """Sempre il testo pieno, spoiler compreso: ogni riga è già del
    richiedente (le funzioni SQL filtrano `utente_id = auth.uid()`), mai
    di un collegato. La regola 10 del PRD protegge da uno spoiler altrui,
    non da un proprio testo."""
    spoiler: bool
    """Falso su ogni recensione: il contrassegno è un attributo del solo
    Insight (PRD). Il filtro "solo spoiler" quindi restringe agli insight,
    e l'interfaccia lo dichiara invece di far sparire le recensioni in
    silenzio."""
    visibilita: Literal["condiviso", "privato"]
    """Serve al piede della carta, che porta il lucchetto di "solo tuo"
    accanto a tipo e data: §10 vuole visibilità e spoiler scanditi
    dall'occhio, non dedotti aprendo qualcosa."""
    data: date
    voce_id: UUID
    libro_id: UUID
    titolo: str
    autori: list[str]
    copertina_colore_dominante: str | None = None
    vicini: int | None = None
    """Quanti propri scritti stanno semanticamente vicino a questo.

    `None` — non zero — quando gli indici semantici non ci sono: a
    consenso revocato vengono cancellati (regola 30), e uno `0` direbbe
    "questo pensiero non ha compagnia", che è un'affermazione che nessuno
    è in grado di fare in quel momento. Il piede della carta non mostra
    nulla, invece di mostrare un numero inventato.
    """


class ElencoScrittiResponse(BaseModel):
    scritti: list[Scritto]
    totale: int
    """Quanti scritti passano i filtri correnti, prima del taglio di
    pagina: è ciò che le pastiglie decidono (§7, "il conteggio chiude la
    stessa riga perché dice esattamente ciò che le pastiglie
    decidono")."""
    libri_distinti: int
    indici_spenti: bool
    """Vero quando il consenso è revocato: la pagina resta piena e
    dichiara le due sole cose che mancano — la ricerca per significato e i
    vicini (§5, "i propri scritti esistono anche a consenso revocato, ed è
    solo il modo di interrogarli che si spegne")."""
    indici_incompleti: bool
    """Vero durante una ricostruzione in blocco: i conteggi dei vicini
    sono parziali e la pagina non deve tacerlo."""


class Sfaccettatura(BaseModel):
    """Un valore per cui vale la pena filtrare, col suo conteggio."""

    tipo: Literal["anno", "libro"]
    chiave: str
    etichetta: str
    n: int
    autori: list[str] | None = None
    """Solo sulle righe `libro`: il menù "ogni libro" filtra anche per
    autore, non solo per titolo — chi cerca in una libreria di centinaia
    di titoli ricorda spesso l'autore più del titolo esatto. `None` sulle
    righe `anno`, dove il campo non vuol dire nulla."""


class SfaccettatureResponse(BaseModel):
    anni: list[Sfaccettatura]
    libri: list[Sfaccettatura]


class PensieroCheTornaResponse(BaseModel):
    """Lo slot in cima ai Quaderni: un proprio scritto vecchio, ripescato.

    `scritto` è `None` quando non si è ancora scritto nulla — non è un
    errore e non è uno stato vuoto da riempire con un riquadro: lo slot
    semplicemente non c'è, e la pagina comincia dal campo.
    """

    scritto: Scritto | None
    giorni_fa: int | None = None
    """Quanto tempo è passato, calcolato lato server sul fuso di Europa
    centrale come ogni altra data dell'app: il browser di chi guarda può
    stare in un altro fuso e darebbe un "due anni fa" diverso dal resto
    delle pagine."""


class ViciniResponse(BaseModel):
    vicini: list[Scritto]
    indici_incompleti: bool
