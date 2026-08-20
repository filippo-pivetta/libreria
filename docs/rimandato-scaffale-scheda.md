# Rimandato dal redesign di Libreria e Scheda (20 agosto 2026)

Punti del prompt di redesign (scaffale a volumi + otto correzioni della Scheda) che non
potevano essere implementati in questo intervento, con dove tornare a prenderli. Non è
un'issue GitHub — è la lista da ridarmi quando si apre il lavoro corrispondente.

## 1. Copertine reali e colore dominante server-side (issue #4)

Il prompt chiedeva copertine `120×180`/`96×144` vere e un colore dominante calcolato lato
server con `sharp-vibrant` alla nascita della scheda, salvato sul Libro (due esadecimali,
uno per stanza chiara e uno per scura), mai estratto nel browser con canvas.

Bloccato su: la pipeline di ricerca/aggiunta libro (issue #4) non esiste ancora — nessuna
copertina reale entra mai nel sistema, quindi non c'è nulla da cui estrarre un colore lato
server. Oggi il colore dominante è un segnaposto deterministico calcolato **lato client**
dall'id del Libro (`frontend/src/lib/spine-color.ts`), solo per dare varietà cromatica allo
scaffale mentre non esistono copertine vere.

Da fare quando #4 sarà costruita: aggiungere `sharp-vibrant` al backend, calcolare ed
salvare `colore_dominante_chiaro`/`colore_dominante_scuro` sul Libro al momento in cui la
copertina viene recuperata, sostituire `spine-color.ts` con la lettura di questi due campi,
rimuovere il calcolo client. Le dimensioni `120×180`/`96×144` e le regole 1-4 della sezione 7
di `docs/design-frontend.md` (riquadro prima dell'immagine, nessuna didascalia, segnaposto
silenzioso) restano valide indipendentemente e non vanno ridiscusse.

## 2. Recensione e insight per lettura (issue #5)

Voto in stelle e nota di intenzione sono stati costruiti il 20 agosto 2026 (`VotoStelle`,
`NotaIntenzione` in `frontend/src/components/libro/`, endpoint `PATCH /voci/{id}/voto` e
`PATCH /voci/{id}/nota-intenzione`). Restano da costruire, per intero, insieme all'issue #5:

- **Recensione**: un paragrafo di testo lungo (Literata) sulla pagina destra, sotto le stelle.
- **Insight raggruppati per lettura**: sotto le due pagine, non dentro la colonna stretta della
  copia — un appunto lungo in una colonna stretta diventa una striscia di testo. Due
  trattamenti tipografici scelti dal sistema in base alla lunghezza (`docs/design-frontend.md`
  §10: sentenza `opsz 32`/19px sotto le ~200 battute, appunto `opsz 12`/15px oltre), mai una
  scelta chiesta all'Utente.
- **Taglio spoiler**: `clip-path` animata su una carta del piano 1 (§11) — il testo non è nel
  DOM finché non si chiede di scoprirlo, l'animazione copre la latenza della richiesta. Vale
  anche sugli insight di un collegato.
- **Fascia "Nella tua libreria" completa**: oggi (`NellaTuaLibreria`) mostra solo stato e voto
  della propria copia. Con recensione e insight costruiti va a mostrarne anche il conteggio
  ("una recensione, tre insight"), come nel mockup di riferimento.

`docs/design-frontend.md` §9/§10/§11 restano la specifica valida per tutti questi blocchi.
Vanno aggiunti alla pagina destra di `frontend/src/components/libro/scheda.tsx` seguendo
quella specifica, non riscrivendola.

## 3. `max-width` in `ch` per insight e recensione

Dipende interamente dal punto 2: senza i blocchi di testo lungo (insight, recensione, nota
di intenzione) non c'è nulla su cui applicare una larghezza di misura in `ch`. Da fare nello
stesso intervento dell'issue #5, non prima.

## 4. Azioni rapide dal volume, senza aprire il libro

`docs/design-frontend.md` §7, sezione "Rimandato": nella stesura precedente il dorso
sollevato aveva spazio per registrare un avanzamento o cambiare stato con un tocco lungo
(mobile), senza aprire la scheda. Con la copertina vera lo spazio libero sul volume è minore
e il gesto va ridisegnato, non solo riportato. Oggi il volume è solo un link alla scheda.

## 5. Rito di apertura (View Transitions)

`docs/design-frontend.md` §9, sezione "Rito di apertura": animazione di passaggio
dallo scaffale alla scheda (il volume si solleva, la copertina cresce verso la pagina
sinistra), sotto i 400ms, mai al ritorno. Non costruita: oggi il clic sul volume è un link
diretto senza transizione. Già segnalata anche in §23 "Da verificare" come punto da provare
con contenuti veri prima di scriverla in via definitiva.

## 6. Indice a lettere fisso sul bordo dello scaffale

`docs/design-frontend.md` §7, sezione "Rimandato": le tacche fra i volumi (regola 6, già
costruite) risolvono lo stesso problema di orientamento su una libreria di venti-trenta
libri. Un indice fisso sul bordo per saltare direttamente a una lettera resta un possibile
miglioramento su una libreria molto più grande — non necessario ora, non richiesto dal
prompt originale in modo esplicito, solo menzionato come possibile passo successivo.
