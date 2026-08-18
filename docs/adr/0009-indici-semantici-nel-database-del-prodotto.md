# 0009. Gli indici semantici vivono nel database del prodotto

Stato: accettata
Data: 2026-08-17

## Contesto
La ricerca semantica opera su insight e recensioni, contenuti che possono essere privati. Le regole di accesso vivono nel database come regole di riga. Il volume atteso è nell'ordine delle migliaia di vettori.

## Decisione
Gli embedding sono conservati nello stesso database dei contenuti, soggetti alle stesse regole di riga, senza servizi vettoriali esterni.

## Alternative scartate
**Servizio vettoriale dedicato.** Migliori prestazioni su grandi volumi e più funzioni di ricerca, ma crea una seconda copia dei contenuti privati in forma derivata dentro un sistema con regole di accesso diverse, che è esattamente la superficie che il prodotto vuole evitare.

## Conseguenze
Diventa più facile garantire che una query vettoriale non restituisca contenuti altrui, perché la garanzia è la stessa dei contenuti originali. Diventa più difficile crescere di ordini di grandezza, e lo spazio dei vettori consuma il piano gratuito insieme al resto. Invertire la decisione significa esportare gli indici e ricostruire fuori il modello di autorizzazione.
