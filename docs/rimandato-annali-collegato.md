# Rimandato dalla revisione di Lettori e libreria di un collegato (20 agosto 2026)

**Risolto nell'issue #7 (22 agosto 2026).** Tutti e cinque i punti sotto sono stati costruiti
insieme a Metriche di lettura, invece che in un intervento successivo come questa nota
prevedeva in origine: `GET /metriche` e `GET /utenti/{id}/metriche` (backend), la scheda Annali
propria e quella del collegato (frontend), con l'affiancamento e i libri in comune. File
lasciato come riferimento storico di cosa è stato costruito e perché, non più una lista aperta.

La scheda "Annali" nella barra contestuale di un collegato (`docs/design-frontend.md` §15,
route `/lettori/[id]/annali`) era visibile e cliccabile, ma mostrava solo un messaggio onesto:
le sue metriche non esistevano ancora. Non era un'issue GitHub — era la lista da ridare quando
si apriva Metriche di lettura (issue #7), per completare quella scheda senza reinventarla da
zero.

Riferimento visivo: il file HTML fornito a corredo della revisione (mockup statico con dati
finti), sezione "i suoi Annali", tab `data-tab="ann"`. Riferimento di specifica: `docs/design-
frontend.md` §14 "Annali", che descrive già per intero le PROPRIE metriche (selettore ad anno,
una carta per blocco, il limite accanto a ogni numero, le classifiche a cinque voci con "mostra
tutte", la spiegazione della divergenza a cavallo d'anno) — quella specifica vale identica
anche per le metriche del collegato mostrate qui, non va riscritta. Sotto solo ciò che è
**in più** rispetto a guardare le proprie: il confronto.

## 1. Le sue metriche, mostrate a te

**Costruito.** `GET /utenti/{utente_id}/metriche?anno=` (`backend/app/routers/utenti.py`,
`utenti_service.metriche_di`) a fianco di `GET /metriche?anno=` (`backend/app/routers/
metriche.py`), stesso payload, stessa protezione di `GET /utenti/{id}/voci` (403
`non_collegato` distinto da 404 utente inesistente). Lato frontend, `AnnaliCollegatoPage`
(`frontend/src/app/(protected)/lettori/[id]/annali/page.tsx`) monta `PaginaAnnaliCollegato`,
che passa i dati del collegato a `CarteMetriche` — lo stesso componente usato dalla propria
pagina Annali (`frontend/src/components/annali/carte-metriche.tsx`), invariato.

## 2. "Rispetto a te" — l'affiancamento, non il punteggio

**Costruito.** `CartaQuestAnno` (`frontend/src/components/annali/carta-questanno.tsx`) è lo
stesso componente della carta "Quest'anno", montato una seconda volta con le proprie metriche
dello stesso anno tramite la prop `cartaAffiancata` di `CarteMetriche` — nessun nuovo endpoint,
`PaginaAnnaliCollegato` interroga in parallelo `GET /metriche` e `GET /utenti/{id}/metriche`
per lo stesso anno selezionato. Nessun punteggio, nessuna percentuale: solo due numeri accanto.

## 3. Autori e generi più letti del collegato

**Costruito.** Stesso componente `Classifica` (`frontend/src/components/annali/
classifica.tsx`), nessuna variazione di formato: `CarteMetriche` lo monta identico sia per le
proprie sia per le sue classifiche.

## 4. Libri letti in comune, con i voti affiancati

**Costruito.** `LibriInComune` (`frontend/src/components/annali/libri-in-comune.tsx`):
striscia orizzontale, intersezione dei `libro_id` fra le due librerie già caricate dalla
pagina server (`getVoci` + `getLibreriaCollegato`, nessuna rotta dedicata), voto proprio e del
collegato affiancati sotto ogni copertina con le stelle di sola lettura di
`components/libro/voto-stelle.tsx` (`Stella`/`formattaVoto`, esportate per questo).

## 5. Cosa non è stato aggiunto

Come previsto: nessun punteggio di affinità, nessuna classifica fra utenti, nessun'altra
metrica trasversale a più collegati contemporaneamente (l'unica vista resta "tu e una persona
alla volta"). Il PRD non prevede un grafo sociale.
