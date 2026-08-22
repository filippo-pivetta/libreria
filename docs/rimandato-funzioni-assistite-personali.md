# Rimandato dall'issue #6 — Consenso all'elaborazione assistita (22 agosto 2026)

Il PRD subordina al consenso **cinque** funzioni personali. L'issue #6 ne ha costruite due —
ricerca semantica e preview personalizzata "me lo consigli?" — insieme a tutta l'infrastruttura
del consenso. Le altre tre erano tracciate qui sotto **issue #27**, che ne ha costruite altre
due (**suggerimenti di lettura**, §1, e **sintesi tematica**, §2 — dettagli in design-frontend.md
§26 e §27) lasciando fuori, per scelta esplicita, la terza. Resta aperta solo:

- **§3, acquisizione di una citazione da foto** — nessuna issue la traccia ancora.

Le sezioni 1 e 2 restano sotto per riferimento storico (cosa si è deciso e perché), non perché
ci sia ancora lavoro da aprire.

Cosa esiste già e non va rifatto:

- **Il cancello.** `app/services/consenso.py::esigi_consenso` è l'unico punto che legge
  l'interruttore; ogni router lo chiama per primo e mappa `ConsensoRevocatoError` su 409
  `consenso_revocato`. Una funzione nuova eredita tutto chiamandolo.
- **Il modulo dei prompt personali.** `app/cataloghi/llm_personale.py`, con il docstring che
  dichiara l'invariante da rispettare (solo contenuti del richiedente, mai la nota di
  intenzione). Il trasporto è `openai_client.py`: `chiama_json` per una risposta strutturata,
  `chiama_embedding` per i vettori.
- **La raccolta del contesto.** `app/repositories/preview_repository.py` legge già storico
  personale e testi propri, filtrati esplicitamente per `utente_id` e senza mai toccare
  `voce_di_libreria_privata`. I suggerimenti di lettura hanno bisogno esattamente di quei due
  insiemi.
- **La tabella degli artefatti.** `artefatto_generato.tipo` ammette già
  `'sintesi_tematica'`, con `voce_id` nullo per costruzione (`chk_artefatto_generato_voce_coerente`):
  la sintesi non richiede alcuna migrazione di schema.
- **Il doppio test.** `backend/tests/test_preview.py` contiene il test della regola 19 fatto
  sul corpo HTTP reale; `supabase/tests/verifica_consenso_e_indici.sql` copre il lato database.

## 1. Suggerimenti di lettura — costruita nell'issue #27

PRD: "suggerimenti di lettura a partire dal solo storico personale, mai da quello dei
collegati: funzione a sé, che propone cosa leggere". Distinta dalla preview, che dà un parere
su un titolo che indichi tu.

Deciso in costruzione: **effimeri**, non un `artefatto_generato` — il PRD non li elenca fra gli
artefatti, e ogni richiesta ne genera di nuovi senza conservare i precedenti (nessuna estensione
del CHECK su `tipo`). Vivono in una pagina a sé, `/suggerimenti`, raggiunta da un collegamento
nella riga dei filtri dello scaffale — non una sezione della Libreria, non una voce di menu.

**Riscritti lo stesso giorno**, dopo un primo giro d'uso: la prima versione mandava al modello
uno storico piatto (libri finiti, senza gerarchia) e non verificava i titoli, con il risultato
di un titolo mai esistito arrivato all'Utente. La versione costruita usa un **profilo in tre
gruppi** — libri amati (voto ≥ 4, qualsiasi età), letture più recenti (per `lettura.data_fine`
vera, qualsiasi voto), libri non piaciuti o abbandonati (voto ≤ 2,5 o stato "abbandonato", mai
usati per proporre libri simili) — ed **esclude ogni Voce già in libreria in qualunque stato**,
non solo "letto" come nella prima versione. Ogni titolo proposto si **verifica** contro i
cataloghi lato server prima di uscire (sovra-generazione: si chiedono fino a otto candidati per
poterne scartare alcuni e uscire comunque con cinque), con un tetto di due titoli per stesso
autore. Ogni proposta è etichettata "affine" o "scoperta" dal modello. Dettagli in
design-frontend.md §26 e nel docstring di `app/services/suggerimenti_service.py`.

