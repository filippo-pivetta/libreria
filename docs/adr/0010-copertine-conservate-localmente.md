# 0010. Le copertine vengono conservate localmente

Stato: accettata
Data: 2026-08-17

## Contesto
Le copertine sono immagini editoriali di terzi, servite dai cataloghi con termini d'uso diversi tra loro. Il prodotto gira su piani gratuiti con spazio file limitato, non è accessibile senza autenticazione e non è indicizzabile.

## Decisione
Le copertine vengono recuperate una volta alla nascita della scheda, convertite in due formati e conservate dal sistema, preferendo la fonte con i termini d'uso più aperti.

## Alternative scartate
**Puntare all'immagine remota.** Non occupa spazio e non ridistribuisce nulla, ma rende ogni schermata dipendente da un servizio esterno e lascia buchi quando la fonte cambia indirizzo o rimuove l'immagine.

**Nessuna copertina.** Elimina spazio e questione legale, ma toglie l'elemento che rende riconoscibile una libreria a colpo d'occhio.

## Conseguenze
Diventa più facile avere un'interfaccia veloce e indipendente. Diventa più difficile la gestione dello spazio, perché le immagini sono la voce più pesante e crescono con il catalogo condiviso, e si assume una zona grigia contrattuale mitigata solo dalla chiusura del perimetro. Invertire la decisione significa cancellare le immagini conservate e tornare a dipendere dalle fonti.
