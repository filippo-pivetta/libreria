"""Disciplina di forma comune ai testi generati che la dichiarano (issue
#27, estratta da `preview_service.py` quando la sintesi tematica ha
iniziato a chiedere la stessa cosa con un tetto di parole diverso).

Non ogni testo generato ci passa: i suggerimenti di lettura sono un
elenco strutturato, non prosa, e non hanno bisogno di questo controllo.
Preview e sintesi tematica sì, perché entrambe promettono all'Utente
prosa continua senza citazioni finte (regola 20 per la preview; la
sintesi non ha un numero di regola proprio nel PRD, ma la stessa ragione
si applica: un testo che il modello firma come sintesi non può contenere
frasi che sembrano citate parola per parola da un libro o da un insight).
"""

import logging
import re
from collections.abc import Awaitable, Callable

from app.core.testo import ha_trattini_lunghi

logger = logging.getLogger("app.services.testo_generato")

_VIRGOLETTE = '"«»“”„‘'
"""Ogni comparsa di uno di questi caratteri è una citazione. Fuori
dall'elenco stanno l'apostrofo dritto (') e quello tipografico (’), che
in italiano compaiono a ogni riga in "dell'amicizia", "un'affinità":
vietarli avrebbe respinto quasi ogni frase corretta (vedi
`preview_service.py`, dove questo elenco è nato)."""


class TestoNonConformeError(Exception):
    """Il modello ha risposto, ma fuori dai vincoli di forma, due volte di
    fila.

    Trattata come una fonte che non risponde e non come un errore
    interno — un output non conforme non si salva e non si aggiusta,
    perché aggiustarlo (troncare, togliere le virgolette) produrrebbe un
    testo mutilato firmato come se fosse quello che il modello ha detto.
    """


def conta_parole(testo: str) -> int:
    return len([p for p in re.split(r"\s+", testo.strip()) if p])


def conforme(testo: str, massimo_parole: int) -> bool:
    if not testo.strip():
        return False
    if conta_parole(testo) > massimo_parole:
        return False
    # Il trattino lungo è vietato ai testi generati (app/core/testo.py) e
    # ogni prompt lo dice. Il controllo esiste perché il prompt è una
    # richiesta, non una garanzia: qui si verifica, e un secondo tentativo
    # basta quasi sempre. Non si ripara sostituendolo con una virgola —
    # per la stessa ragione per cui non si troncano le risposte troppo
    # lunghe: un testo aggiustato verrebbe firmato come se il modello
    # l'avesse scritto così.
    if ha_trattini_lunghi(testo):
        return False
    return not any(c in testo for c in _VIRGOLETTE)


async def genera_conforme(genera: Callable[[], Awaitable[str]], massimo_parole: int) -> str:
    """Un solo secondo tentativo, non un ciclo: se due risposte di fila
    escono dai vincoli, il problema è il prompt o il modello, e insistere
    spende soldi per lo stesso esito."""
    for tentativo in (1, 2):
        testo = (await genera()).strip()
        if conforme(testo, massimo_parole):
            return testo
        logger.warning(
            "Testo generato fuori dai vincoli di forma al tentativo %s (%s parole).",
            tentativo,
            conta_parole(testo),
        )
    raise TestoNonConformeError
