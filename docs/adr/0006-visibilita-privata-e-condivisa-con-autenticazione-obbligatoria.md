# 0006. Nulla è visibile fuori dalla cerchia dei collegati, e nulla è accessibile senza autenticazione

Stato: accettata
Data: 2026-08-17

## Contesto
Il prodotto serve un gruppo chiuso di lettori che si conoscono. Gli insight contengono estratti e riflessioni personali, e le note di intenzione citano abitualmente persone che non usano l'applicazione. Le copertine conservate localmente sono materiale editoriale di terzi.

## Decisione
La visibilità ha due soli livelli, privato e condiviso con i soli utenti collegati; nessun contenuto, nessuna metrica e nessun file conservato dal sistema è raggiungibile senza autenticazione, e nessuna pagina è indicizzabile.

## Alternative scartate
**Un livello pubblico sul web, indicizzabile.** Darebbe distribuzione ai contenuti e una presenza online, ma introduce identità pubbliche, moderazione, questioni di copyright sugli estratti, e rende irreversibile ogni pubblicazione perché le cache esterne non si ritirano.

**Un livello visibile a tutti gli utenti registrati.** Coincide con la cerchia finché gli account li crea una sola persona, ma cambia significato nel momento in cui la registrazione si apre, allargando il pubblico di contenuti già scritti senza che il proprietario tocchi nulla.

## Conseguenze
Diventa più facile scrivere liberamente e ragionare sulla privacy con una sola regola. Diventa più difficile qualsiasi crescita o scoperta esterna, e la posizione sulle copertine dipende da questa chiusura. Invertire la decisione significa rivedere il modello di visibilità, introdurre identità pubbliche e riconsiderare la conservazione delle immagini.
