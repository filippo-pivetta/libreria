# 0017. Client HTTP diretto, senza SDK, per il fornitore di modelli

Stato: accettata
Data: 2026-08-21

## Contesto
Il PRD prevede otto funzioni assistite dal modello linguistico (OpenAI, "Vincoli esterni"), di cui quattro bibliografiche — classificazione genere, deduzione anno/lingua, riconduzione autori, deduplicazione — nello scope dell'issue #20. Nessuna decisione precedente copre come integrare il fornitore: gli altri client esterni del prodotto (Google Books, Open Library, Wikidata, Wikipedia) parlano tutti HTTP diretto via `httpx`, senza SDK dedicati, ma il fornitore di modelli non era ancora stato implementato quando quelle scelte sono state prese. Il PRD fissa "nessun tetto di spesa impostato nel sistema: il controllo è manuale, fuori dal prodotto" e non specifica timeout né politiche di ripetizione per questo fornitore, a differenza del limite di cortesia documentato per Open Library.

## Decisione
Il client (`app/cataloghi/llm.py`) chiama l'endpoint REST di OpenAI con `httpx` nudo, come ogni altro client di questo pacchetto, riusando `FonteNonRaggiungibileError` per rete/timeout/5xx/quota/chiave assente — i gestori in `app/lavori/` la catturano e la rilanciano come `ErroreTransitorio`, esattamente come già fanno con Wikidata e Wikipedia. Timeout di 20 secondi (più largo delle fonti bibliografiche, 8-15s: generare una risposta strutturata richiede sistematicamente più tempo di un lookup). Nessun ritentativo lato client: vive già nel worker (30s/120s/600s, `MAX_TENTATIVI=3`, ADR 0016). Un JSON malformato o fuori schema è trattato come fonte irraggiungibile, mai come un tentativo di "salvare" un output non valido. Nessun tetto di spesa applicativo, coerente con la scelta esplicita del PRD di lasciare quel controllo fuori dal prodotto.

Le funzioni bibliografiche inviano solo dato di catalogo condiviso, mai contenuto di un Utente (regola 19): titolo, autori e soggetti per la classificazione/deduzione; nomi e varianti d'autore già presenti in `autore_nome_variante` per la riconduzione; titolo, autori e descrizione di `libro_descrizione` per la deduplicazione. Nessuna di queste tre chiamate legge mai `voce_di_libreria`, `lettura`, `insight` o `recensione` — la regola è rispettata per costruzione dell'accesso ai dati dei gestori che le invocano, non per una verifica a runtime dentro il client.

## Alternative scartate
**L'SDK ufficiale `openai`.** Structured output e ripetizione integrati, ma introduce uno stile diverso da ogni altro client del pacchetto e una dipendenza in più da tenere aggiornata, per un vantaggio che l'endpoint REST offre comunque tramite `response_format` — la garanzia di JSON strutturato è una funzione dell'API, non dell'SDK.

**Un tetto di spesa applicativo (conteggio token, limite giornaliero).** Coerente con la prudenza generale del prodotto, ma il PRD lo esclude esplicitamente per questo fornitore ("nessun tetto di spesa impostato nel sistema"): aggiungerne uno qui contraddirebbe una scelta di prodotto già presa, non colmerebbe una lacuna.

## Conseguenze
Il modulo resta nello stesso stile di `google_books.py`/`open_library.py`/`wikidata.py`/`wikipedia.py`: chi legge uno sa leggere tutti. La spesa sulle chiamate al modello resta senza tetto tecnico, sorvegliata manualmente come già previsto dal PRD per l'intero fornitore — non solo per le funzioni di questa issue. Invertire la decisione (adottare l'SDK) significa riscrivere `_chiama` e i tre schemi di risposta, non i tre gestori in `app/lavori/` che la usano: l'interfaccia tipizzata (`classifica_e_deduci`, `confronta_autori`, `valuta_duplicati`) resta la stessa.
