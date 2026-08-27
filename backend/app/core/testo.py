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

TRATTINI_LUNGHI = "—–―"
"""Lineetta em, lineetta en e barra orizzontale.

Non compaiono in nessun testo che il modello produce per un Utente
(design-frontend.md, regole di scrittura). Due ragioni, e la prima da
sola basterebbe: sono il segno di interpunzione con cui si riconosce a
colpo d'occhio una prosa scritta da un modello, e un testo che l'app
firma come generato non ha bisogno di dichiararlo anche nella
punteggiatura. La seconda è che in italiano l'inciso con lineetta è
raro fuori dalla prosa letteraria, e questi testi sono descrizioni di
catalogo e pareri, non racconti.

Il trattino breve (-) resta ammesso: è un'altra cosa, e serve nelle
parole composte.

La regola vale per l'OUTPUT del modello, non per il codice e la
documentazione, dove la lineetta è di casa (questo file compreso)."""

REGOLA_TRATTINI_PER_IL_MODELLO = (
    "MAI il trattino lungo (—) o il trattino medio (–), in nessun punto "
    "del testo: usa la virgola o il punto, scrivendo frasi che non ne "
    "abbiano bisogno."
)
"""La stessa regola, nella forma che va nei prompt.

Le parole non sono nuove: erano già scritte così dentro il prompt dei
suggerimenti di lettura, l'unico dei sei che le avesse. Qui non si
riformula, si sposta — una costante invece della frase ripetuta a mano
in ogni prompt, che è la lezione di `app/cataloghi/agente.py`: la stessa
stringa in quattro file mancava proprio dove serviva di più."""


def ha_trattini_lunghi(testo: str) -> bool:
    return any(c in testo for c in TRATTINI_LUNGHI)


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
