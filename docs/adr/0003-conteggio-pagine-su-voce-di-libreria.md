# 0003. Il conteggio delle pagine vive sulla voce di libreria e si alimenta di avanzamenti datati

Stato: accettata
Data: 2026-08-17

## Contesto
Il numero di pagine varia legittimamente tra edizioni della stessa opera, e i cataloghi restituiscono valori inaffidabili, incluso il caso degli audiolibri le cui ore finiscono nel campo delle pagine. Il PRD richiede una metrica di pagine lette per periodo e la possibilità di registrare letture in corso, pause e abbandoni.

## Decisione
Il numero di pagine è un attributo della voce di libreria, correggibile dal solo proprietario, e le pagine lette si contano come somma degli incrementi degli avanzamenti datati nel periodo, con un avanzamento finale generato alla chiusura della lettura.

## Alternative scartate
**Pagine sul libro condiviso.** Un solo valore per tutti semplifica i confronti, ma è falso per definizione quando le edizioni differiscono, e una correzione di un utente cambierebbe le metriche di tutti.

**Conteggio in blocco alla sola conclusione, senza avanzamenti.** È più semplice e non richiede alcuna registrazione durante la lettura, ma rende impossibile attribuire le pagine al periodo in cui sono state lette e lascia gli abbandoni senza alcun conteggio.

## Conseguenze
Diventa più facile rappresentare letture reali, riletture e abbandoni con numeri corretti. Diventa più difficile ogni confronto tra lettori sulla stessa opera, perché le basi sono diverse, e il volume delle scritture cresce di un ordine di grandezza rispetto al conteggio a fine libro. Invertire la decisione significa ricalcolare tutte le metriche storiche su una base diversa.
