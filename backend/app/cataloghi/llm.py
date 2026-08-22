"""Il fornitore di modelli linguistici (OpenAI, PRD "Vincoli esterni"), per
le funzioni bibliografiche assistite: classificazione genere, deduzione
anno/lingua, riconduzione autori, deduplicazione (issue #20), arricchimento
delle descrizioni troppo corte (design-frontend.md §24, emendamento 21
agosto 2026).

Stesso contratto degli altri client di questo pacchetto (google_books,
open_library, wikidata): non sollevare mai per "il modello non ha deciso",
solo per rete/timeout/5xx/quota/chiave assente — `FonteNonRaggiungibileError`
condivisa, così i gestori in `app/lavori/` la trattano come trattano già
Wikidata o Wikipedia irraggiungibili, senza una seconda tassonomia di errori.

Funzioni tipizzate e non un client "chat" generico: ognuna dichiara
esplicitamente cosa invia, verificabile a colpo d'occhio per la regola 19
("nessun contenuto di un altro Utente inviato a un fornitore esterno di
modelli") — tutte lavorano solo su dato bibliografico condiviso (titolo,
autori, soggetti, generi, descrizioni di `libro_descrizione`), mai su
`voce_di_libreria`/`lettura`/`insight`/`recensione`. Sono le tre funzioni
che il PRD tiene fuori dal consenso: restano attive anche a consenso
revocato (regola 31).

**Le funzioni personali stanno altrove**, in `llm_personale.py`: dall'issue
#6 esistono chiamate che inviano contenuti dell'Utente, e tenerle in questo
stesso file avrebbe cancellato la proprietà che rende la regola 19
verificabile senza leggere il codice — che qui dentro non c'è nulla di
personale. Il trasporto condiviso dai due moduli sta in `openai_client.py`
(docs/adr/0017 per il come, docs/adr/0018 per la separazione).
"""

from dataclasses import dataclass

from app.cataloghi.openai_client import chiama_json


@dataclass(frozen=True)
class RispostaArricchimento:
    generi: list[str]
    """Id dell'elenco chiuso proposti dal modello. Il chiamante li valida
    contro l'elenco e li tronca a MASSIMO_GENERI: questo modulo non lo fa,
    perché non conosce quella regola di dominio."""
    anno_prima_pubblicazione: int | None
    lingua_originale: str | None
    """Codice ISO 639-1, es. 'it', 'en'."""


@dataclass(frozen=True)
class CandidatoAutore:
    autore_id: str
    nome_canonico: str
    varianti: list[str]


@dataclass(frozen=True)
class DecisioneAutore:
    autore_id_canonico: str
    motivo: str


@dataclass(frozen=True)
class OperaPerConfronto:
    libro_id: str
    titolo: str
    autori: list[str]
    descrizione: str | None


@dataclass(frozen=True)
class DecisioneDuplicato:
    libro_id_candidato: str
    motivo: str


_SCHEMA_ARRICCHIMENTO = {
    "type": "object",
    "properties": {
        "generi": {"type": "array", "items": {"type": "string"}},
        "anno_prima_pubblicazione": {"type": ["integer", "null"]},
        "lingua_originale": {"type": ["string", "null"]},
    },
    "required": ["generi", "anno_prima_pubblicazione", "lingua_originale"],
    "additionalProperties": False,
}


