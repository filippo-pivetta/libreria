# 0016. I lavori in secondo piano vivono su una coda nel database

Stato: accettata
Data: 2026-08-21

## Contesto
Quattro operazioni previste dal PRD non stanno dentro il tempo di una richiesta e devono dichiarare uno stato osservabile: recupero e conversione delle copertine, ricostruzione degli indici semantici, riconduzione degli autori, deduplicazione. Il prodotto gira su piani gratuiti, che di norma concedono un solo servizio distribuibile, e su un back end ospitato con indirizzo di uscita stabile, quindi su un processo persistente e non su un ambiente serverless. La prima di quelle operazioni tocca dato condiviso di catalogo, dove un fallimento non ripreso resta visibile a tutti gli Utenti finché qualcuno non lo ripara a mano.

## Decisione
I lavori in secondo piano sono righe di una tabella del database applicativo, prese in carico con `for update skip locked` da un worker che gira dentro il processo del back end e resta scritto come modulo indipendente; lo stato che il prodotto mostra non si legge dalla coda ma dall'entità a cui il lavoro si riferisce. La coda e le scritture di catalogo passano da una connessione diretta a Postgres, non dal Data API con la chiave di servizio.

## Alternative scartate
**Le attività in secondo piano di FastAPI.** Dieci righe e nessuna infrastruttura, ma il lavoro muore con il processo, non si ripete, non ha stato e non ha un tetto alla concorrenza: un deploy durante una conversione perde la copertina per sempre, su un dato condiviso e con una regola che vieta i ritentativi automatici.

**Un servizio separato fin da subito.** Isola del tutto la CPU delle conversioni dalla latenza dell'API, ma è un secondo distribuibile su piani che ne concedono uno, e lo stesso codice lo consente in qualunque momento cambiando solo il punto d'ingresso.

**Una coda dedicata.** Ritentativi e osservabilità già pronti, ma aggiunge un sistema con regole di accesso proprie accanto a un database che già offre l'esclusione che serve, e che alla scala attesa non è sotto pressione.

**La chiave di servizio sul Data API per scrivere il catalogo.** Sarebbe stata la via più corta, ma `for update skip locked` non è esprimibile senza esporre al Data API una funzione che nessun Utente deve poter invocare, la nascita di una scheda tocca cinque tabelle e vuole essere atomica, e sul database reale il ruolo di servizio non ha comunque i privilegi di scrittura sulle tabelle applicative.

## Conseguenze
Diventa più facile garantire che un lavoro perso venga ripreso, che due processi non lo eseguano due volte e che un fallimento sia visibile dove l'Utente lo cerca; e la chiave di servizio resta confinata allo spazio file, senza toccare alcuna riga. Diventa più difficile isolare il costo di CPU delle conversioni dalla latenza dell'API finché il worker condivide il processo, e la coda va sorvegliata a mano, perché non ha alcuna interfaccia dentro il prodotto. Invertire la decisione significa svuotare la coda e riscrivere ogni gestore attorno al meccanismo che la sostituisce.
