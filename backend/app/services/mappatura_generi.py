"""Dai soggetti dei cataloghi ai 28 generi dell'elenco chiuso.

Mappatura deterministica, nessuna chiamata a un modello. Il PRD la vuole
così: "Si assegnano una volta sola alla nascita della scheda, mappando i
soggetti dei cataloghi esterni sull'elenco e ricorrendo al modello
linguistico dove la mappatura non decide. Se nessuna delle due vie è
sufficiente, l'opera resta 'non classificato'."

Qui c'è solo la prima via. Quando non decide, il libro nasce senza generi
— che è uno stato previsto e visibile, non un errore.

Le fonti parlano due lingue diverse: Google Books usa categorie derivate
da BISAC ("Fiction / Historical / General"), Open Library soggetti liberi
e multilingua, spesso ripetuti in spagnolo o italiano sullo stesso record.
Si guarda quindi dentro il testo, per parole chiave, invece di pretendere
una corrispondenza esatta che nessuna delle due fornirebbe.

Tre regole che l'ordine del dizionario incarna:

1. Chi arriva prima vince, a parità di corrispondenze. Le voci più
   specifiche stanno quindi sopra le più generiche: "true crime" prima di
   "crime", altrimenti ogni cronaca nera diventerebbe un giallo.
2. Massimo tre generi per libro (PRD), scelti per numero di
   corrispondenze: "Sapiens" può stare in storia e in scienze senza che
   si debba sceglierne una arbitrariamente.
3. Nessun formato, nessun livello superiore, nessuna fascia d'età: i
   termini "fiction", "nonfiction", "ebook", "young adult" non mappano su
   nulla, per costruzione (PRD, criteri dell'elenco).
"""

import re
import unicodedata

MASSIMO_GENERI = 3
"""PRD: "Un'opera ne porta da uno a tre"."""