Attenzione: il PRD elenca "Raccomandazioni basate sullo storico, con rifiuto permanente di
titoli e autori e affinità calcolata su chi valuta gli stessi libri allo stesso modo" fra le
cose **post MVP**. I suggerimenti di lettura di questa lista sono la versione semplice, senza
rifiuti permanenti e senza affinità fra utenti — che, fra l'altro, leggerebbe dati di altri e
violerebbe la regola 19 così com'è scritta.

## 2. Sintesi tematica — costruita nell'issue #27

PRD: "sintesi tematica trasversale dei propri insight tra libri diversi". Artefatto con
`voce_id` nullo, già previsto dallo schema.

Il design doc §10 dice dove **non** va: "la vista trasversale è rinviata. Ricerca semantica e
sintesi tematica producono comunque risultati che attraversano più libri, ma una pagina di
risultati non è una vista di navigazione". Non è atterrata su `/cerca`: ha una pagina a sé,
`/sintesi`, con la stessa forma di ingresso di `/suggerimenti`.

Deciso in costruzione: si genera **su tutti** gli insight e le recensioni proprie, nessun
sottoinsieme per anno o tema — non richiesto dal design doc, e avrebbe aggiunto una superficie
di scelta senza una specifica. Rigenerarla **sostituisce** la precedente invece di accumularne
una nuova: a differenza della preview, per cui più pareri nel tempo hanno senso, "la sintesi
della mia libreria" è più vicina a un singolo stato che si aggiorna — esiste al più una sintesi
per utente, cancellata solo dopo che la nuova è pronta.

**Riscritta lo stesso giorno, dopo un primo giro d'uso.** La prima versione (un unico paragrafo
generato, duecento parole, stessa disciplina della regola 20 della preview) si è rivelata poco
utile: non verificabile, senza un posto dove andare, senza ragione di essere riletta. La
versione costruita è un **elenco di temi**, ciascuno con: un nome, una frase che lo descrive
(stessa disciplina di forma, ora per riga — venticinque parole invece di duecento — non
sull'intero testo), i libri distinti da cui viene (collegati alla loro scheda), e su richiesta
gli insight/recensioni veri che l'hanno prodotto. Un tema sostenuto da un solo libro non è
"trasversale ... tra libri diversi" (PRD) e viene scartato — se dopo il filtro non ne resta
nessuno, non si genera né sostituisce nulla: meglio nessuna sintesi che una vuota o inventata.
Dettagli in design-frontend.md §27.

## 3. Acquisizione di una citazione da foto

PRD: "acquisizione di una citazione da foto della pagina, tramite modello visivo in un'unica
passata invece di OCR seguito da ripulitura". E, sull'entità Foto della pagina: "Viene inviata
al fornitore, usata per produrre il testo e poi eliminata: il sistema non la conserva, quindi
non pesa sullo spazio immagini e non compare in alcuna vista. Ciò che resta è l'insight che ne
è nato."

Conseguenza pratica: **non serve nulla in `app/core/storage.py`**, che è specifico delle
copertine. L'immagine attraversa il processo in memoria — `UploadFile` di FastAPI — esce verso
il fornitore e viene dimenticata. Nessuna riga di database, nessun bucket, nessun lavoro in
secondo piano: sta dentro il tempo di una richiesta.

Da costruire: un endpoint `multipart/form-data` (l'unico del prodotto), un limite di dimensione
esplicito, e la chiamata a un modello visivo — che `openai_client.chiama_json` non copre così
com'è, perché richiede un messaggio con parti immagine. Il PRD fissa l'esito negativo: "Foto
della pagina illeggibile: nessun testo inventato, errore esplicito". Lato interfaccia non
esiste specifica: va progettata insieme al design doc, come è stato fatto per §25.

## E una cosa che non è una funzione

**Cancellazione dell'account con operazioni assistite in corso** (PRD, caso limite): "le
richieste pendenti al fornitore di modelli non devono poter scrivere dati su un account che non
esiste più". I due gestori dell'issue #6 lo rispettano già — escono in silenzio quando
`consenso_attivo` restituisce `None`, cioè quando la riga `utente_privato` non c'è più — ma la
cancellazione dell'account è l'issue #8 e non è costruita. Quando lo sarà, vale la pena
ripercorrere ogni gestore con la stessa domanda.
