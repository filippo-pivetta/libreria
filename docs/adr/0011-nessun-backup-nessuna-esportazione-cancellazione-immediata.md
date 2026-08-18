# 0011. Nessun backup, nessuna esportazione, cancellazione immediata

Stato: accettata
Data: 2026-08-17

## Contesto
Il piano gratuito della piattaforma dati non include backup né ripristino a un istante preciso. Il prodotto prevede la cancellazione autonoma dell'account dalle impostazioni, immediata e senza periodo di grazia. L'esportazione dei dati non fa parte di questa versione. Il contenuto più prezioso del prodotto sono gli insight, testi scritti a mano e non ricostruibili.

## Decisione
Il prodotto non offre esportazione, non dispone di backup e cancella immediatamente e definitivamente i dati di chi elimina il proprio account.

## Alternative scartate
**Periodo di grazia prima della cancellazione definitiva.** Costa poco e protegge dagli errori, ma è stato valutato non necessario per un gruppo di poche persone.

**Esportazione offerta al momento della cancellazione.** Coprirebbe anche la portabilità, ma richiede di costruire l'esportazione, che è fuori dall'ambito di questa versione.

## Conseguenze
Diventa più facile costruire e mantenere il sistema, che non ha alcun percorso di uscita da progettare. Diventa più difficile qualsiasi recupero: un errore, una cancellazione involontaria o un guasto della piattaforma non hanno rimedio, e il diritto alla portabilità resta scoperto anche come procedura manuale. Invertire la decisione in futuro non recupera i dati già persi.
