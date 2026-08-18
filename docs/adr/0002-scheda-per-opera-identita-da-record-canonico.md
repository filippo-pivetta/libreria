# 0002. Il catalogo ha una scheda per opera, con identità presa dal record canonico

Stato: accettata
Data: 2026-08-17

## Contesto
Le fonti bibliografiche disponibili trattano il libro in due modi diversi: una espone un record di opera distinto dalle edizioni, l'altra tratta ogni volume come entità a sé. Il difetto più segnalato dagli utenti delle applicazioni concorrenti è la proliferazione di edizioni duplicate, che gonfia le statistiche e rende illeggibili le liste. Il PRD richiede che due lettori della stessa opera in edizioni o traduzioni diverse ricadano sulla stessa scheda, e che il numero di pagine possa comunque differire tra loro.

## Decisione
Il sistema conserva una sola scheda per opera, la cui identità è l'identificativo dell'opera del catalogo canonico risolto dall'ISBN o da titolo e autore, con identificativo proprio e marcatura di non canonicalizzazione quando il catalogo non lo fornisce; il riconoscimento di una scheda esistente avviene su quell'identificativo e mai sul titolo.

## Alternative scartate
**Una scheda per edizione.** Dà numeri di pagina esatti e nessuna ambiguità di risoluzione, ma frammenta voti, recensioni e statistiche della stessa opera tra edizioni diverse, che è il difetto che si voleva evitare.

**Identità dedotta da titolo e autore normalizzati.** Non richiede una fonte canonica, ma unisce opere diverse con lo stesso titolo e separa traduzioni con titoli diversi, cioè sbaglia esattamente nei due casi che contano.

## Conseguenze
Diventa più facile confrontare le librerie e mantenere metriche coerenti tra utenti. Diventa più difficile la fase di aggiunta, perché ogni volume trovato sulla fonte primaria va risolto verso l'opera, e restano casi in cui la risoluzione fallisce e nascono duplicati da fondere fuori banda. Invertire la decisione significa ricostruire l'identità di tutte le schede e riassegnare ogni voce di libreria.
