# 0011. Nessun backup, esportazione limitata ai libri letti, cancellazione immediata

Stato: accettata

Data: 2026-08-17

## Contesto
Il piano gratuito della piattaforma dati non include backup né ripristino a un istante preciso. Il prodotto prevede la cancellazione autonoma dell'account dalle impostazioni, immediata e senza periodo di grazia. Il contenuto più prezioso del prodotto sono gli insight, testi scritti a mano e non ricostruibili.

**Rivista il 22 agosto 2026 (issue #8).** La versione originale di questa decisione escludeva ogni esportazione, insight compresi. In fase di sviluppo della cancellazione account è emerso che negare anche la sola portabilità dei libri letti — titolo, autori, generi, date, voto, recensione: dati in gran parte già bibliografici o brevi, non il testo lungo che l'ADR voleva proteggere dal costo di costruire un'esportazione — non serviva più lo scopo originale (tenere il sistema semplice) e lasciava senza rimedio un'informazione che l'utente aveva comunque il diritto di portarsi via. La decisione qui sotto è quindi cambiata su questo punto solo: resta tutto il resto, nessun backup e cancellazione immediata senza periodo di grazia.

## Decisione
Il prodotto non dispone di backup e cancella immediatamente e definitivamente i dati di chi elimina il proprio account.

Offre invece un'esportazione limitata: dalle impostazioni, in qualsiasi momento, l'Utente può scaricare in CSV i libri che ha portato a termine (stato "letto") — titolo, autori, generi, anno di prima pubblicazione, lingua originale, pagine adottate, date di inizio e fine dell'ultima lettura conclusa, voto, recensione. Non include insight né nota di intenzione: restano il contenuto scritto a mano che l'ADR originale voleva proteggere dal costo di un'esportazione completa, e la nota di intenzione in particolare contiene abitualmente nomi di terzi che non hanno mai dato consenso a uscire dal prodotto in alcuna forma. Non è un'esportazione dell'account, non sostituisce un backup, e non è offerta all'interno del flusso di cancellazione: è un'azione separata, sempre disponibile, che chi vuole portarsi via qualcosa prima di cancellare l'account può semplicemente usare per conto proprio.

## Alternative scartate
**Periodo di grazia prima della cancellazione definitiva.** Costa poco e protegge dagli errori, ma è stato valutato non necessario per un gruppo di poche persone.

**Esportazione completa dell'account, insight e nota di intenzione compresi.** Coprirebbe la portabilità per intero, ma richiede di costruire un'esportazione di contenuto libero e non strutturato (insight senza limite di lunghezza) e di decidere come trattare la nota di intenzione, che contiene abitualmente nomi di terzi senza consenso proprio: un ambito più largo di quanto serva per il problema concreto che ha fatto riconsiderare questa decisione. Resta scartata per questa versione, non esclusa in linea di principio.

**Esportazione offerta al momento della cancellazione, come ultimo passo prima di procedere.** Accoppierebbe due azioni che non hanno bisogno di esserlo: l'esportazione è utile in ogni momento, non solo a ridosso di una cancellazione, e complicherebbe la schermata che il design doc vuole deliberatamente semplice (piano 1, nessun allarme, un solo campo di conferma).

## Conseguenze
Diventa più facile costruire e mantenere il sistema, che non ha alcun percorso di uscita per i contenuti scritti a mano da progettare. Diventa più difficile qualsiasi recupero di ciò che l'esportazione non copre: un errore, una cancellazione involontaria o un guasto della piattaforma restano senza rimedio per insight, note di intenzione e ogni altro dato non bibliografico. Chi vuole portarsi via un libro letto può farlo da sé in ogni momento, ma nessuno lo ricorda per lui: un utente che cancella l'account senza aver mai esportato nulla perde comunque tutto, compresi i libri letti. Invertire la decisione in futuro non recupera i dati già persi.
