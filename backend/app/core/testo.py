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


REGOLA_STILE_PER_IL_MODELLO = (
    "Scrivi per lettori forti, che riconoscono una frase fatta a colpo "
    "d'occhio. Nessuna formula da quarta di copertina e nessun superlativo "
    "di mestiere: sono vietate le parole capolavoro, imperdibile, "
    "avvincente, indimenticabile, magistrale, e le formule un viaggio "
    "dentro qualcosa, una riflessione profonda, ti terrà incollato alle "
    "pagine. Nessuna domanda retorica, nessuna "
    "esclamazione. Un aggettivo si tiene solo se dice qualcosa che il "
    "sostantivo da solo non dice. Preferisci il concreto all'astratto e il "
    "verbo alla nominalizzazione, e varia la lunghezza delle frasi invece "
    "di allinearne tre uguali."
)
"""Il registro, per i prompt che producono prosa da leggere.

I prompt vincolavano i fatti, la lunghezza e la punteggiatura, e non
dicevano nulla sulla lingua: "neutro, informativo, mai promozionale"
nomina il difetto ma non lo fa riconoscere, e un modello che non sa
quali frasi siano di mestiere le scrive lo stesso. Qui l'elenco è
esplicito, perché una lista di formule vietate è l'unica forma di
questa regola che si possa davvero rispettare. Le formule vietate si
nominano senza virgolette di alcun tipo: il prompt del parere le
vieta nell'output, e mostrargliene qui sarebbe lo stesso difetto del
trattino lungo scritto dentro la regola che lo vietava.

Il pubblico è la ragione. Chi tiene un registro delle proprie letture
distingue un testo scritto da uno assemblato, e una descrizione che
scivola nella quarta di copertina squalifica la scheda intera.

Vale per i cinque prompt che producono prosa: le due standardizzazioni
di descrizione, il parere, i temi, i suggerimenti. Non per la
traduzione, che deve restare fedele anche a un originale scritto male,
né per le classificazioni, che non producono prosa."""


VOCE_PERSONALE = (
    "Parli a chi legge dandogli del tu, senza convenevoli e senza "
    "entusiasmo pubblicitario. Non ti presenti, non annunci quello che "
    "stai per fare, non chiudi con una formula di cortesia: cominci dalla "
    "cosa e finisci quando l'hai detta."
)
"""La voce dei testi rivolti al richiedente: parere, temi, suggerimenti.

Stava scritta a mano in due prompt su tre, e già divergente — il parere
diceva «senza convenevoli e senza entusiasmo pubblicitario», i temi solo
«senza convenevoli» — mentre i suggerimenti non la stabilivano affatto,
pur essendo la prosa più lunga che l'app mostri (cinque motivazioni di
tre o quattro frasi). È la stessa deriva del trattino lungo, presente in
uno solo dei sei prompt: una frase ripetuta a mano diverge alla prima
correzione, e manca proprio dove servirebbe di più.

Porta anche il divieto di preambolo, che nessuno dei tre aveva: senza,
un modello apre volentieri con «Ecco cinque proposte per te» e chiude
con «Buona lettura», due righe che nessun lettore ha chiesto."""


VOCE_CATALOGO = (
    "Scrivi nello stile dell'incipit di una voce enciclopedica: neutro, "
    "informativo, mai promozionale. Terza persona, senza mai rivolgerti a "
    "chi legge, e nessun giudizio di valore sull'opera."
)
"""La voce dei testi di catalogo: le due standardizzazioni di descrizione.

Non è la stessa di `VOCE_PERSONALE`, e non deve diventarlo. Una
descrizione è dato condiviso: la stessa riga la leggono tutti, e non
appartiene a chi la sta guardando. Dandole del tu direbbe a ogni lettore
una cosa che vale per un altro, e un giudizio di valore su un'opera
finirebbe nella scheda di tutti come se fosse un fatto.

La separazione dei due moduli — `llm.py` bibliografico, `llm_personale.py`
personale — nasce per la regola 19 del PRD (docs/adr/0018), cioè per
sapere a colpo d'occhio quali funzioni inviano contenuti di un Utente.
Che sia anche esattamente il confine fra le due voci non è una
coincidenza: è personale ciò che è rivolto a qualcuno."""


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
