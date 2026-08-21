# 0010. Le copertine vengono conservate localmente

Stato: accettata
Data: 2026-08-17

## Contesto
Le copertine sono immagini editoriali di terzi, servite dai cataloghi con qualità molto diversa tra loro: misurato, il catalogo con i termini d'uso più aperti serve al più 500px di lato lungo, sotto la specifica del prodotto (600px per la versione grande); un altro ne serve fino a 1652x2478. Il prodotto gira su piani gratuiti con spazio file limitato, non è accessibile senza autenticazione, non è indicizzabile ed è a uso interno di una cerchia chiusa.

## Decisione
Le copertine vengono recuperate una volta alla nascita della scheda, convertite in due formati e conservate dal sistema, preferendo la fonte con la qualità migliore.

## Alternative scartate
**Puntare all'immagine remota.** Non occupa spazio e non ridistribuisce nulla, ma rende ogni schermata dipendente da un servizio esterno e lascia buchi quando la fonte cambia indirizzo o rimuove l'immagine.

**Nessuna copertina.** Elimina spazio e questione legale, ma toglie l'elemento che rende riconoscibile una libreria a colpo d'occhio.

## Conseguenze
Diventa più facile avere un'interfaccia veloce e indipendente. Diventa più difficile la gestione dello spazio, perché le immagini sono la voce più pesante e crescono con il catalogo condiviso. Invertire la decisione significa cancellare le immagini conservate e tornare a dipendere dalle fonti.
