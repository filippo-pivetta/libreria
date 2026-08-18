# 0005. Generi, autori e titoli hanno identità stabili separate dalle parole

Stato: accettata
Data: 2026-08-17

## Contesto
Le metriche di autori e generi devono restare confrontabili tra anni e tra utenti. L'interfaccia è bilingue, e le lingue supportate possono cambiare. I cataloghi restituiscono nomi d'autore in forme diverse per la stessa persona e titoli diversi per la stessa opera in lingue diverse.

## Decisione
Genere, autore e titolo hanno un'identità stabile a cui puntano i libri, mentre le parole che l'utente legge sono etichette o varianti separate, ciascuna con la propria lingua, aggiungibili e modificabili senza toccare alcun libro.

## Alternative scartate
**Colonne fisse per lingua.** Immediate da scrivere, ma cablano le lingue nella struttura: aggiungerne o toglierne una diventa una modifica strutturale, e ogni opera priva di quella lingua porta una casella vuota.

**Stringhe salvate direttamente sui libri.** Nessuna struttura aggiuntiva, ma rinominare un genere richiederebbe di riscrivere ogni libro che lo usa, e le metriche degli anni passati resterebbero legate alla vecchia parola.

## Conseguenze
Diventa più facile cambiare etichette, aggiungere lingue e mantenere metriche stabili nel tempo. Diventa più difficile ogni ricerca testuale, che deve attraversare le varianti, e nasce il bisogno di ricondurre a identità i nomi d'autore, operazione che agisce su dato condiviso e va resa reversibile. Invertire la decisione significa appiattire le identità in stringhe e perdere la stabilità storica delle metriche.
