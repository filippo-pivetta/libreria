# 0001. Tutti gli accessi ai dati passano dal back end, con regole di riga nel database

Stato: accettata
Data: 2026-08-17

## Contesto
Nove delle trentadue regole invalicabili del PRD riguardano chi può vedere o scrivere cosa. Gli indici della ricerca semantica sono una copia derivata di contenuti privati, e la regola 24 impone loro le stesse regole di accesso dei contenuti da cui derivano. La piattaforma dati consente sia l'accesso diretto dal front end sia l'accesso da un back end, e mette a disposizione una chiave di servizio che non valuta le regole di riga. Gran parte delle letture del prodotto non sono letture semplici: le metriche sono aggregazioni con pesi ripartiti, la ricerca interroga prima il catalogo locale e poi due fonti esterne, la ricerca semantica passa da un embedding generato presso un fornitore. Le chiavi dei cataloghi e del fornitore di modelli non possono stare nel browser.

## Decisione
Ogni accesso ai dati passa dal back end, le regole di riga sono attive su tutte le tabelle con negazione per default, e le richieste che nascono da un utente vengono eseguite con la sua identità impostata sulla transazione; la chiave di servizio è riservata ai lavori in secondo piano, che non servono richieste di utenti.

## Alternative scartate
**Front end che parla direttamente al database.** Elimina un salto e sfrutta le regole di riga senza lavoro aggiuntivo, ma lascia fuori tutte le operazioni che richiedono chiavi segrete e logica applicativa, che qui sono la maggioranza, e produce due percorsi di accesso da mantenere allineati.

**Back end che si collega con la chiave di servizio e filtra nel codice.** È il percorso più comodo e il più diffuso, ma le regole di riga non vengono mai valutate: la garanzia torna a dipendere dal fatto che ogni interrogazione, presente e futura, ricordi il filtro. Su un prodotto con contenuti privati e con una ricerca vettoriale è il punto in cui prima o poi si perde un dato.

**Ibrido: letture dal front end, scritture dal back end.** Sfrutta il meglio dei due, ma raddoppia i percorsi di accesso e le superfici da verificare, per risparmiare su letture che qui sono poche.

## Conseguenze
Diventa più facile aggiungere funzionalità senza reintrodurre falle: una vista dimenticata non restituisce righe altrui. Diventa più difficile scrivere endpoint banali, che vanno comunque implementati, e la gestione delle connessioni si complica perché l'identità va impostata a ogni transazione invece di riusare un collegamento privilegiato. Invertire la decisione significa riscrivere ogni accesso ai dati e riportare nel codice applicativo tutte le regole oggi espresse una volta sola.
