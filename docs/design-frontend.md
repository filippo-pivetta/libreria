# Montaigne · Design frontend

Il come dell'interfaccia. Compagno del PRD, che porta il cosa.

Revisione del 20 agosto 2026.

---

## 1. Direzione

**Materia.** Non superficie decorata, ma oggetti che stanno su piani diversi sotto una luce
sola.

Il riferimento è la biblioteca di Montaigne. È una ragione di progetto, mai un contenuto:
non si spiega all'utente e non compare in nessuna stringa. Nell'interfaccia gli insight si
chiamano insight. Il nome "Montaigne" compare solo sulla schermata d'accesso.

**Principio guida.** La profondità comunica appartenenza, non atmosfera. Ogni ombra deve
poter rispondere alla domanda "a quale piano appartiene questo elemento". Un'ombra che non
risponde è decorazione e si toglie.

**Due verifiche.**

- L'app deve essere bella da ferma. Se una schermata ha bisogno del movimento per sembrare
  bella, il movimento sta coprendo un problema di composizione.
- Togliendo tutte le ombre e tutte le grane, la gerarchia deve reggere lo stesso, perché è
  fatta di luminanza e di spazio. Se crolla, la profondità stava facendo un lavoro che
  spettava alla composizione.

---

## 2. I tre piani

Tutta l'interfaccia vive su tre piani e su non più di tre.

| Piano | Che cos'è | Trattamento |
|---|---|---|
| **0, fondo** | La stanza. Non contiene mai testo di lettura | Colore pieno, nessuna ombra, nessuna grana |
| **1, carta** | Le superfici su cui si legge e si scrive: schede, pannelli, elenchi | Luminanza più alta del fondo, grana 0.035, bordo 1px, ombra corta |
| **2, oggetto** | Ciò che è sollevato: volume al passaggio del mouse, pannello aperto, copertina | Luminanza più alta ancora, ombra doppia, bordo di luce sul lato illuminato |

Non esiste un piano 3. Un elemento che sembra richiederne uno va spostato altrove nella
pagina, non elevato.

**Ombre: sempre due, mai una.** Una corta ancora l'oggetto alla superficie, una lunga gli dà
aria. Una sola ombra media è il difetto che fa sembrare un'interfaccia un tema Bootstrap. Il
colore non è nero puro ma l'inchiostro del tema con alpha. Quando la stanza è scura le ombre
si allungano e si scuriscono, non spariscono. Su mobile la componente lunga si accorcia: le
stesse ombre, su uno schermo tenuto a trenta centimetri, sembrano sporco.

**Grana:** SVG `feTurbulence` in data-URI, sotto un chilobyte, statico, opacità 0.035. **Sta
sul piano 1 e sul piano 2, mai sul piano 0.** La grana su una carta dice che è carta; la
grana su un fondo dice solo che avevamo paura del vuoto. Mai animata: il filtro si applica
alla bitmap della forma, quindi ogni cambiamento di forma o posizione lo ricalcola, e oltre
quattro primitive concatenate le prestazioni su mobile crollano.

**Bordi:** un solo spessore, 1px, sempre l'inchiostro del tema con alpha, mai un grigio
scelto a mano. Raggi: 4px sugli oggetti piccoli (pastiglie, volumi, barre), 10px su campi e
pulsanti, 14px sulle carte. Niente sopra i 14px, che dà l'aria di applicazione per bambini.

---

## 3. Luce

**Una stanza sola.** Non esiste un tema chiaro e non esiste un tema scuro: esiste una
superficie che dal mattino alla notte si scurisce e cambia calore. Non c'è interruttore,
non c'è scelta, la parola "notte" non compare nelle impostazioni. È la conseguenza dell'ora,
come lo scaffale è la conseguenza della libreria.

Quattro ancoraggi: alba, giorno, tramonto, notte. L'ora corrente sta sempre fra due e i
colori si interpolano.

**Interpolazione in OKLCH.** I mezzitoni restano saturi e leggibili; in sRGB il passaggio fra
alba e giorno darebbe un mezzogiorno grigio e fangoso.

**Calcolo lato server.** Il PRD fissa il fuso CET uguale per tutti; calcolarlo nel browser
produrrebbe un mismatch di idratazione in Next.js. Alba e tramonto da tabella a latitudine
fissa, non dalla posizione dell'utente: due collegati devono vedere la stessa stanza alla
stessa ora.

**Il valore si aggiorna al cambio pagina, mai con un timer, e mai mentre si sta scrivendo:**
in quel caso è rimandato alla navigazione successiva.

**Il passaggio al buio non si interpola, scatta.** Dentro la fascia chiara si passa da alba a
giorno a tramonto in continuo; attraversando notte si va all'ancoraggio più vicino.
Interpolando linearmente, a metà transizione fondo e inchiostro si troverebbero entrambi a
luminanza media e il contrasto scenderebbe sotto 2:1, cioè testo illeggibile per una decina
di minuti, due volte al giorno. È un difetto che nessuna verifica sui singoli ancoraggi
intercetta, perché ognuno preso da solo è a norma. Lo scatto non si vede, dato che il valore
cambia solo al cambio pagina.

### La stanza chiara e la stanza scura non sono l'una l'inversione dell'altra

| | Chiaro | Scuro |
|---|---|---|
| Piano 0 | quasi neutro caldo, luce diffusa da finestra | scuro profondo, luce da lampada |
| Piano 1 | carta chiarissima | carta ambrata smorzata |
| Testo | inchiostro bruno | avorio caldo |
| Bordo di luce | appena percettibile | più marcato: al buio è ciò che dà il volume |
| Ombre | corte e chiare | lunghe e profonde |
| Copertine | naturali | velate al 12%, velatura che si toglie al passaggio del mouse |
| Mensola | più scura del piano 0 in entrambe le stanze | idem, invariante verificato in CI |
| Colore dominante | calcolato per la stanza chiara | seconda versione calcolata, più desaturata |

**La lampada.** Un solo `radial-gradient` a basso contrasto, fisso, ancorato in alto a
sinistra. Non si muove, non pulsa, non segue il puntatore. È l'unica ragione per cui il piano
0 non è del tutto piatto, ed è calibrata per essere invisibile finché non la si cerca.

### Palette

Valori OKLCH nella forma `L C H`. Sorgente di verità: `src/lib/light.ts`.

| Ruolo | Alba | Giorno | Tramonto | Notte |
|---|---|---|---|---|
| surface-0 | `0.885 0.020 55` | `0.912 0.014 78` | `0.855 0.028 62` | `0.185 0.016 66` |
| surface-1 | `0.950 0.014 60` | `0.965 0.010 84` | `0.930 0.020 68` | `0.245 0.017 70` |
| surface-2 | `0.975 0.012 62` | `0.985 0.008 86` | `0.955 0.016 70` | `0.295 0.018 72` |
| ink | `0.270 0.024 45` | `0.255 0.022 58` | `0.265 0.026 50` | `0.930 0.014 85` |
| ink-soft | `0.455 0.020 50` | `0.455 0.018 62` | `0.445 0.022 55` | `0.700 0.014 80` |
| accent | `0.620 0.115 55` | `0.635 0.105 76` | `0.630 0.125 62` | `0.775 0.115 82` |
| accent-strong | `0.470 0.110 58` | `0.470 0.100 72` | `0.455 0.115 62` | `0.820 0.110 84` |
| alert | `0.530 0.170 27` | `0.545 0.170 27` | `0.535 0.170 27` | `0.700 0.150 28` |
| shelf | `0.610 0.042 48` | `0.640 0.038 62` | `0.580 0.050 55` | `0.130 0.026 64` |

**Invariante della mensola.** `shelf` deve restare più scuro di `surface-0` nei quattro
ancoraggi, altrimenti il ripiano legge come una striscia di luce sotto i libri invece che
come un oggetto d'ombra. Verificato in CI insieme ai contrasti (§21), non solo sui quattro
ancoraggi ma campionando l'anno come per la luce.

**Contrasti.** `ink` su `surface-1` sta fra 12.5:1 e 14.3:1. `ink-soft` su `surface-1` non
scende sotto 6.0:1. `accent-strong` su `surface-1` non scende sotto 6.1:1. Testo scuro su
`accent` pieno resta sopra 4.8:1. Campionando ogni dieci minuti su un anno intero, incluse
tutte le posizioni intermedie, il minimo assoluto è 6.08:1.

**Quel campionamento va in CI.** È l'unico modo per accorgersi se qualcuno tocca un valore e
rompe una fascia oraria che nessuno guarda mai.

**Regola sull'ottone.** `accent` è un colore di riempimento e non va mai usato come testo su
superficie chiara, dove il contrasto crolla sotto 3:1. Per testo, icone e numeri esiste
`accent-strong`.

