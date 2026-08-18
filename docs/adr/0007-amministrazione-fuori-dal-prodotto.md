# 0007. L'amministrazione vive fuori dal prodotto

Stato: accettata
Data: 2026-08-17

## Contesto
Gli account vengono creati a mano per un gruppo di poche persone. Servono comunque operazioni di manutenzione: correzione dei generi, creazione di schede assenti dai cataloghi, fusione di duplicati, gestione dell'elenco chiuso dei generi.

## Decisione
Il prodotto non contiene alcuna funzione amministrativa né alcun account privilegiato: tutte le operazioni di manutenzione avvengono sulla piattaforma dati, fuori dall'applicazione.

## Alternative scartate
**Un ruolo amministratore nell'applicazione.** Rende le correzioni comode e tracciabili, ma introduce un account con poteri superiori, quindi una superficie da proteggere e un'eccezione dentro ogni regola invalicabile sull'accesso.

**Correzioni aperte a tutti gli utenti.** Elimina il collo di bottiglia, ma su dati condivisi significa che l'errore di uno cambia le librerie di tutti.

## Conseguenze
Diventa più facile mantenere le regole di accesso senza eccezioni, e la cancellazione dell'account personale del manutentore non toglie nulla al sistema. Diventa più difficile la manutenzione, che dipende dalla disponibilità di una persona sola, e gli utenti non hanno alcuna leva sulle correzioni. Invertire la decisione significa introdurre ruoli e riscrivere le regole che oggi affermano l'assenza di privilegi.
