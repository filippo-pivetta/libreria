# Rimandato dall'issue #6 — Consenso all'elaborazione assistita (22 agosto 2026)

Il PRD subordina al consenso **cinque** funzioni personali. L'issue #6 ne ha costruite due —
ricerca semantica e preview personalizzata "me lo consigli?" — insieme a tutta l'infrastruttura
del consenso. Le altre tre restano qui. Non è un'issue GitHub: è la lista da ridarmi quando si
apre il lavoro corrispondente.

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

## 1. Suggerimenti di lettura

PRD: "suggerimenti di lettura a partire dal solo storico personale, mai da quello dei
collegati: funzione a sé, che propone cosa leggere". Distinta dalla preview, che dà un parere
su un titolo che indichi tu.

Da decidere in fase di costruzione: dove vivono. Non c'è una schermata nel design doc, e la
navigazione ha quattro voci che il §5 tiene tali — verosimilmente una sezione dello scaffale o
una pagina raggiunta da lì, come `/cerca`. Da chiarire anche se un suggerimento sia un
`artefatto_generato` (e quindi conservato, cancellabile, sopravvivente alla revoca) o un
risultato effimero: il PRD non lo elenca fra gli artefatti, e il CHECK su `tipo` andrebbe
esteso se lo diventasse.

Attenzione: il PRD elenca "Raccomandazioni basate sullo storico, con rifiuto permanente di
titoli e autori e affinità calcolata su chi valuta gli stessi libri allo stesso modo" fra le
cose **post MVP**. I suggerimenti di lettura di questa lista sono la versione semplice, senza
rifiuti permanenti e senza affinità fra utenti — che, fra l'altro, leggerebbe dati di altri e
violerebbe la regola 19 così com'è scritta.

## 2. Sintesi tematica

PRD: "sintesi tematica trasversale dei propri insight tra libri diversi". Artefatto con
`voce_id` nullo, già previsto dallo schema.

Il design doc §10 dice dove **non** va: "la vista trasversale è rinviata. Ricerca semantica e
sintesi tematica producono comunque risultati che attraversano più libri, ma una pagina di
risultati non è una vista di navigazione". La pagina `/cerca` costruita dall'issue #6 è il posto
naturale in cui atterrare, o una accanto con la stessa forma.

Da decidere: se la sintesi si genera su tutto o su un sottoinsieme (un anno? un tema chiesto
dall'Utente?), e se rigenerarla sostituisca la precedente o ne accumuli una nuova — oggi
`artefatto_generato` non ha vincolo di unicità e le preview si accumulano, con l'interfaccia che
ne mostra la più recente.

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
