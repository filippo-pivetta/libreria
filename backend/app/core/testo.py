"""Normalizzazione di testo bibliografico, condivisa da chi confronta
titoli e nomi d'autore.

Sta qui e non in un service perché serve sia ai client dei cataloghi
(app/cataloghi/) sia all'orchestrazione (app/services/): tenerne tre copie
significa che la correzione di una non raggiunge le altre — che è
esattamente come è nato il difetto per cui "Orwell, George" e "George
Orwell" finivano in gruppi diversi.
"""

import re
import unicodedata

_CONNETTIVI_NOME = frozenset({"de", "del", "della", "di", "da", "van", "von", "der", "dos", "la"})
"""Particelle che fanno parte del cognome e non lo terminano: senza di
esse "Giuseppe Tomasi di Lampedusa" darebbe "lampedusa" e "Ludwig van
Beethoven" darebbe "beethoven" — corretti entrambi — ma "Tomasi di
Lampedusa" scritto "Tomasi di Lampedusa, Giuseppe" darebbe "giuseppe."""


def normalizza(testo: str) -> str:
    """Minuscolo, senza accenti, senza punteggiatura, spazi compattati."""
    senza_accenti = "".join(
        c for c in unicodedata.normalize("NFD", testo) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", senza_accenti.lower())).strip()


def cognome(nome: str) -> str:
    """L'ultima parola significativa del nome, normalizzata.

    I cataloghi alternano "Umberto Eco" e "Eco, Umberto" per la stessa
    persona, e confrontare i nomi per intero fallirebbe metà delle volte.
    La virgola, quando c'è, dichiara qual è il cognome: si legge quella
    prima di ricorrere all'ultima parola.
    """
    if "," in nome:
        parti = normalizza(nome.split(",")[0]).split()
    else:
        parti = normalizza(nome).split()
    while len(parti) > 1 and parti[-1] in _CONNETTIVI_NOME:
        parti.pop()
    return parti[-1] if parti else ""


def cognomi(nomi: object) -> set[str]:
    """I cognomi di un elenco di nomi, senza i vuoti."""
    if not isinstance(nomi, (list, tuple)):
        return set()
    return {c for c in (cognome(str(n)) for n in nomi) if c}