**Regola sul rosso.** `alert` compare in un solo posto in tutto il prodotto, il contatore
delle richieste ricevute accanto a Torre, perché è l'unica cosa che chiede un'azione. Non
sugli errori, che sono testuali. Non sulla cancellazione dell'account. Non sui nastri, che
hanno un rosso proprio di stato.

**Costo accettato.** Senza interruttore, chi ha una sensibilità alla luce non può forzare la
stanza scura di giorno. Si mitiga rispettando `prefers-contrast` e la modalità a colori
forzati del sistema, che restano gli unici comandi esterni onorati.

---

## 4. Tipografia

Tre famiglie, tre ruoli, nessuna sovrapposizione.

| Ruolo | Carattere | Dove |
|---|---|---|
| **Display** | **Fraunces**, variabile, assi `opsz` e `SOFT` | Insegna, titoli di pagina, titoli dei libri |
| **Lettura** | **Literata**, variabile, asse `opsz` | Insight, recensioni, note, ogni testo lungo |
| **UI** | **Inter Tight**, variabile | Etichette, comandi, date, numeri, metriche, stati vuoti |

Tutte con licenza SIL Open Font, tutte variabili, servite da `next/font/local` con subset
latino: zero richieste a terzi, nessun salto di layout.

**Perché due serif.** Literata è fatta per la lettura prolungata: ottima nel corpo del testo,
anonima in display. Fraunces ha carattere in grande e diventa faticosa nel testo lungo. Sono
due mestieri diversi.

**Un serif su un'etichetta di UI è un bug.** EMAIL, PASSWORD, ENTRA sono comandi, non
lettura.

**Sentenza e appunto restano entrambi in Literata.** L'asse di dimensione ottica regola
contrasto e proporzioni ed è ciò che permette a 19px e 15px di essere lo stesso carattere con
due voci diverse. Fraunces sulle sentenze creerebbe due serif adiacenti nello stesso elenco,
ed è l'unico posto dell'app dove si scontrerebbero.

**Se si deve tagliare:** si toglie Fraunces e si porta Literata a `opsz 72` sui titoli. Si
perde carattere, non si rompe nulla. Inter Tight non si tocca.

**Composizione.** `text-wrap: balance` sui soli titoli, dove è costoso e oltre le sei righe
non ha effetto. `text-wrap: pretty` sui paragrafi lunghi. `text-box-trim` sui titoli display,
perché a corpo grande lo spazio ottico sopra e sotto si vede. `font-variant-numeric:
tabular-nums` su ogni numero di metrica, sempre, altrimenti le colonne ballano al cambio
d'anno. Nessun `letter-spacing` negativo sotto i 24px; sopra, fino a `-0.02em` sul display.

---

## 5. Navigazione

Quattro voci: **Libreria, Annali, Lettori, Torre.** In inglese: Library, Annals, Readers,
Tower.

| Voce | Contenuto |
|---|---|
| Libreria | Scaffale, filtri, ricerca |
| Annali | Metriche per anno |
| Lettori | Elenco membri |
| Torre | Collegamenti e impostazioni |

La barra sta sul piano 0, non su una carta: non è contenuto, è la stanza. La voce attiva si
segnala con l'inchiostro pieno e un filetto, non con un riempimento.

Il contatore delle richieste ricevute sta accanto a Torre ed è l'unico elemento in `alert` di
tutta l'app: il PRD non ha notifiche, e senza contatore una richiesta resterebbe invisibile
per sempre.

Questa barra è quella di "casa tua". Nel contesto di un collegato (§15) sparisce del tutto,
sostituita da una barra contestuale diversa: non è una variazione di questa, è un'altra barra.

Il rimando letterario sta nell'insegna, non nella segnaletica interna: dentro le pagine i
titoli restano piani (collegamenti, impostazioni, cancella il tuo account, chi vede cosa).

---

## 6. Accesso

**Split verticale.** A sinistra l'insegna in Fraunces a corpo molto grande sul piano 0, con
la lampada dietro e la citazione sotto. A destra, o sotto su mobile, il modulo su piano 1.

Il modulo non è un rettangolo appoggiato su uno sfondo: è una zona di carta che occupa tutta
la sua metà, e il confine fra i due piani è il salto di luminanza, senza bordo e senza ombra.

Campi con la sola riga inferiore, etichette in Inter Tight maiuscolo spaziato, pulsante in
`accent` pieno. L'errore di accesso è testo in `ink` sotto il campo, non un riquadro rosso:
la stringa del fornitore di autenticazione va tradotta, mai mostrata grezza.

Su mobile l'insegna resta in cima e si accorcia, il modulo prende il resto. La citazione
sparisce sotto i 600px di altezza: è la prima cosa a cedere.

**Primo accesso:** schermata a sé, non un pannello sovrapposto. Accettare l'informativa è
condizione per entrare, quindi non è un avviso da scacciare, è una porta.

---

## 7. Libreria

**Riscritta il 20 agosto 2026: vista unica.** Non esiste un selettore di vista e non esiste
una vista a elenco. Non esiste più un dorso da solo: esiste uno **scaffale di copertine con
la costa**. Ogni volume, da sinistra a destra:

- **La costa**, larga `clamp(6px, pagine / 22, 28px)`, nel colore dominante scurito. Lo
  spessore è il numero di pagine — è fisicamente vero — non l'altezza, che è il formato di
  stampa e non dice nulla. Le voci senza pagine adottate prendono uno spessore mediano.
- **La copertina vera**, `120 × 180` px su desktop e `96 × 144` su mobile (proporzione 2:3
  fissa, `object-fit: cover`, mai deformata, mai con bande).
- **Il nastro di stato**, che esce dal lato di taglio (`right: 16px`), non dal centro, così
  non copre mai la copertina.

### Regole non negoziabili

1. **Il riquadro esiste prima dell'immagine.** Il recupero della copertina è un lavoro in
   secondo piano (PRD): un libro appena aggiunto compare senza immagine e si riempie dopo. Il
   volume nasce già della dimensione definitiva — `width`/`height` fissi, mai `aspect-ratio`
   da solo — e non salta mai quando l'immagine atterra.
2. **Nessuna didascalia sotto i libri.** La copertina è l'etichetta. Dove manca, il
   segnaposto porta titolo e autore composti dentro il riquadro: l'informazione compare
   esattamente dove serve, mai due volte.
3. **Il segnaposto non è uno stato di errore.** Niente icona di immagine rotta, niente libro
   generico, niente punto esclamativo: titolo in Fraunces e autore in Inter Tight sul colore
   dominante. Un errore di caricamento ricade sul segnaposto in silenzio.
4. **Il colore dominante serve ancora**, anche con le copertine vere: regge la costa, il
   segnaposto e il riquadro nell'attesa.
5. **Le mensole si riempiono sulla larghezza reale**, non su un numero fisso di libri. Una
   mensola con due volumi fa sembrare la libreria abbandonata. Si impacchettano i volumi
   finché entrano nella larghezza del contenitore, poi si chiude la mensola e se ne apre
   una successiva; si ricalcola al ridimensionamento (`ResizeObserver`, debounce ~150ms).
6. **La lettera dell'autore è una tacca fra un volume e l'altro**, larga 18px, con un filetto
   di 10px che scende sulla mensola. Non è un ripiano a sé.
7. **Ordinamento alfabetico per cognome dell'autore, stabile.** A parità di cognome, per
   titolo. Un libro con più autori si ordina sul primo. Uno scaffale vero è stabile: impari
   dove sta un libro e lo ritrovi con la coda dell'occhio; ordinare per attività recente
   riordina la fila a ogni avanzamento e impedisce alla memoria spaziale di formarsi.
8. **Fascia delle letture in corso in cima**, con gli stessi oggetti più un filo di
   avanzamento di 3px sul bordo inferiore della copertina. Su mobile scorre in orizzontale
   con aggancio (`scroll-snap-type: x proximity`) — provata come vista principale e
   scartata, perché costa dodici gesti per dodici libri, ma su due o tre funziona. **I libri
   in lettura stanno solo nella fascia**: due insiemi distinti, non due viste sugli stessi
   dati — vederli ripetuti identici due volte nella stessa pagina non aggiunge informazione.
9. **Le voci senza pagine adottate** hanno la costa in contorno tratteggiato, senza riempimento
   e senza ombra: l'assenza di dato va dichiarata, non gridata. **Emendamento del 22 agosto
   2026**: il tratteggio tocca solo la costa (lo spessore, che deriva dal conteggio pagine), non
   più la copertina — foto vera o segnaposto colorato che sia, la copertina non dipende dalle
   pagine e resta quella normale anche quando le pagine sono ignote.
