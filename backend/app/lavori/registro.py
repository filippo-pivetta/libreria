"""Chi esegue quale tipo di lavoro.

Un dizionario e non uno scan di moduli: i tipi ammessi sono già un elenco
chiuso nel CHECK di `lavoro.tipo` (migrazione 20260821120000), e averlo
scritto due volte in posti che si leggono l'uno accanto all'altro è meno
fragile di una registrazione implicita che nessuno vede.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.lavori import copertine, descrizioni


@dataclass(frozen=True)
class Gestore:
    """Come si esegue un tipo di lavoro, e cosa si fa quando non riesce."""

    esegui: Callable[[dict[str, Any]], Awaitable[None]]

    su_fallimento_definitivo: Callable[[dict[str, Any], str], Awaitable[None]]
    """Chiamato quando i tentativi si esauriscono o l'errore è definitivo.

    Non è un lusso: all'ultimo tentativo `esegui` ha già sollevato, quindi
    non può essere lui a scrivere lo stato osservabile del fallimento
    (`libro.copertina_stato = 'fallita'`). Senza questo gancio la coda
    direbbe 'fallito' mentre la scheda resterebbe 'in_attesa' per sempre —
    cioè esattamente la divergenza che il PRD vuole evitare quando chiede
    lavori "con uno stato osservabile".
    """


GESTORI: dict[str, Gestore] = {
    "copertina": Gestore(copertine.esegui, copertine.su_fallimento),
    "descrizione": Gestore(descrizioni.esegui, descrizioni.su_fallimento),
}