async def classifica_e_deduci(
    titolo: str,
    autori: list[str],
    soggetti: list[str],
    generi_ammessi: list[tuple[str, str]],
    necessita_genere: bool,
    necessita_anno: bool,
    necessita_lingua: bool,
) -> RispostaArricchimento:
    """Genere, anno di prima pubblicazione e lingua originale insieme, in
    un'unica chiamata (issue #20, punti 1+2 accorpati): stesso contesto
    bibliografico già raccolto in `risoluzione.py`, dimezza le chiamate
    rispetto a due lavori separati.

    Il chiamante decide se scrivere ciascun campo (la mappatura
    deterministica o Wikidata potrebbero nel frattempo aver già deciso
    l'uno o l'altro): qui si chiede solo ciò che serve davvero, tramite
    `necessita_*`, ma la risposta porta comunque tutti e tre i campi — lo
    schema strict di OpenAI non ammette proprietà opzionali.
    """
    elenco_generi = "\n".join(f"- {id_}: {etichetta}" for id_, etichetta in generi_ammessi)
    richieste = [
        campo
        for campo, necessario in (
            ("il genere", necessita_genere),
            ("l'anno di prima pubblicazione", necessita_anno),
            ("la lingua originale", necessita_lingua),
        )
        if necessario
    ]
    messaggi = [
        {
            "role": "system",
            "content": (
                "Sei un bibliotecario che classifica opere letterarie. "
                "Rispondi solo con dati che puoi dedurre da titolo, autori e "
                "soggetti forniti: se non puoi determinare un campo con "
                "ragionevole certezza, restituiscilo null. Non inventare mai "
                "un anno o una lingua plausibili ma non certi."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Titolo: {titolo}\n"
                f"Autori: {', '.join(autori) or '(nessuno)'}\n"
                f"Soggetti di catalogo: {', '.join(soggetti) or '(nessuno)'}\n\n"
                f"Determina {', '.join(richieste) or 'i campi richiesti'}.\n\n"
                "Il genere va scelto SOLO da questo elenco chiuso (fino a 3 "
                f"id, i più pertinenti prima):\n{elenco_generi}\n"
                "Se nessuno si applica con certezza, restituisci un elenco "
                "vuoto."
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_ARRICCHIMENTO, "arricchimento_bibliografico")
    return RispostaArricchimento(
        generi=[str(g) for g in dati.get("generi") or []],
        anno_prima_pubblicazione=dati.get("anno_prima_pubblicazione"),
        lingua_originale=dati.get("lingua_originale"),
    )


_SCHEMA_CONFRONTO_AUTORI = {
    "type": "object",
    "properties": {
        "autore_id_canonico": {"type": ["string", "null"]},
        "motivo": {"type": "string"},
    },
    "required": ["autore_id_canonico", "motivo"],
    "additionalProperties": False,
}


async def confronta_autori(
    nome_nuovo: str, candidati: list[CandidatoAutore]
) -> DecisioneAutore | None:
    """Se `nome_nuovo` è la stessa persona di uno dei candidati.

    `None` sia quando il modello non è confidente sia quando conclude che
    sono persone diverse: il chiamante non esegue alcuna riconduzione in
    nessuno dei due casi (issue #20, punto 3 — nessuna traccia per i
    quasi-match, decisione presa: più semplice, i casi dubbi restano
    fuori banda finché non notati)."""
    elenco = "\n".join(
        f"- id={c.autore_id}: {c.nome_canonico} "
        f"(varianti note: {', '.join(c.varianti) or 'nessuna'})"
        for c in candidati
    )
    messaggi = [
        {
            "role": "system",
            "content": (
                "Confronti nomi d'autore per decidere se indicano la stessa "
                "persona (es. forme estese o abbreviate dello stesso nome, "
                "traslitterazioni). Rispondi solo se sei ragionevolmente "
                "certo: in caso di dubbio, o se ti sembrano persone diverse "
                "con lo stesso cognome, restituisci autore_id_canonico null."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Nome da ricondurre: {nome_nuovo}\n\nCandidati esistenti:\n{elenco}\n\n"
                "Se uno dei candidati è la stessa persona, restituisci il suo id "
                "e una breve motivazione. Altrimenti restituisci null."
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_CONFRONTO_AUTORI, "confronto_autori")
    id_canonico = dati.get("autore_id_canonico")
    if not id_canonico:
        return None
    return DecisioneAutore(
        autore_id_canonico=str(id_canonico), motivo=str(dati.get("motivo") or "")
    )


_SCHEMA_CONFRONTO_DUPLICATI = {
    "type": "object",
    "properties": {
        "libro_id_candidato": {"type": ["string", "null"]},
        "motivo": {"type": "string"},
    },
    "required": ["libro_id_candidato", "motivo"],
    "additionalProperties": False,
}


def _descrivi_opera(opera: OperaPerConfronto) -> str:
    autori = ", ".join(opera.autori) or "(autore ignoto)"
    riga = f'- id={opera.libro_id}: "{opera.titolo}" di {autori}'
    if opera.descrizione:
        riga += f"\n  descrizione: {opera.descrizione[:1000]}"
    return riga


async def valuta_duplicati(
    nuovo: OperaPerConfronto, candidati: list[OperaPerConfronto]
) -> DecisioneDuplicato | None:
    """Se `nuovo` è la stessa opera di uno dei candidati.

    Confronto multiplo in una sola chiamata, non N confronti binari
    indipendenti: evita che due candidati ricevano entrambi "sì" senza che
    nulla li arbitri fra loro. `None` quando il modello non è confidente:
    il chiamante non scrive mai una fusione, solo — se c'è un match — una
    proposta che il Manutentore rivede fuori banda (issue #20, punto 4:
    vincolo assoluto, mai un'esecuzione automatica)."""
    elenco = "\n".join(_descrivi_opera(c) for c in candidati)
    messaggi = [
        {
            "role": "system",
            "content": (
                "Confronti schede bibliografiche per decidere se descrivono "
                "la STESSA opera letteraria (es. traduzioni, titoli "
                "alternativi, edizioni con sottotitolo diverso), non solo "
                "opere simili o dello stesso autore. Usa la descrizione, "
                "quando c'è, per giudicare il contenuto e non solo la forma "
                "del titolo. In caso di dubbio restituisci "
                "libro_id_candidato null: un falso positivo qui fonderebbe "
                "due schede diverse."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Opera nuova:\n{_descrivi_opera(nuovo)}\n\n"
                f"Candidati già nel catalogo:\n{elenco}\n\n"
                "Se uno dei candidati è la stessa opera, restituisci il suo id "
                "e una breve motivazione. Altrimenti restituisci null."
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_CONFRONTO_DUPLICATI, "confronto_duplicati")
    id_candidato = dati.get("libro_id_candidato")
    if not id_candidato:
        return None
    return DecisioneDuplicato(
        libro_id_candidato=str(id_candidato), motivo=str(dati.get("motivo") or "")
    )


_SCHEMA_DESCRIZIONE_RIFORMULATA = {
    "type": "object",
    "properties": {"testo": {"type": "string"}},
    "required": ["testo"],
    "additionalProperties": False,
}


def _fatti_bibliografici(
    titolo: str, autori: list[str], anno_prima_pubblicazione: int | None, generi: list[str]
) -> str:
    """I soli fatti già verificati che la standardizzazione della
    descrizione può usare come contesto, oltre al testo sorgente stesso —
    mai la conoscenza generale del modello sull'opera."""
    fatti = [f"Titolo: {titolo}"]
    if autori:
        fatti.append(f"Autori: {', '.join(autori)}")
    if anno_prima_pubblicazione:
        fatti.append(f"Anno di prima pubblicazione: {anno_prima_pubblicazione}")
    if generi:
        fatti.append(f"Generi: {', '.join(generi)}")
    return "\n".join(fatti)


async def espandi_descrizione(
    titolo: str,
    autori: list[str],
    anno_prima_pubblicazione: int | None,
    generi: list[str],
    testo_originale: str,
    fonte_originale: str,
) -> str:
    """Riformula ed espande una descrizione troppo corta allo standard
    della scheda del libro (design-frontend.md §24, emendamento 21 agosto
    2026): 400-600 caratteri, 3-5 frasi, registro enciclopedico.

    Ancorata SOLO al testo sorgente e ai fatti già verificati passati
    qui — mai alla conoscenza generale del modello sull'opera: la regola
    "mai inventato" del design doc resta sui fatti, non sulla
    formulazione. La lunghezza è un obiettivo, non un vincolo: il prompt
    istruisce esplicitamente a restare più brevi piuttosto che riempire
    con contenuto non verificabile pur di raggiungerla.
    """
    messaggi = [
        {
            "role": "system",
            "content": (
                "Riformuli descrizioni di opere letterarie troppo corte "
                "portandole a uno standard editoriale, nello stile "
                "dell'incipit di una voce enciclopedica: neutro, "
                "informativo, mai promozionale.\n\n"
                "FINGI DI NON SAPERE NULL'ALTRO sull'opera oltre a ciò che "
                "ricevi qui sotto: comportati come se il testo sorgente e "
                "i dati verificati fossero la tua UNICA fonte di "
                "informazione al mondo, anche quando riconosci il titolo "
                "e sai — o credi di sapere — altro sulla trama, "
                "l'ambientazione, l'epoca o il contesto storico. Quella "
                "conoscenza NON va usata, nemmeno se è corretta: non hai "
                "modo di verificarla in questo compito, e il compito "
                "successivo su un'opera oscura userebbe la stessa regola "
                "senza rete di sicurezza.\n\n"
                "Esempio concreto di cosa NON fare: da 'Le notti bianche "
                "è un racconto giovanile di Fëdor Dostoevskij' non si "
                "scrive che è ambientato a San Pietroburgo durante le "
                "notti estive, anche se è vero — quel dettaglio non è nel "
                "testo sorgente fornito.\n\n"
                "Obiettivo di lunghezza: 400-600 caratteri, 3-5 frasi — "
                "ma è un obiettivo, non un vincolo: se il testo sorgente "
                "contiene un solo fatto essenziale, un risultato di "
                "100-200 caratteri che si limita a riformulare quel fatto "
                "è CORRETTO e PREFERIBILE a un testo più lungo con anche "
                "un solo dettaglio non presente nella fonte."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{_fatti_bibliografici(titolo, autori, anno_prima_pubblicazione, generi)}\n\n"
                f"Descrizione sorgente ({fonte_originale}): {testo_originale}\n\n"
                "Riformula ed espandi questa descrizione secondo le regole date."
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_DESCRIZIONE_RIFORMULATA, "descrizione_riformulata")
    return str(dati.get("testo") or testo_originale)


async def accorcia_descrizione(
    titolo: str,
    autori: list[str],
    anno_prima_pubblicazione: int | None,
    generi: list[str],
    testo_originale: str,
    fonte_originale: str,
) -> str:
    """Riformula ed accorcia una descrizione troppo lunga (tipicamente
    una trama promozionale di Google Books) allo stesso standard di
    `espandi_descrizione`: 400-600 caratteri, 3-5 frasi, registro
    enciclopedico invece che da quarta di copertina.

    Nessun rischio di invenzione qui — si toglie, non si aggiunge — ma
    resta il rischio di alterare il significato tagliando male: il
    prompt vieta esplicitamente di introdurre fatti nuovi e di
    distorcere quelli tagliati, non solo di ometterli con giudizio.
    """
    messaggi = [
        {
            "role": "system",
            "content": (
                "Riformuli descrizioni di opere letterarie troppo lunghe "
                "o dal tono promozionale (tipicamente testo di quarta di "
                "copertina) portandole a uno standard editoriale, nello "
                "stile dell'incipit di una voce enciclopedica: neutro, "
                "informativo, mai promozionale.\n\n"
                "REGOLA ASSOLUTA: puoi SOLO togliere o riformulare in "
                "modo più sintetico ciò che è già nel testo sorgente. "
                "Non aggiungere mai un fatto, un nome o un dettaglio che "
                "non fosse già presente. Non alterare il significato di "
                "ciò che mantieni: se tagli un dettaglio che qualifica un "
                "altro fatto (una data, una condizione, un 'ma'), taglia "
                "entrambi insieme piuttosto che lasciare un'affermazione "
                "che il testo originale non faceva. Nel dubbio se un "
                "dettaglio sia essenziale, mantienilo: è più sicuro "
                "restare sopra i 600 caratteri che perdere un fatto "
                "qualificante.\n\n"
                "Obiettivo di lunghezza: 400-600 caratteri, 3-5 frasi."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{_fatti_bibliografici(titolo, autori, anno_prima_pubblicazione, generi)}\n\n"
                f"Descrizione sorgente ({fonte_originale}): {testo_originale}\n\n"
                "Riformula ed accorcia questa descrizione secondo le regole date."
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_DESCRIZIONE_RIFORMULATA, "descrizione_riformulata")
    return str(dati.get("testo") or testo_originale)