# Le chiavi sono frammenti da cercare nel testo normalizzato dei soggetti.
# Sono in inglese e in italiano perché entrambe le fonti restituiscono
# entrambe le lingue sullo stesso record.
_INDIZI: dict[str, tuple[str, ...]] = {
    # --- prima i casi specifici, che altrimenti finirebbero altrove ---
    "true_crime": ("true crime", "cronaca nera", "delitti reali"),
    "biography_memoir": (
        "biography",
        "autobiography",
        "memoir",
        "biografia",
        "autobiografia",
        "memorie",
        "biografias",
        "diaries",
        "diari",
        "correspondence",
    ),
    "historical_fiction": (
        "historical fiction",
        "romanzo storico",
        "novela historica",
        "historical novel",
        "narrativa historica",
    ),
    "crime_thriller": (
        "detective",
        "mystery",
        "thriller",
        "suspense",
        "giallo",
        "poliziesco",
        "crime",
        "misterio",
        "noir",
        "spy stories",
        "spionaggio",
    ),
    "science_fiction": (
        "science fiction",
        "fantascienza",
        "ciencia ficcion",
        "dystopia",
        "distopia",
        "cyberpunk",
        "space opera",
    ),
    "fantasy": ("fantasy", "fantastico", "magic", "magia", "fairy tales", "fiabe"),
    "horror": ("horror", "ghost stories", "vampires", "terrore", "orrore"),
    "romance": ("romance", "love stories", "romanzo rosa", "storie d amore", "amor"),
    "poetry": ("poetry", "poesia", "poems", "poemas", "verse", "lirica"),
    "classics": (
        "classics",
        "classici",
        "classic literature",
        "clasicos",
        "literatura clasica",
        "greek literature",
        "latin literature",
    ),
    # --- saggistica per materia ---
    "history": (
        "history",
        "storia",
        "historia",
        "geschichte",
        "medieval",
        "medioevo",
        "ancient",
        "antichita",
        "war",
        "guerra",
        "civilization",
        "archaeology",
    ),
    "philosophy": ("philosophy", "filosofia", "ethics", "etica", "metaphysics", "logic"),
    "politics_society": (
        "political",
        "politics",
        "politica",
        "society",
        "societa",
        "sociology",
        "sociologia",
        "social science",
        "human rights",
        "diritti umani",
        "feminism",
        "femminismo",
        "current affairs",
    ),
    "economics_business": (
        "economics",
        "economia",
        "business",
        "management",
        "finance",
        "finanza",
        "marketing",
        "impresa",
        "commercio",
    ),
    "psychology": ("psychology", "psicologia", "psychoanalysis", "psicoanalisi", "mente"),
    "science": (
        "science",
        "scienza",
        "scienze",
        "physics",
        "fisica",
        "mathematics",
        "matematica",
        "biology",
        "biologia",
        "chemistry",
        "chimica",
        "astronomy",
        "astronomia",
        "evolution",
        "medicine",
        "medicina",
    ),
    "technology": (
        "technology",
        "tecnologia",
        "computers",
        "informatica",
        "engineering",
        "ingegneria",
        "programming",
        "artificial intelligence",
        "internet",
    ),
    "nature_environment": (
        "nature",
        "natura",
        "environment",
        "ambiente",
        "ecology",
        "ecologia",
        "climate",
        "clima",
        "animals",
        "animali",
        "botany",
    ),
    "religion_spirituality": (
        "religion",
        "religione",
        "spirituality",
        "spiritualita",
        "theology",
        "teologia",
        "bible",
        "bibbia",
        "buddhism",
        "christianity",
        "islam",
        "mysticism",
        "misticismo",
    ),
    "art_photography": (
        "art",
        "arte",
        "photography",
        "fotografia",
        "painting",
        "pittura",
        "architecture",
        "architettura",
        "design",
        "sculpture",
    ),
    "performing_arts": (
        "music",
        "musica",
        "performing arts",
        "theater",
        "theatre",
        "teatro",
        "cinema",
        "film",
        "dance",
        "danza",
        "opera lirica",
    ),
    "travel": ("travel", "viaggi", "voyages", "guidebook", "viajes", "esplorazioni"),
    "food_cooking": ("cooking", "cucina", "food", "cibo", "recipes", "ricette", "wine", "vino"),
    "sport": ("sports", "sport", "football", "calcio", "cycling", "ciclismo", "olympic"),
    "health_fitness": (
        "health",
        "salute",
        "fitness",
        "benessere",
        "diet",
        "dieta",
        "nutrition",
        "nutrizione",
        "yoga",
    ),
    "self_improvement": (
        "self-help",
        "self help",
        "crescita personale",
        "motivational",
        "productivity",
        "produttivita",
        "habits",
        "abitudini",
    ),
    "essays_reportage": (
        "essays",
        "saggi",
        "saggistica",
        "reportage",
        "journalism",
        "giornalismo",
        "ensayos",
        "criticism",
        "critica letteraria",
    ),
    # --- l'ultimo, perché è il più generico dei generi narrativi ---
    "literary_fiction": (
        "literary",
        "narrativa",
        "fiction",
        "romanzo",
        "novela",
        "novels",
        "italian fiction",
        "letteratura",
    ),
}


def _normalizza(testo: str) -> str:
    senza_accenti = "".join(
        c for c in unicodedata.normalize("NFD", testo) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9 ]+", " ", senza_accenti.lower())


def mappa(soggetti: list[str]) -> list[str]:
    """I generi dell'elenco chiuso corrispondenti a dei soggetti di catalogo.

    Ritorna una lista vuota quando la mappatura non decide: è il caso "non
    classificato" del PRD, uno stato previsto e visibile a tutti, non un
    fallimento da nascondere.
    """
    if not soggetti:
        return []

    testo = " ".join(_normalizza(s) for s in soggetti)
    punteggi: dict[str, int] = {}
    for genere, indizi in _INDIZI.items():
        conteggio = sum(1 for indizio in indizi if indizio in testo)
        if conteggio:
            punteggi[genere] = conteggio

    # Per numero di corrispondenze; a parità vince chi viene prima nel
    # dizionario, cioè il più specifico (vedi regola 1 nel docstring).
    ordine = list(_INDIZI)
    migliori = sorted(punteggi, key=lambda g: (-punteggi[g], ordine.index(g)))
    return migliori[:MASSIMO_GENERI]
