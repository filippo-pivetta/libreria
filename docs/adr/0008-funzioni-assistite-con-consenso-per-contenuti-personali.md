# 0008. Le funzioni assistite usano un fornitore esterno, con consenso solo per i contenuti personali

Stato: accettata
Data: 2026-08-17

## Contesto
Il PRD prevede otto funzioni assistite da modello. Tre lavorano su soli dati bibliografici e agiscono su dati condivisi da tutti; cinque toccano testi scritti dagli utenti, inclusi quelli lasciati privati. Le note di intenzione contengono abitualmente nomi di persone che non usano l'applicazione e non hanno prestato alcun consenso.

## Decisione
Le funzioni assistite si appoggiano a un fornitore esterno di modelli; le tre bibliografiche sono sempre attive, le cinque personali sono subordinate a un consenso revocabile dell'utente, e le note di intenzione non escono mai in nessuno stato del consenso.

## Alternative scartate
**Nessun consenso, tutto sempre attivo.** Più semplice, ma invia contenuti privati a un terzo senza che l'utente abbia scelto, e rende impossibile tornare indietro.

**Consenso richiesto per singola funzione.** Più granulare, ma moltiplica le decisioni chieste all'utente per una differenza che nella pratica è una sola: se i propri testi escono o no.

**Modelli ospitati in proprio.** Nessun dato uscirebbe, ma richiede infrastruttura e manutenzione fuori scala rispetto a un progetto personale su piani gratuiti.

## Conseguenze
Diventa più facile aggiungere funzioni personali, che ereditano un consenso già definito. Diventa più difficile garantire la revoca in senso pieno, perché ciò che è già stato inviato non è richiamabile, e ogni funzione futura deve dichiarare da che parte del confine sta. Invertire la decisione significa spegnere le funzioni o cambiare fornitore, con ricostruzione completa degli indici semantici.
