# Rimandato dalla revisione di Lettori e libreria di un collegato (20 agosto 2026)

La scheda "Annali" nella barra contestuale di un collegato (`docs/design-frontend.md` §15,
route `/lettori/[id]/annali`) è visibile e cliccabile, ma mostra solo un messaggio onesto: le
sue metriche non esistono ancora. Non è un'issue GitHub — è la lista da ridarmi quando si apre
Metriche di lettura (issue #7), per completare quella scheda senza reinventarla da zero.

Riferimento visivo: il file HTML fornito a corredo della revisione (mockup statico con dati
finti), sezione "i suoi Annali", tab `data-tab="ann"`. Riferimento di specifica: `docs/design-
frontend.md` §14 "Annali", che descrive già per intero le PROPRIE metriche (selettore ad anno,
una carta per blocco, il limite accanto a ogni numero, le classifiche a cinque voci con "mostra
tutte", la spiegazione della divergenza a cavallo d'anno) — quella specifica vale identica
anche per le metriche del collegato mostrate qui, non va riscritta. Sotto solo ciò che è
**in più** rispetto a guardare le proprie: il confronto.

## 1. Le sue metriche, mostrate a te

Bloccato su: nessuna metrica esiste ancora, né propria né altrui — Metriche di lettura (issue
#7) non è stata costruita.

Da fare quando #7 esiste: la vista Annali di un collegato è la stessa card che vedi per te
stesso (stesso componente, stessi piani, stessa tipografia — `docs/design-frontend.md` §14 lo
impone esplicitamente: "un secondo sistema visivo per gli stessi dati raddoppierebbe il lavoro
e dimezzerebbe il riconoscimento"), calcolata sui dati del collegato invece che sui tuoi. Serve
lato backend una rotta che accetti l'anno e l'id del collegato invece che solo l'anno — verosi-
milmente `GET /utenti/{utente_id}/metriche?anno=` a fianco di qualunque `GET /metriche?anno=`
issue #7 introdurrà per le proprie, con lo stesso payload. La visibilità è già garantita dalla
RLS di collegamento (nessuna riga di lettura è raggiungibile senza un collegamento attivo,
issue #3): questa rotta va comunque protetta esplicitamente come `GET /utenti/{id}/voci`
(403 `non_collegato` distinto da 404 utente inesistente), per lo stesso motivo già scritto lì.

## 2. "Rispetto a te" — l'affiancamento, non il punteggio

Bloccato su: punto 1 (nessuna metrica, propria o altrui, da affiancare).

Da fare quando #7 esiste: una seconda carta accanto a "Quest'anno", con gli stessi due numeri
(libri finiti, pagine lette) ma i **tuoi**, dello stesso anno selezionato. È un affiancamento,
non una classifica: niente percentuali di affinità, niente "hai letto più o meno di", niente
badge — il PRD esclude esplicitamente ogni classifica fra utenti (fuori scope: "nessuna
interazione sociale oltre la visione reciproca... nessuna classifica"). Serve solo che la tua
rotta metriche personale sia interrogabile per lo stesso anno che stai guardando sul
collegato, lato frontend, in parallelo alla rotta del punto 1 — nessun nuovo endpoint per
questo pezzo, il backend restituisce sempre le metriche di un solo utente alla volta.

## 3. Autori e generi più letti del collegato

Bloccato su: punto 1.

Da fare quando #7 esiste: le stesse due classifiche a cinque voci di `design-frontend.md` §14,
calcolate sui dati del collegato — nessuna variazione di formato, stesso componente riusato.

## 4. Libri letti in comune, con i voti affiancati

Bloccato su: punto 1, più il voto in stelle (campo già esistente su `voce_di_libreria`, quindi
non bloccato da issue #5, a differenza di recensioni/insight).

Da fare quando #7 esiste: una striscia orizzontale di copertine — non uno scaffale, è un
confronto fra due persone su un insieme di opere, non un ripiano di libri di uno solo — con,
sotto ogni copertina, il tuo voto e il suo affiancati. L'insieme è l'intersezione dei
`libro_id` fra le due librerie: la stessa intersezione già calcolata oggi per il conteggio "N
in comune" nell'intestazione della libreria (`frontend/src/app/(protected)/lettori/[id]/
page.tsx`) — quel calcolo va spostato/riusato qui, non riscritto, quando questa scheda avrà
bisogno anche dei voti e non solo del conteggio.

## 5. Cosa NON aggiungere

Il mockup di riferimento non propone nulla di tutto questo, ed è bene non inventarlo in corso
d'opera quando si costruisce #7: nessun punteggio di affinità, nessuna classifica fra utenti,
nessun'altra metrica trasversale a più collegati contemporaneamente (l'unica vista è sempre "tu
e una persona alla volta"). Il PRD non prevede un grafo sociale.
