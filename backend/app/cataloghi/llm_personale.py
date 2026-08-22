"""Le funzioni assistite che toccano contenuti dell'Utente (issue #6),
subordinate al consenso all'elaborazione assistita (docs/adr/0008, PRD
"Consenso all'elaborazione assistita").

Modulo separato da `llm.py` e non una sezione in fondo a quel file: la
regola 19 del PRD ("nessun contenuto appartenente a un Utente diverso da
chi ha richiesto l'operazione viene mai inviato a un fornitore esterno di
modelli") si verifica leggendo *cosa* ogni funzione riceve, e la
separazione fisica è ciò che permette di dire "in llm.py non c'è nulla di
personale, qui dentro c'è solo roba di chi ha chiesto" senza rileggere
ogni prompt (docs/adr/0018).

Le regole di questo modulo, tutte verificabili sulle firme:

- Ogni funzione riceve dati **già raccolti dal chiamante con l'identità
  dell'Utente richiedente e filtrati per il suo `utente_id`**. Nessuna
  funzione qui dentro legge il database: se un dato altrui arrivasse fin
  qui sarebbe un errore del service, e per questo il service filtra
  esplicitamente invece di affidarsi alla sola RLS.
- La **nota di intenzione non compare in nessuna firma**, in nessuna
  forma, in nessuno stato del consenso: contiene abitualmente nomi di
  persone che non usano l'applicazione e non hanno prestato alcun
  consenso (PRD). Dalla migrazione 20260820221500 vive in
  `voce_di_libreria_privata`, una tabella che i service di questo
  perimetro non interrogano mai.
- Il rispetto della regola 20 (ottanta parole, nessun testo tra
  virgolette, indicazione di sintesi generata) è chiesto nel prompt ma
  **verificato dal service**: un prompt è una richiesta, non una
  garanzia.
"""

from app.cataloghi.openai_client import chiama_json

_SCHEMA_PREVIEW = {
    "type": "object",
    "properties": {"testo": {"type": "string"}},
    "required": ["testo"],
    "additionalProperties": False,
}


def _riga_libro_letto(titolo: str, autori: list[str], generi: list[str], voto: float | None) -> str:
    # Nessuna virgoletta nemmeno nell'input: la regola 20 vieta le
    # virgolette in uscita, e non conviene mostrarne un esempio in
    # ingresso a un modello che tende a rispecchiare la forma.
    pezzi = [titolo]
    if autori:
        pezzi.append(f"di {', '.join(autori)}")
    if generi:
        pezzi.append(f"({', '.join(generi)})")
    if voto is not None:
        pezzi.append(f"— {voto:g} stelle")
    return "- " + " ".join(pezzi)


async def genera_preview(
    titolo: str,
    autori: list[str],
    generi: list[str],
    anno_prima_pubblicazione: int | None,
    descrizione: str | None,
    libri_letti: list[tuple[str, list[str], list[str], float | None]],
    testi_propri: list[str],
) -> str:
    """La preview personalizzata "me lo consigli?" (PRD, "Funzioni
    assistite da modello"): un parere su *questo* titolo a partire dallo
    storico e dagli insight di chi la chiede.

    `libri_letti` e `testi_propri` appartengono tutti al richiedente:
    titolo/autori/generi/voto dei suoi libri finiti, e il testo dei suoi
    insight e delle sue recensioni — inclusi quelli che ha lasciato
    privati, che il consenso copre esplicitamente ("I testi che scrivi,
    insight e recensioni compresi"). Mai una riga di un collegato, mai una
    nota di intenzione.

    Il testo dei libri e la descrizione sono invece dato di catalogo
    condiviso: uscirebbero comunque con le funzioni bibliografiche.
    """
    storico = "\n".join(_riga_libro_letto(*libro) for libro in libri_letti) or "(nessuno)"
    propri = "\n".join(f"- {t}" for t in testi_propri) or "(nessuno)"
    scheda = [f"Titolo: {titolo}"]
    if autori:
        scheda.append(f"Autori: {', '.join(autori)}")
    if generi:
        scheda.append(f"Generi: {', '.join(generi)}")
    if anno_prima_pubblicazione:
        scheda.append(f"Anno di prima pubblicazione: {anno_prima_pubblicazione}")
    if descrizione:
        scheda.append(f"Descrizione: {descrizione}")

    messaggi = [
        {
            "role": "system",
            "content": (
                "Dici a un lettore se un libro fa per lui, a partire da ciò "
                "che ha già letto e da ciò che ha scritto sulle proprie "
                "letture. Parli a lui, dandogli del tu, senza convenevoli e "
                "senza entusiasmo pubblicitario.\n\n"
                "VINCOLI ASSOLUTI sulla risposta:\n"
                "- MASSIMO OTTANTA PAROLE. Meno va benissimo.\n"
                '- NESSUN testo tra virgolette di alcun tipo: niente ", '
                "niente «», niente virgolette curve. Non citare frasi del "
                "libro né frasi che il lettore ha scritto: riformula sempre "
                "con parole tue.\n"
                "- Nessun titolo di sezione, nessun elenco puntato: prosa "
                "continua.\n\n"
                "Motiva il parere su cose concrete dello storico (un autore "
                "già letto, un genere ricorrente, un tema che torna nei suoi "
                "appunti), non su generalità. Se lo storico non dice "
                "abbastanza per un parere onesto, dillo in una frase invece "
                "di inventare un'affinità."
            ),
        },
        {
            "role": "user",
            "content": (
                "Libro su cui voglio un parere:\n"
                + "\n".join(scheda)
                + f"\n\nLibri che ho finito:\n{storico}"
                + f"\n\nCose che ho scritto sulle mie letture:\n{propri}"
                + "\n\nMe lo consigli?"
            ),
        },
    ]
    dati = await chiama_json(messaggi, _SCHEMA_PREVIEW, "preview_personalizzata")
    return str(dati.get("testo") or "")
