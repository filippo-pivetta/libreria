# 0004. Le metriche si calcolano a ogni richiesta e non vengono mai conservate

Stato: accettata
Data: 2026-08-17

## Contesto
Le metriche dipendono da dati che cambiano dopo essere stati consultati: correzioni del numero di pagine, avanzamenti aggiunti in ritardo, riletture. La scala attesa è di unità o decine di utenti con decine di libri l'anno ciascuno, e le metriche si leggono molto più spesso di quanto i dati cambino.

## Decisione
Le metriche sono derivate: si calcolano dai dati di lettura a ogni richiesta, senza alcuna fotografia periodica.

## Alternative scartate
**Fotografia di fine anno.** Rende i totali passati immutabili e le letture istantanee, ma crea due verità che divergono a ogni correzione successiva e impone una procedura di rigenerazione da decidere e testare.

**Aggregati mantenuti aggiornati a ogni scrittura.** Elimina il costo di calcolo in lettura, ma introduce lo stesso rischio di divergenza e complica ogni cancellazione o correzione.

## Conseguenze
Diventa più facile mantenere i numeri coerenti con i dati, senza invalidazioni. Diventa più difficile crescere di scala, perché ogni consultazione ricalcola, e diventa necessario introdurre un'istantanea nel momento in cui servirà una card di recap condivisibile, che per natura deve restare ferma dopo la condivisione. Invertire la decisione significa introdurre la doppia verità che qui si è deliberatamente evitata.