10. **Il sollevamento** è `translateY(-10px)` più il passaggio all'ombra del piano 2, su uno
    pseudo-elemento a cui si anima `opacity`, mai su `box-shadow` (non compositabile). Dietro
    `prefers-reduced-motion` resta il salto di piano e sparisce il movimento. **Non allarga
    più il volume** (32 → 44px nella stesura precedente): con la copertina vera il titolo non
    è mai troncato in un'unica riga come lo era sul dorso, l'allargamento non risolverebbe più
    nulla.

**Colore dominante**, calcolato lato server alla nascita della scheda (`app/lavori/
copertine.py`, backend) e salvato sul Libro — mai estratto nel browser con canvas. Il
segnaposto client dall'id del Libro (`spine-color.ts`) resta il ripiego per le schede senza
copertina, non più la regola. **Resta un solo valore, non due**: la tabella §3 chiede una
seconda versione più desaturata per la stanza scura, non ancora costruita (issue #20).

**La mensola.** Una barra di 10px sotto la fila, **più scura del piano 0** in tutti e quattro
gli ancoraggi (ancoraggio `shelf` in `src/lib/light.ts`, verificato da
`scripts/check-contrast.mts`: un ripiano più chiaro della stanza legge come una striscia di
luce e i libri sembrano fluttuare), con l'ombra doppia rivolta verso il basso. È l'unico
elemento dell'app che allude a un mobile, e basta: niente montanti, niente cornice, niente
parete.

### Filtri e ricerca

**Filtro testuale** su titoli e autori, sempre disponibile, che non chiama nessun modello: un
campo con la sola riga inferiore, non una scatola arrotondata, `aria-label` esplicita.

**Filtro per stato**, gratuito perché i nastri sono già un codice colore: pastiglie in
contorno con un quadratino di colore di 7px e l'etichetta in `ink-soft`. Attive: nessun
bordo, fondo `ink` al 9%, testo in `ink`. Non pastiglie piene colorate — erano la cosa più
satura della schermata e rubavano l'attenzione ai libri, che sono l'unico posto dell'app
dove il colore è un dato.

**Ricerca semantica separata**, sui propri insight, dipendente dal consenso. **Non va fusa
nel campo sopra**: revocare il consenso lascerebbe l'utente senza il modo di trovare un libro.
**Costruita il 22 agosto 2026** (issue #6) come pagina a sé, §25: qui resta solo la porta, un
collegamento discreto in fondo alla riga dei filtri ("Cerca nei tuoi insight", variante `ghost`
accanto a "Aggiungi un libro"). Un collegamento e non un secondo campo — due campi di ricerca
affiancati sulla stessa riga si sbagliano, e questo costa una chiamata al modello mentre quello
accanto non costa nulla. Nascosto sulla libreria di un collegato: si cerca solo nei propri testi.

### Accessibilità

Il colore del nastro da solo non basta: rosso e verde sono indistinguibili per un daltonico.
La lunghezza del nastro porta la differenza, e il volume in lettura ha anche una linea chiara
sul bordo.

### Rimandato

**Azioni dal volume senza aprire il libro** (registrare un avanzamento, cambiare stato con un
tocco lungo su mobile): nella stesura precedente il dorso sollevato aveva spazio per questi
due gesti. Con la copertina vera lo spazio libero sul volume è minore; resta un miglioramento
da valutare, non ancora costruito — oggi il volume è solo un link alla scheda.

**Indice a lettere sul bordo** come elemento a sé (l'unghiatura delle rubriche): sostituito
dalle tacche fra i volumi (regola 6), che risolvono lo stesso problema senza un elemento
separato; un indice fisso sul bordo per saltare direttamente a una lettera resta un possibile
miglioramento successivo su una libreria molto grande.

---

## 8. Mobile

Mobile pari a desktop, con il mobile come riferimento nei casi di dubbio. Ogni schermata si
progetta e si verifica mobile-first, mai il contrario.

**Scaffale a più mensole:** volumi (§7) che vanno a capo su ripiani impacchettati sulla
larghezza reale, copertina ridotta a `96 × 144`, scorrimento verticale, tocco che apre. Il
sollevamento non serve: il dito è già il puntatore. Ogni mensola porta la sua ombra doppia, ed
è la ripetizione delle ombre a dare la profondità che su desktop dà il sollevamento.

**Fascia orizzontale con aggancio solo per le letture in corso** (§7, regola 8): provata come
vista principale e scartata — dodici gesti per dodici libri, e perde il colpo d'occhio che è
la ragione stessa dello scaffale — ma su due o tre libri funziona, col centro dello schermo
che fa da puntatore.

---

## 9. Scheda del libro

**Volume aperto, due pagine.** A sinistra l'opera, dato condiviso. A destra la tua copia. La
piega centrale è il confine di proprietà della tabella di ownership del PRD.

Le due pagine sono due carte sul piano 1, separate da un vuoto di 2px sul piano 0. Nessuna
imitazione di rilegatura: il vuoto dice la stessa cosa e non invecchia.

Nessuna copertina a tutta larghezza in cima: è la soluzione di tutte le altre app e schiaccia
il contenuto personale sotto la piega dello schermo.

### Pagina sinistra, l'opera

- Copertina sul piano 2, con la sua ombra doppia: è l'unico oggetto raster dell'app e vale la
  pena che si veda come oggetto.
- Titolo in Fraunces, nella variante della lingua dell'interfaccia; autori sotto in Inter
  Tight.
- Anno e lingua originale. **Emendamento del 22 agosto 2026**: l'etichetta "dedotto" prevista
  qui quando il valore viene dal modello e non dal catalogo è stata costruita e poi tolta su
  richiesta esplicita — resta solo il valore, senza distinguere in interfaccia un anno/lingua
  dedotti da uno di fonte. Il dato (`anno_dedotto`/`lingua_dedotta`) resta comunque in database
  e nell'API, per un'eventuale reintroduzione futura.
- Generi come pastiglie **senza alcun affordance di modifica**: il PRD vieta la correzione a
  qualsiasi utente e non prevede nemmeno una segnalazione. L'assenza di comandi è il
  messaggio. Bordo 1px, nessun riempimento.
- Descrizione dell'opera, nella lingua dell'interfaccia quando esiste, sotto i generi: prosa breve (l'apertura di una voce enciclopedica, non l'intera scheda editoriale), con l'attribuzione della fonte quando i suoi termini la richiedono. Nessun ripiego su un'altra lingua se manca in quella dell'interfaccia — a differenza del titolo, una trama nella lingua sbagliata non assolve alla stessa funzione — e nessuna riga vuota: se la fonte non ce l'ha, quel blocco non compare.
  **Da verificare**: l'attribuzione della fonte non è costruita — `libro_descrizione.url_fonte`
  esiste in database (necessario per i testi CC BY-SA di Wikipedia, la cui licenza la richiede)
  ma non è esposto né da `LibroEssenziale` né dalla scheda. Non toccato in questa sessione,
  segnalato qui perché la sezione lo dà per fatto.

### Pagina destra, la tua copia

- Nastro nella stessa posizione del volume sullo scaffale: il libro che si apre non perde il
  segnalibro.
- Stato, pagina raggiunta, data di inizio in formato leggibile (`20 agosto 2026`, mai
  `2026-08-20`), barra di avanzamento **a due colori**: quello già salvato in `ink-soft` al
  50%, il tratto in più che si sta per salvare in `accent`, calcolati dal valore correntemente
  in scrittura nel pannello sotto — non un solo colore statico.
- Lingua originale come parola (`italiano`, non `it`), tramite i nomi di lingua della
  piattaforma, con fallback sul codice se la piattaforma non la conosce.
- Le transizioni: **una sola azione piena in evidenza** — la più frequente per lo stato
  corrente (`in_lettura → letto`, `in_lettura → in_pausa`, `in_pausa → in_lettura`, …) — le
  altre transizioni ammesse sotto un disclosure **"Altro"**. **L'interfaccia non offre mai una
  transizione vietata**, invece di offrirla e poi rifiutarla. Il campo data usa uno stile
  proprio (`CampoData`), mai l'aspetto nativo del browser.
- **Voto in stelle** (1-5 a scatti di mezza stella, ogni stella è due zone cliccabili — metà
  sinistra/destra — e si solleva al passaggio del mouse come i volumi sullo scaffale, §7; un
  secondo clic sul valore già scelto lo cancella) e
  **nota di intenzione** (carta più calda, mai visibile a un collegato, in nessuno stato del
  consenso), **recensione** (paragrafo Literata sotto le stelle) e **insight raggruppati per
  lettura** sono costruiti (issue #5).
- Se il libro è da leggere, **"me lo consigli?" prende il posto dei dati di lettura**. Vincoli
  del PRD: privata e mai condivisibile, sotto le ottanta parole, dichiarata come generata, e a
  consenso revocato l'interfaccia dice che è spenta invece di far finta che non esista.
  **Costruito il 22 agosto 2026** (issue **#6**, non #5 come diceva questa riga fino ad allora:
  la preview è una delle cinque funzioni soggette al consenso, e apparteneva all'issue del
  consenso). Tre cose decise in costruzione:
  - Il blocco esiste **anche negli altri stati**, in coda alla pagina della copia sotto la nota
    di intenzione, in tono piano. Il PRD non limita la funzione ai libri da leggere; su un libro
    già letto un parere ha comunque senso, semplicemente non è la cosa principale. In evidenza
    resta solo su "da leggere".
  - L'indicazione "Sintesi generata" è una riga in `t-meta` sopra il testo, che arriva dal server
    come campo obbligatorio della risposta. Non è una frase che il modello scrive: affidargliela
    avrebbe significato perderla la prima volta che si distrae, e avrebbe consumato parte delle
    ottanta parole.
  - **Nessun comando di condivisione, in nessuna forma** — non un interruttore spento, non una
    voce assente da un menù. La regola 23 si garantisce facendo in modo che l'operazione non
    esista, e non esiste nemmeno nel database (niente colonna di visibilità su
    `artefatto_generato`, niente privilegio di UPDATE).
  - Il parere sta su una carta del **piano 2**: è un oggetto sollevato dentro la pagina della
    copia, non un secondo paragrafo della pagina stessa. Rigenerarne uno crea una riga nuova e
    sostituisce quella mostrata; "Cancella" resta accanto, senza attrito aggiuntivo — un
    artefatto rigenerabile non merita i tre livelli della cancellazione di una lettura.

### Sotto le due pagine

Insight raggruppati per lettura (issue #5), poi lo storico delle letture in un pannello che si
apre. Sui libri con una lettura sola già aperta, la maggioranza, non
compare nulla — compare solo quando c'è più di una lettura, o quando l'unica lettura è già
chiusa (rilettura in corso su un libro già finito una volta).

**Cancellazione di una lettura passata.** Non un link "Cancella" sempre visibile accanto alla
data: ogni riga porta un menù a comparsa ("⋯", `aria-label="Altre azioni"`) che rivela il
comando, e il comando stesso rivela "Cancella davvero" / "Annulla" al posto della data invece
di agire al primo tocco. Tre livelli di attrito deliberati per un'azione irreversibile che
tocca lo storico di lettura.

### Su mobile

Le due pagine si impilano. **Emendamento del 20 agosto 2026:** l'ordine non si inverte più —
l'opera resta sopra, la copia sotto, lo stesso ordine di desktop (dove l'opera è a sinistra),
deciso in corso d'opera al posto di "la tua copia sopra, l'opera sotto" scritto qui in
origine. Cade con questo anche l'header compatto separato ("titolo, autore e copertina in
cima in forma compatta sul piano 0"): con l'opera già in cima, che porta copertina/titolo/
autore, un riassunto sopra sarebbe una ripetizione dello stesso contenuto. La piega diventa il
vuoto fra due carte impilate, orizzontale invece che verticale come su desktop.

### Rito di apertura

**Non ancora costruito** (§23): oggi il volume è un link diretto, senza transizione. Specifica
per quando verrà fatto — il volume è già sollevato dal passaggio del mouse, quindi il clic
parte da lì; la copertina cresce e va al suo posto nella pagina sinistra, la pagina destra
arriva un attimo dopo.

Sotto i 400 millisecondi, **una volta sola, mai al ritorno**. Al ritorno il libro non si
richiude: elegante la prima volta, insopportabile la ventesima.

---

## 10. Insight

Due trattamenti, scelti dal sistema in base alla lunghezza. Nessuna scelta chiesta all'utente,
nessuna etichetta.

| | Sentenza (sotto ~200 battute) | Appunto (oltre) |
|---|---|---|
| Carattere | Literata `opsz 32` | Literata `opsz 12` |
| Corpo | ~19px | ~15px |
| Peso | 300 | 400 |
| Interlinea | 1.55 | 1.65 |
| Troncamento | nessuno | otto righe, poi "mostra tutto" |

In un libro con dodici insight, le due frasi buone risaltano da sole senza che nessuno le
abbia marcate.

Nessun effetto di incisione, nessun `text-shadow`: su un serif variabile a corpo 19 il doppio
contorno sporca le grazie e sui fondi scuri produce un alone. Corpo, peso e interlinea sono
già tre segnali e bastano.

Data piccola, in Inter Tight, spaziata, **sotto e non sopra**: la frase viene prima.

**Raggruppati per lettura**, come impone il PRD, che lega ogni insight alla lettura in cui è
nato. Le letture più vecchie stanno su una carta di luminanza appena più vicina al fondo: la
profondità nel tempo si vede senza etichette, e usa lo stesso sistema di piani di tutto il
resto invece di una regola sua.

Nessun bordo e nessuna ombra sui singoli insight: una campitura appena diversa dalla carta che
li contiene.

**Solo dentro la scheda del libro.** La vista trasversale è rinviata. Ricerca semantica e
sintesi tematica producono comunque risultati che attraversano più libri, ma una pagina di
risultati non è una vista di navigazione: mostra l'insight con accanto il libro da cui viene.

---

## 11. Spoiler

**Pagina non tagliata.** Comando: "Taglia per leggere". Richiama le pagine intonse dei libri
antichi: irreversibile nella metafora, reversibile nel prodotto.

Non è una scelta estetica. La regola 10 del PRD impone che uno spoiler non sia mai restituito
in chiaro in elenchi o anteprime, e sfocare con CSS non basta perché il testo resterebbe nel
DOM. Quindi il server manda solo il fatto che esiste, il gesto di scoprire fa una richiesta, e
**l'animazione copre la latenza**.

Il taglio è una `clip-path` animata su una carta del piano 1, non una texture di carta
strappata.

**Solo sugli insight di un collegato**, non sui propri. La prima stesura di questa sezione
diceva l'opposto — "vale identico anche sui propri, il taglio non è un permesso, è un avviso" —
finché l'uso reale (issue #6) non ha mostrato che tagliava a chi ha scritto l'insight il proprio
stesso testo, senza proteggere nessuno: la regola 10 difende da uno spoiler *altrui*, non da un
proprio ricordo di ciò che si è già letto. Sulla propria scheda il testo compare sempre per
intero, con un piccolo promemoria accanto alla data ("spoiler per i tuoi collegati") — non un
avviso su cosa sta per leggere, che qui non serve, solo la memoria di cosa si è marcato per gli
altri. Lo stesso vale nella ricerca semantica (§25): ogni risultato è già proprio, mai di un
collegato.

---

## 12. Registrazione dell'avanzamento

**Principio: rendere impossibile lo stato invalido invece di rifiutarlo dopo.** Un rifiuto che
compare dopo che hai digitato è un fallimento del disegno.

**Pannello sulla pagina destra.** Nessuna finestra sovrapposta, nessuna sfocatura. Su mobile
si espande la sezione della tua copia. Senza strati sovrapposti non c'è nulla che possa
chiudersi portandosi via il testo in scrittura, come impone la regola 25.

**Segnalibro trascinabile e campo numerico, accoppiati.** Si trascina per avvicinarsi, si
digita per precisare — su un libro da 1200 pagine un pixel vale diverse pagine. Il
trascinamento rende fisico il vincolo del PRD: la porzione già letta è un muro, e il segnalibro
non torna indietro perché il dito non ci riesce, non perché arriva un messaggio di rifiuto. Da
tastiera, frecce ±1, con maiuscolo ±10. Il campo numerico non impone lo stesso muro mentre si
sta ancora digitando le cifre — solo alla perdita del focus — per non combattere con chi sta
scrivendo un numero a più cifre; il tetto (le pagine adottate), quando c'è, si applica sempre,
anche a metà digitazione.

| Elemento | Regola |
|---|---|
| Numero grande, a fuoco all'apertura, tastiera numerica, invio salva | Il caso normale è: tocco, tre cifre, invio |
| "42 pagine dal 14 agosto" | Il PRD conta le pagine come somma degli **incrementi**, mai delle pagine raggiunte. Mostrarlo mentre lo crei insegna il modello facendolo. È anche l'unico numero gratificante |
| Barra a due colori | Quello che avevi in `ink-soft`/`accent` attenuato, il tratto in più in `accent` pieno |
| Rifiuto (pagina, data, tetto) | Un toast in fondo alla pagina (§19), non testo sotto il campo |
| "Correggi il totale" | Sta con gli altri fatti bibliografici sulla pagina sinistra, non nel pannello dell'avanzamento — è l'unico campo bibliografico che l'Utente corregge sulla propria copia. Si clicca il numero, si scrive, si esce dal campo: salva da solo, senza un bottone a parte. Rifiutata se il nuovo totale è inferiore a un avanzamento già inserito |

Nessun limite dichiarato in anticipo con una frase ("tra 215 e 320", "non prima del 14
agosto"): il vincolo si scopre tentando. `min`/`max` sul campo restano solo come suggerimento
per tastiera numerica e lettori di schermo, senza bloccare l'invio (nessun fumetto nativo del
browser, che non è testo — vedi §19).

**Salvataggio ottimistico.** Il segnalibro e il numero si spostano subito, la conferma arriva
dopo. Se la scrittura fallisce, un toast lo dice e il valore salvato resta quello precedente.
È la differenza fra un'app che sembra viva e una che sembra un modulo.

**Nel contesto di un collegato:** sparisce il pannello per intero — niente campo, niente
segnalibro trascinabile, niente "Salva". Restano barra e numeri in sola lettura, che sono un
dato di lettura visibile ai collegati (§15).

### Due varianti

**Voce senza pagine adottate:** spariscono totale, percentuale e massimo. Restano numero e
incremento. Un incremento fuori scala produce un **avviso, non un rifiuto**.

**Chiusura del libro:** "Ho finito" non passa da qui, chiede solo la data di fine. Il PRD
genera da solo l'avanzamento finale alle pagine adottate. Va detto in una riga, altrimenti
sembra che l'app abbia inventato un dato.

---

## 13. Ricerca e aggiunta

Un campo solo, placeholder "Titolo o autore". Il PRD è netto: non esistono altre vie d'ingresso,
né codice digitato né scansione. Nessun selettore di modalità.

**Emendamento del 22 agosto 2026:** il testo di supporto sotto il campo ("titolo o autore", in
piccolo) è stato tolto — ripeteva il placeholder senza aggiungere informazione, solo rumore
visivo sotto la linea del campo.

Risultati da schede esistenti e cataloghi esterni presentati insieme, senza distinzione, come
impone il PRD. Ma i libri già in libreria cambiano verbo:

| Situazione | Verbo | Riga sotto l'autore |
|---|---|---|
| Non in libreria | Aggiungi | nessuna |
| In libreria, letto o abbandonato | Rileggi | "Letto nel 2023, quattro stelle" |
| In libreria, altri stati | Vai al libro | "In lettura, pagina 88" |

**L'aggiunta non porta via dalla ricerca.** Il pulsante diventa "Vai al libro" sul posto e la
riga guadagna lo stato. Chi popola la libreria ne aggiunge cinque di fila senza perdere i
risultati.

**Nessuna preview prima dell'aggiunta.** Senza descrizione conterrebbe gli stessi sei dati
della riga dei risultati. Elimina anche l'attrito col PRD: "me lo consigli?" resta sulla scheda
di un libro già in libreria, quindi l'artefatto ha sempre una Voce a cui legarsi.

**Velocità percepita.** Risultati che compaiono mentre si digita, con le schede già nel sistema
mostrate per prime perché non richiedono una chiamata esterna.

**Copertina assente:** segnaposto con titolo e autore, composto in Fraunces sul colore
dominante (§7). Il recupero è un lavoro in secondo piano, quindi un libro appena aggiunto può
comparire sullo scaffale come segnaposto tipografico e riempirsi dopo. **Il volume non deve
saltare quando arriva l'immagine**: nasce già della dimensione definitiva.

**Nessun risultato è un vicolo cieco e lo dice.** Il PRD vieta la creazione manuale di schede:
il libro va chiesto a chi mantiene l'istanza. Nessun pulsante "crea comunque", perché non
esiste e offrirlo sarebbe una bugia. La richiesta va resa un gesto facile, non una frase di
scuse: una riga da copiare con titolo e autore già dentro.

**Fonti irraggiungibili è un altro stato**, distinto da "non esiste", altrimenti chi cerca
pensa che il libro non ci sia mentre è solo il catalogo che non risponde.

---

## 14. Annali

Stessi piani e stessa luce dello scaffale, in tono minore. I numeri in Inter Tight, tabulari,
allineati. Nessun trattamento tipografico speciale: l'espressività è riservata agli insight.

Una carta per blocco di metrica, tutte sul piano 1, nessuna sollevata: negli Annali non c'è
niente da afferrare, quindi non c'è niente da sollevare. È il posto dove la disciplina sui tre
piani si vede di più.

**Ogni numero porta accanto il suo limite, in una riga piccola, sempre**, non solo quando c'è
un'anomalia. Se compare solo nei casi anomali diventa un allarme; se c'è sempre diventa il modo
in cui il numero si legge.

Le righe sono requisiti del PRD:

- i libri senza pagine adottate contano solo le pagine registrate a mano, e la somma non va mai
  presentata come completa;
- il peso di un libro si ripartisce fra autori e generi, così un libro vale sempre uno. I
  decimali (1,5 accanto a un autore) vanno tenuti, con la frase che li spiega sotto: senza,
  sembrano un errore di calcolo;
- i libri senza genere restano fuori dalla classifica dei generi e lo scarto è dichiarato
  accanto;
- "di cui 2 riletture" chiarisce che l'unità è la Lettura e non il Libro.

Selettore ad anno a frecce, con l'intervallo dichiarato dal primo anno con dati a oggi. Anni
futuri non selezionabili; un anno intermedio senza letture mostra zeri, non un errore.

Classifiche a cinque voci, con "mostra tutte". Barre in `accent`, mai una scala di colori
diversi per voce: sono la stessa grandezza misurata su soggetti diversi.

La spiegazione della divergenza a cavallo d'anno compare **solo quando serve**, cioè quando in
quell'anno esiste almeno una lettura che attraversa il capodanno: il libro conta nell'anno di
chiusura mentre le pagine restano divise fra i due anni secondo quando sono state segnate.

---

## 15. Libreria di un collegato

**La stessa stanza, con la lampada di un altro.** Il piano 0 scende di 0.02 in luminanza e
perde quasi tutto il croma; le carte restano, ma nastri e stelle passano da `accent` a
`ink-soft`. Confrontandola con la propria si sente, da sola no.

**La barra globale sparisce del tutto**, sostituita da una barra contestuale: link di uscita
"‹ Lettori" (la stessa via da cui si è entrati, non il tasto indietro del browser), il nome
della persona con le iniziali accanto, fisso mentre si scorre la pagina, e due schede interne
— **Libreria** e **Annali**. È il segnale più forte possibile, più forte del solo cambio di
luminanza: finché la barra dice "Libreria, Annali, Lettori, Torre" in cima, il cervello legge
casa propria, qualunque sia la luce. La barra globale torna solo uscendo da "‹ Lettori". Vale
identico per la scheda del singolo libro di un collegato (§9): anche lì la barra globale
sparisce, sostituita da "‹ [nome]" verso la sua libreria e il titolo del libro accanto alle
sue iniziali — un livello alla volta, mai un salto diretto a Lettori da dentro un libro.

**Scheda Annali del collegato — dipende dall'issue #7, non ancora costruita.** La scheda
compare comunque nella barra contestuale invece di sparire, con l'indicazione che arriva più
avanti: nasconderla del tutto suggerirebbe che non è prevista, mentre lo è. Specifica completa
in `docs/rimandato-annali-collegato.md`, da seguire quando Metriche di lettura (issue #7) sarà
costruita — non da reinventare in quel momento.

**Libri in comune.** L'intestazione della sua libreria porta anche il numero di opere che
possiedi anche tu (stesso Libro in entrambe le librerie), calcolato dalle due liste già
caricate — non è un dato nuovo, non richiede una rotta dedicata.

**L'assenza è muta.** Nessun lucchetto dove starebbe la nota di intenzione, nessun "questo
insight è privato", nessun posto vuoto che riveli che qualcosa esiste e non ti è dato. Un
lucchetto è metadato: rivela che una nota c'è, e il PRD dice che non è visibile a nessuno mai,
e quel "mai" comprende sapere che esiste. Vale identico per insight e recensioni resi privati.

**Nessuna superficie di scrittura e nessuna traccia di dove sarebbero.** Niente "segna
avanzamento", niente stelle cliccabili, niente campo nota. Il PRD esclude ogni interazione: né
commenti, né reazioni, né messaggi. La pagina destra non ha un solo pulsante, e nemmeno un solo
elemento sul piano 2, perché il piano 2 è il piano di ciò che si può toccare.

**Anche la coda dei libri da leggere è visibile**, come impone il PRD: non esistono libri
nascosti né parti di libreria riservate. Vale la pena che l'avviso di visibilità lo dica
chiaro.

**Collegamento interrotto:** la schermata non dice "sei stato rimosso" e non dice "errore".
Dice che quella libreria non è più accessibile e riporta all'elenco. Una stanza chiusa, non un
guasto.

---

## 16. Lettori

L'elenco mostra nomi e i tre stati della relazione, e nient'altro: non relazioni fra terzi, non
libri, non metriche, nessun conteggio di collegamenti, nessuna anteprima. È un registro di
nomi.

Le richieste compaiono solo nella Torre, come dice il PRD. Nell'elenco una richiesta in attesa
è testo, non un pulsante.

**Il rifiuto non lascia traccia.** Chi ha chiesto vede la relazione tornare ad assente,
indistinguibile da chi non ha mai chiesto. Nessun blocco, richiesta reinviabile.

Qui non c'è scaffale e non ci sono oggetti: sono persone, non volumi. Una sola carta lunga sul
piano 1, righe separate da filetti, iniziali in Fraunces. Nessuna immagine di profilo, che il
PRD non prevede.

**Due gruppi, non una lista sola.** L'elenco fa due mestieri con frequenze opposte: andare da
qualcuno con cui sei già collegato, che è quotidiano, e trovare qualcuno da chiedere, che in un
gruppo chiuso capita poche volte l'anno. Due carte, non una:

- **I tuoi collegamenti** — solo chi ha una relazione attiva. Ogni riga è pura navigazione:
  iniziali, nome, un chevron, l'intera riga è il link verso la sua libreria (§15). Nessuno
  stato scritto accanto: essere nell'elenco è già lo stato.
- **Altri membri** — chi non è (ancora) collegato. A destra della riga, tre varianti secondo
  la relazione: un bottone "Chiedi il collegamento" quando è assente; il testo "Richiesta
  inviata" quando l'hai chiesta tu; il testo "Ti ha chiesto il collegamento" quando l'ha
  chiesta lui — la direzione della richiesta va distinta a parole, non lasciata a un generico
  "In attesa", altrimenti non si capisce se c'è qualcosa da fare (nella Torre) o solo da
  aspettare. Resta vero l'invariante sopra: qui è sempre testo, mai un pulsante che accetta o
  rifiuta.

Sotto il secondo gruppo, una riga ricorda che le richieste si accettano nella Torre. Un gruppo
vuoto (nessun collegamento ancora, o tutti i membri già collegati) non mostra la sua carta:
niente carte vuote fra le due.

---

## 17. Torre

Una superficie sola, due sezioni. Sopra i collegamenti (richieste ricevute, inviate, attivi con
interruzione), sotto le impostazioni.

Le impostazioni contengono tre cose e basta: l'avviso di visibilità, il consenso
all'elaborazione assistita, la cancellazione dell'account. Nessun comando sulla luce, che non è
una preferenza ma una conseguenza dell'ora.

**Interrompere un collegamento: azione immediata, senza dialogo di conferma, con un annulla che
resta per qualche secondo.** Interrompere non è simmetricamente reversibile: tu interrompi da
solo, ma per tornare indietro serve che l'altro accetti una nuova richiesta, e nel frattempo
entrambi avete perso l'accesso senza che l'altro sappia perché.

**I due testi lunghi sono quelli del PRD, parola per parola.** L'avviso di visibilità è definito
come riga fissa, e il testo del consenso è dettato per intero perché è la base di un consenso
informato. Non vanno riscritti in forma più breve o più simpatica.

Sotto il consenso, una riga sulle note di intenzione: non escono mai, in nessuno stato del
consenso. È l'informazione più rassicurante della schermata.

L'interruttore nasce acceso. Spegnendolo va detto cosa succede subito e cosa no: le cinque
funzioni si spengono e gli indici si cancellano, ma gli artefatti già generati restano come
contenuti dell'utente.

**Costruita il 22 agosto 2026** (issue #6), tranne la cancellazione dell'account che resta una
nota (issue #8). Quattro cose decise in costruzione:

- **L'interruttore è l'unico dell'app.** Primitivo `@base-ui/react` come gli altri
  (`components/ui/switch.tsx`), traccia in `accent` quando è acceso — l'unico uso ammesso
  dell'accento, il riempimento — e `surface-2` quando è spento, che è il piano di un oggetto
  sollevato e non un colore in più. Nessun rosso: `alert` ha un uso solo in tutta l'app, e non è
  questo.
- **Nessuna finestra di annullamento**, a differenza dell'interruzione di un collegamento, che
  ne ha una di sei secondi. La differenza non è la gravità ma la reversibilità: interrompere non
  è simmetricamente reversibile (per tornare indietro serve che l'altro accetti una nuova
  richiesta), spegnere il consenso lo è del tutto — riaccendendolo gli indici si ricostruiscono
  da soli. Un "annulla" su un gesto reversibile è rumore, non prudenza.
- **La riga sotto l'interruttore cambia con lo stato**, e dice sempre la cosa che si sta per
  fare, non quella appena fatta: acceso, spiega cosa succede spegnendo (funzioni spente, indici
  cancellati, artefatti intatti); spento, spiega cosa succede riaccendendo (ricostruzione, e la
  ricerca semantica che si dichiara incompleta finché non finisce).
- **Il comando è ottimistico**, come ogni altro dell'app: l'interruttore si muove subito e torna
  indietro da solo se la scrittura non riesce, con l'errore in testo sotto — mai un riquadro
  rosso.
- **Una riga di stato reale, non solo generica**, aggiunta dopo un primo giro d'uso: il testo
  sopra spiega cosa *farà* l'interruttore, ma non diceva se una ricostruzione precedente fosse
  davvero finita — la Torre leggeva `/me` ma lo schema di risposta non portava ancora
  `indici_stato`, quindi non c'era alcun segnale. Sotto il testo generico, quando il consenso è
  acceso, una seconda riga dice lo stato vero ("Gli indici sono pronti." / "Gli indici si stanno
  ricostruendo..."), aggiornata a ogni cambio dell'interruttore.

### Cancellazione dell'account

Non è un pulsante rosso. È in fondo, in tono piano, sul piano 1 come tutto il resto. La
difficoltà sta dove deve stare: bisogna scrivere il proprio nome utente, e il pulsante resta
spento finché non coincide.

Il rosso e i toni allarmati sono evitati di proposito: un'azione che richiede di digitare il
proprio nome è già difficile da compiere per errore, e l'allarme grafico su un gesto legittimo
è paternalistico. Il rosso, in quest'app, vuol dire una cosa sola, ed è il contatore delle
richieste.

Schermata finale: due righe che dicono che l'account non c'è più e che per rientrare serve
parlare con chi mantiene l'istanza.

---

## 18. Stati vuoti e riautenticazione

Uno stato vuoto è un invito ad agire, tranne quando non c'è niente da fare, e in quel caso lo
dice.

Gli stati vuoti sono il posto dove questa direzione rischia di sembrare fredda, perché il colore
lo portano i volumi e senza volumi non ce n'è. Quindi qui, e solo qui, si concede un disegno: **una
mensola vuota in SVG a tratto**, un chilobyte, colore `ink-soft`, larga quanto il contenuto. Non
un rettangolo tratteggiato, non un'illustrazione piena, non una mascotte.

**Scaffale vuoto:** la mensola disegnata, e sotto una cosa che il PRD rende possibile ma che
nessuno indovinerebbe: puoi datare una lettura a quando è successa, e quindi caricare la libreria
storica senza schiacciarla sulla data di inserimento.

**Nessun collegamento:** spiega la reciprocità, cioè che finché nessuno accetta, nessuno vede
nulla in nessuna delle due direzioni.

**Ricerca senza risultati:** l'unico vicolo cieco del prodotto, e non finge il contrario.

**Riautenticazione:** mai una schermata. Una fascia in cima al pannello in cui si sta scrivendo,
con la password. Il testo resta visibile e salvando riparte l'operazione fallita.

---

## 19. Scrittura

Mai "con successo", mai "per favore", nessun punto esclamativo, nessun "ops". Gli errori dicono
cosa è successo e cosa fare. Verbo prima nei comandi. Un comando mantiene lo stesso nome per
tutto il flusso.

Nessun modale, nessun avviso che si sovrappone: solo pannelli in pagina. Unica eccezione, gli
errori di scrittura sui dati di lettura (avanzamento, cambio di stato, correzione delle
pagine, cancellazione di una Lettura) compaiono come un toast transitorio in fondo alla
pagina invece che come testo sotto il campo. Resta fermo tutto il resto della regola: nessun
modale, nessuna sfocatura, il rosso (`alert`) non compare mai su un errore neppure nel toast,
che è testo su una carta di piano 2 come ogni altro pannello. Vedi §12 per il dettaglio
sull'avanzamento.

**Conferma di un salvataggio senza un bottone "Salva" esplicito** (pagine adottate, nota di
intenzione: si scrive e si esce dal campo, il blur salva da solo): il toast resta riservato
agli errori, quindi la conferma è una riga discreta ("Salvato.", mai "con successo") accanto
al campo, che compare per un momento e sparisce. Un clic su "Salva" è già di per sé una
conferma del gesto; un blur no, e senza questa riga non ci sarebbe alcun segnale che la
scrittura sia partita.

Interfaccia bilingue italiano e inglese dal primo giorno. Stringhe fuori dal codice fin
dall'inizio; date e numeri seguono la lingua del browser. I contenuti scritti dagli utenti non
si traducono.

---

## 20. Stack e strumenti

Next.js App Router su Vercel, come impone il PRD.

### Base

- **Tailwind v4 su token propri**, dichiarati in `@theme`. Colore, piani, ombre e luce come
  variabili CSS: l'ora è un cambio di variabili, non di componenti. Nessun colore va mai scritto
  a mano in un componente.
- **Una sola sorgente di verità per la palette:** `src/lib/light.ts`. Uno script di build genera
  `src/styles/tokens.anchors.css`, che non si modifica a mano.
- **Base UI** (`@base-ui/react`, ADR-0014) invece di shadcn/ui preso così com'è, che porta
  un'estetica già decisa da disfare quasi ovunque.
- **`next/font/local`** per le tre famiglie variabili, subset latino.
- **Nessuna libreria 3D, nessuna libreria di smooth scroll, nessuna libreria di illustrazioni.**
  Gli unici SVG dell'app sono la mensola vuota, la grana e le icone, disegnati a mano e inline.

### Movimento

| Strumento | A cosa serve |
|---|---|
| **Motion** (`motion/react`) | Sollevamento, fisarmonica, taglio della pagina. Anima direttamente valori oklch, il che rende gratuita l'interpolazione della luce |
| **GSAP** | Rotazione della costa in copertina, se Motion non basta. Gratuito, plugin del Club compresi |
| **View Transitions** | Rito di apertura. Dentro la stessa pagina disponibile ovunque; fra pagine diverse ancora in movimento. **Miglioramento progressivo, mai fondamenta** |
| **Animazioni CSS guidate dallo scroll** | Fisarmonica, striscia agganciata. Girano sul compositore **solo se si animano transform e opacity** |
| **`sibling-index()`** | Scaglionare la fisarmonica senza JavaScript |
| **Query `scroll-state`** | Sollevare il volume agganciato al centro su mobile |
| **`@starting-style`** | Ingresso dei pannelli senza JavaScript |

**Si animano solo `transform` e `opacity`.** `box-shadow` non è compositabile: ogni transizione
di piano passa da uno pseudo-elemento con l'ombra superiore a cui si anima `opacity`. Tutto
dietro `prefers-reduced-motion`.

**Niente Rive e niente Lottie.** Sono strumenti per animazioni disegnate in un editor esterno, e
questa app non ne ha nemmeno una: tutto ciò che si muove è una transizione di stato, quindi CSS e
Motion coprono il 100% dei casi senza aggiungere fra i 50 e i 200 KB di runtime.

Le voci di supporto browser vanno ricontrollate prima di iniziare a costruire: si muovono, e
alcune fonti si contraddicono, in particolare su Safari e le transizioni fra pagine diverse.

---

## 21. Priorità dello sforzo

### Il diamante: lo scaffale

È l'unico posto dell'app dove **il dato diventa materia**: la costa è le pagine, la copertina è
la copertina vera (o il colore dominante quando manca), il nastro è lo stato. Tre dimensioni di
informazione dentro un oggetto che sembra un libro e non un grafico. Prima cosa che si vede a
ogni sessione, identità visiva, e la cosa che nessuna app concorrente fa.

Tutto lo sforzo di raffinatezza va lì: gradiente della costa, ombra sotto la mensola,
fisarmonica, bordo di luce, autori accostati. **Se lo scaffale è perfetto e il resto è solo
pulito, l'app è splendida. Se lo scaffale è mediocre, nessun'altra animazione lo salva.**

### Le ciliegine, in ordine

1. **Il sistema di piani applicato con disciplina.** Non si nota mai e regge tutto. È anche la
   cosa più facile da sbagliare: basta una carta di troppo sul piano 2 per perdere la gerarchia.
2. **Gli insight in Literata a due voci ottiche.** Cuore emotivo invece che identità visiva.
3. ~~**Il segnalibro trascinabile.**~~ Costruito e poi rimosso il 20 agosto 2026 (§12): il
   rischio di ambiguità del gesto su libri lunghi ha pesato più della soddisfazione del
   trascinamento. Resta il campo numerico con la barra a due colori.
4. **La luce continua.** Non si nota mai, ed è il suo pregio.
5. **Il rito di apertura.** La ciliegina meno preziosa, perché con le View Transitions lo avranno
   tutti. Farlo bene senza spenderci settimane.
6. **Il taglio della pagina.** Raro nell'uso, ma è l'unico gesto che qualcuno racconterà a voce a
   un amico.

### I falsi diamanti

3D vero. Suono. Parallasse e scroll rallentato, che tolgono il controllo all'utente e in tre
giorni diventano fastidiosi su un'app d'uso quotidiano. Grana animata. Illustrazioni d'ambiente
come piante, lampade e poltrone, che invecchiano più in fretta di qualunque altra cosa: il calore
lo devono portare la luce e la tipografia. Transizioni di pagina ovunque: se ogni navigazione ha
la sua animazione, il rito di apertura non è più un rito, è la norma.

### La regola contro la monotonia

**La varietà deve venire dai dati, non dalla decorazione.** Un'app diventa monotona quando ogni
schermata ha la stessa forma indipendentemente da cosa contiene.

Montaigne ha quattro sorgenti di varietà che non costano nulla e non stancano, perché sono
conseguenze del contenuto: lo scaffale cambia man mano che la libreria cresce, e non c'è una
libreria uguale a un'altra; la luce cambia con l'ora, quindi l'app delle nove di sera non è
quella delle otto del mattino; gli insight cambiano forma secondo la lunghezza, quindi la stessa
schermata legge diversa su libri diversi; gli Annali cambiano di anno in anno.

**La fine di un libro merita un momento, l'avanzamento no.** È la regola che tiene lontana la
monotonia senza scadere nella ludicizzazione: chiudere una lettura è l'unico evento dell'anno che
vale una piccola cerimonia. Se festeggi tutto, non hai festeggiato niente.

---

## 22. Le lamentele del settore

Sintesi delle recensioni a una e due stelle delle cinque app più installate (Goodreads,
StoryGraph, Fable, Hardcover, Bookly).

### Già risolte per costruzione

| Lamentela | Perché non ti riguarda |
|---|---|
| Interfaccia ferma al 2013, ricerca lenta, molti tocchi per cambiare scaffale | App nuova, filtro e ricerca sempre a vista sullo scaffale (le azioni rapide dal volume senza aprire il libro, §7, sono ancora rimandate) |
| Paywall sulle statistiche di base | Istanza privata |
| Feed, club e consigli di influencer che intralciano chi legge da solo | Il PRD esclude feed, notifiche, commenti |
| Ludicizzazione paternalistica, sfida annuale demotivante | Il PRD esclude obiettivi, sfide, serie. **Tenerle fuori anche post MVP** |
| App mobile che arranca dietro al web | Parità decisa |
| Copertine sgranate o deformate, lamentela ricorrente su almeno quattro app | Le copertine sono conservate a due misure fisse e i volumi senza copertina hanno un colore dominante calcolato, quindi una copertina mancante o brutta non rovina mai lo scaffale |

### Dove Montaigne è peggio di tutta la categoria

**L'esportazione.** Le altre app perdono note e date migrando; Montaigne non ha esportazione, non
ha backup sul piano gratuito, e la cancellazione è immediata. Il PRD lo dichiara come lacuna
nota. È l'unica dimensione in cui sei sotto a tutti, e riguarda anni di insight scritti a mano.

**Il catalogo.** Edizione sbagliata o libro assente sono la lamentela più diffusa del settore, e
tu hai l'aggravante che il libro non trovato non si può aggiungere affatto. Il design non risolve
la deduplicazione, ma può distinguere sempre "non esiste" da "il catalogo non risponde", e
rendere facile la richiesta al manutentore.

### Il rischio specifico del modello

Il tracciamento pagina per pagina sposta l'attenzione dalla lettura alla registrazione, e se il
tracciamento sembra un compito a casa si smette di farlo. Il PRD moltiplica per dieci le scritture
rispetto al conteggio a fine lettura: **hai costruito il modello che rende il fenomeno più
probabile.** Contromisure già nel documento: azioni dal volume (rimandate, §7), salvataggio ottimistico, tastiera
numerica, invio che salva.

---

## 23. Da verificare

Sei punti che si risolvono provandoli con contenuti veri, non discutendone.

1. **Lo scaffale a mensole su mobile**, mai provato. È l'unica scelta strutturale presa senza
   verifica, e la striscia orizzontale ha già insegnato che provare cambia il verdetto.
2. **La soglia fra sentenza e appunto**, indicata a ~200 battute.
3. **Il serif a corpo 19 su un insight lungo:** regge le frasi brevi, va provato su un paragrafo
   di appunti pratici.
4. **Il perimetro della traduzione**, che il PRD rinvia alla fase di costruzione.
5. **Fraunces accanto a Literata**, sulla stessa schermata: titolo in Fraunces, insight in
   Literata, a mezzo centimetro di distanza.
6. **Le ombre al buio.** Un'ombra scura su un fondo scuro può sparire o, peggio, formare un
   alone. Vanno tarate sulla schermata reale, non calcolate.

---

## 24. Descrizione dell'opera

La lacuna era temporanea: il Libro ha una descrizione (§9), aggiunta durante l'analisi della
ricerca e aggiunta libro, con emendamento al PRD (entità Descrizione). Fonte preferita
Wikipedia — prosa scritta per spiegare di cosa parla un libro, non per venderlo — con ripiego
su Google Books quando l'opera non è abbastanza notabile per avere una voce. Nessuna
generazione da un modello: solo testo che una fonte ha già scritto, mai inventato.

**Emendamento del 21 agosto 2026, esteso il 22 agosto 2026: standardizzazione assistita delle
descrizioni fuori standard.** Misurato dal vivo: alcune voci Wikipedia si riducono a una sola
frase ("Le notti bianche è un racconto giovanile di Fëdor Dostoevskij."), sotto lo standard di
prosa breve che questa sezione chiede; altre — soprattutto le trame di Google Books, scritte per
vendere — lo superano abbondantemente. La regola "mai inventato" resta, ma si applica ai *fatti*,
non alla *formulazione*: un lavoro in secondo piano (issue #20bis,
`app/lavori/standardizzazione_descrizione.py`) riformula le sole descrizioni fuori dalla fascia
200-900 caratteri — espandendole o accorciandole secondo il caso — a **400-600 caratteri, 3-5
frasi, registro enciclopedico** (lo stesso di un incipit Wikipedia: neutro, informativo, mai
promozionale). Quelle già nella fascia restano quelle originali della fonte, senza passare dal
modello. Chiamato "standardizzazione" e non "arricchimento": un nome che promettesse solo di
espandere sarebbe disonesto per un lavoro che accorcia altrettanto spesso.

Tre vincoli che tengono ferma la regola originale:

- **Ancorato solo a fatti già verificati**: il modello riceve il testo sorgente reale e i dati
  già presenti nel database (titolo, autori, anno di prima pubblicazione, generi) — mai la sua
  conoscenza generale dell'opera. Verificato dal vivo che un modello generico non rispetta questo
  vincolo per default su un'opera nota (ha aggiunto l'ambientazione a San Pietroburgo di "Le notti
  bianche" pur non essendo nella frase sorgente): il prompt istruisce esplicitamente a fingere di
  non sapere altro sull'opera, con un esempio concreto di cosa non fare. Se il sorgente è troppo
  scarno per raggiungere 400 caratteri restando fedele, il testo prodotto resta più breve — anche
  100-200 caratteri sono un esito corretto, preferibile a un testo più lungo con anche un solo
  dettaglio non verificabile.
- **Accorciare non deve alterare il significato**: nessun fatto nuovo (si toglie, non si
  aggiunge), ma il prompt vieta esplicitamente di tagliare un dettaglio che ne qualifica un altro
  (una data, una condizione) lasciando un'affermazione che il testo originale non faceva — nel
  dubbio, il prompt istruisce a restare sopra i 600 caratteri piuttosto che perdere un fatto
  qualificante.
- **Tracciato in database**: `libro_descrizione.riformulata` marca il testo come riformulato dal
  modello (espanso o accorciato) — stesso trattamento di `anno_dedotto`/`lingua_dedotta`.
  **Emendamento del 22 agosto 2026**: l'etichetta di trasparenza in scheda che segnalava questo
  stato è stata costruita e poi tolta su richiesta esplicita, insieme a quella per "dedotto"
  (§9) — il campo resta nell'API per un'eventuale reintroduzione, ma oggi il testo riformulato
  si mostra senza distinguerlo dalla citazione letterale della fonte.

Non richiede consenso dell'Utente (funzione bibliografica su dato condiviso, come le altre tre
dell'issue #20 — ADR 0008): lavora solo su titolo/autori/anno/generi/descrizione di catalogo,
mai su contenuto personale.

---

## 25. Ricerca semantica

Scritta il 22 agosto 2026 con l'issue #6. È l'unica schermata del prodotto nata dopo la stesura
del documento invece che prima: fino ad allora la ricerca semantica compariva solo come divieto
in §7 ("non va fusa nel campo sopra") e come promessa in §10, senza una forma propria.

**Una pagina a sé, `/cerca`.** Non un secondo campo sullo scaffale, per la ragione già scritta
in §7: revocare il consenso lascerebbe l'utente senza il modo di trovare un libro, e i due campi
farebbero un mestiere diverso con lo stesso aspetto. Ci si arriva da un collegamento in fondo
alla riga dei filtri della Libreria — dove nasce il bisogno — e **non da una voce di menu**: la
navigazione ha quattro voci (§5) e restano quattro. Una quinta voce per una funzione che dipende
da un interruttore sarebbe la sola dell'elenco a poter essere spenta.

**Non cerca mentre si digita**, a differenza del filtro dello scaffale e della ricerca sui
cataloghi (§13, "risultati che compaiono mentre si digita"). Due ragioni che vanno nella stessa
direzione: ogni interrogazione costa una chiamata al fornitore, e una domanda in linguaggio
naturale si finisce di scrivere prima di volerla porre — "che cosa ho scritto sul tempo" a metà
è una domanda diversa, non una versione incompleta della stessa. Campo con la sola riga
inferiore come ogni altro campo dell'app, `aria-label` esplicita, e un pulsante "Cerca" accanto.

**Un risultato è l'insight, con accanto il libro da cui viene**, come stabilisce §10: prima il
titolo e l'autore in `t-meta` come collegamento alla scheda, poi il testo nel suo trattamento
tipografico normale (sentenza o appunto secondo la lunghezza, stessa soglia di §10), poi la
data e il tipo. Non una riga di libro con l'insight sotto: la pagina risponde a "cosa ho scritto
al riguardo", non a "quali libri parlano di".

**Uno spoiler compare in chiaro qui**, a differenza di ogni altro elenco (regola 10) — e non è
un'eccezione alla regola, è la sua applicazione corretta: la regola protegge da uno spoiler
*altrui*, e in questa pagina ogni risultato è già garantito del richiedente, mai di un collegato
(la ricerca non attraversa mai i contenuti condivisi, §7). Nascondere a qualcuno un proprio
testo non protegge nessuno. Il contrassegno resta comunque leggibile accanto a data e tipo
("· spoiler per i tuoi collegati"), come promemoria di ciò che si è marcato per gli altri — non
come avviso su ciò che si sta per leggere, che qui non serve. **Costruito così solo dopo un
primo giro d'uso** (22 agosto 2026): la prima stesura applicava lo stesso taglio della scheda
del libro, prima di accorgersi che non proteggeva nulla e impediva solo di ritrovare i propri
insight.

**I risultati passano un filtro di pertinenza minima**, non solo un limite di quantità:
`cerca_semantico` scarta chi è oltre una certa distanza dalla domanda, invece di riempire sempre
fino a un tetto fisso. Senza quel filtro, una libreria piccola (poche decine di contenuti)
restituirebbe sempre tutto ciò che ha, semplicemente riordinato — non perché pertinente, ma
perché non c'è nient'altro da escludere. La soglia è tarata sui dati, non a occhio, e resta un
primo tentativo: se in uso reale nasconde risultati veri o ne lascia passare troppi, si rivede
in un punto solo (commento sulla RPC, `supabase/migrations/`).

### I tre stati che non vanno confusi

È il punto della schermata, e il PRD lo impone due volte.

| Stato | Cosa si mostra |
|---|---|
| Nessuna corrispondenza | "Non hai ancora scritto nulla che somigli a questa domanda." |
| Consenso revocato | Uno stato vuoto che dice che la funzione è spenta e rimanda alla Torre |
| Indici in ricostruzione | I risultati che ci sono, **più** una riga che dichiara che sono incompleti |

Il secondo caso è dettato alla lettera: "l'interfaccia dichiara che la funzione è disattivata,
invece di restituire zero risultati come se non ci fosse nulla da trovare". Un elenco vuoto
direbbe la cosa falsa più credibile che esista — che non hai scritto nulla al riguardo. Il terzo
pure: "finché non sono pronti la ricerca semantica è incompleta e lo dichiara". La riga sta
sopra i risultati, non sotto: chi legge un elenco corto deve sapere perché è corto prima di
concludere che è tutto.

Nessuno dei tre è un errore, e nessuno dei tre è un riquadro rosso: sono testo, come ogni altro
messaggio dell'app (§19).
