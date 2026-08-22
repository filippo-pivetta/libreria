# Rimandato dal redesign di Libreria e Scheda (20 agosto 2026)

Punti del prompt di redesign (scaffale a volumi + otto correzioni della Scheda) che non
potevano essere implementati in questo intervento, con dove tornare a prenderli. Non è
un'issue GitHub — è la lista da ridarmi quando si apre il lavoro corrispondente.

## 1. Colore dominante per la stanza scura (issue #20, era #4)

**Parzialmente risolto (21 agosto 2026).** Copertine reali, recupero server-side e colore
dominante alla nascita della scheda sono costruiti: `backend/app/lavori/copertine.py`
(Pillow al posto di `sharp-vibrant`, mai deciso — nessuna ragione per una libreria in più
quando `quantize()` basta), colonna `libro.copertina_colore_dominante`,
`frontend/src/lib/spine-color.ts` ora è il ripiego quando quella colonna è nulla, non più la
regola. Le dimensioni `120×180`/`96×144` e le regole 1-4 della sezione 7 di
`docs/design-frontend.md` sono rispettate.

Resta aperto esattamente il punto che questa nota indicava fin dall'inizio: **un solo
esadecimale è stato costruito, non due.** `docs/design-frontend.md` (tabella §3) chiede
"calcolato per la stanza chiara" e "seconda versione calcolata, più desaturata" per la
scura — oggi lo stesso valore serve entrambe. Tracciato in issue #20, punto 5.

## 2. Azioni rapide dal volume, senza aprire il libro

`docs/design-frontend.md` §7, sezione "Rimandato": nella stesura precedente il dorso
sollevato aveva spazio per registrare un avanzamento o cambiare stato con un tocco lungo
(mobile), senza aprire la scheda. Con la copertina vera lo spazio libero sul volume è minore
e il gesto va ridisegnato, non solo riportato. Oggi il volume è solo un link alla scheda.

## 3. Rito di apertura (View Transitions)

`docs/design-frontend.md` §9, sezione "Rito di apertura": animazione di passaggio
dallo scaffale alla scheda (il volume si solleva, la copertina cresce verso la pagina
sinistra), sotto i 400ms, mai al ritorno. Non costruita: oggi il clic sul volume è un link
diretto senza transizione. Già segnalata anche in §23 "Da verificare" come punto da provare
con contenuti veri prima di scriverla in via definitiva.

## 4. Indice a lettere fisso sul bordo dello scaffale

`docs/design-frontend.md` §7, sezione "Rimandato": le tacche fra i volumi (regola 6, già
costruite) risolvono lo stesso problema di orientamento su una libreria di venti-trenta
libri. Un indice fisso sul bordo per saltare direttamente a una lettera resta un possibile
miglioramento su una libreria molto più grande — non necessario ora, non richiesto dal
prompt originale in modo esplicito, solo menzionato come possibile passo successivo.
