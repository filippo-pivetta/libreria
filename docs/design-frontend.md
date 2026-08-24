# Montaigne · Design frontend

Il come dell'interfaccia. Compagno del PRD, che porta il cosa.

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
superficie che dal mattino alla notte si scurisce e cambia calore. È la conseguenza dell'ora,
come lo scaffale è la conseguenza della libreria.

**Emendamento (sessione UI).** Questa sezione diceva anche "non c'è interruttore, non c'è
scelta, la parola notte non compare nelle impostazioni", e più sotto nominava il costo di
quella scelta come "accettato": *chi ha una sensibilità alla luce non può forzare la stanza
scura di giorno*. Il costo era accettato ma non mitigato — le due mitigazioni promesse
(`prefers-contrast` e la modalità a colori forzati) non erano costruite, e
`prefers-color-scheme` non veniva letto da nessuna parte.

Oggi la Torre porta un comando a tre stati — **Segui l'ora / Chiara / Scura** — e le due
mitigazioni esistono (`tokens.css`). L'idea non è stata sostituita, è diventata il valore
predefinito: chi non tocca nulla continua a vedere la stanza seguire l'ora, e due collegati
che non hanno espresso preferenze vedono la stessa stanza allo stesso momento. Resta invariato
tutto il resto del meccanismo — calcolo lato server, cambio solo al cambio pagina, nessun
timer nel browser — perché la preferenza viaggia in un cookie `httpOnly` letto dal layout
radice, non in `localStorage` con uno script anti-lampeggio.

Fissare una preferenza fissa un ancoraggio (`giorno` o `notte`) senza interpolare: sono
scelte, non momenti, e un valore intermedio non vorrebbe dire nulla. Non introduce rischi di
contrasto, perché entrambi sono già fra i quattro punti che `scripts/check-contrast.mts`
verifica.

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

**Costo, e come è stato risolto.** Senza interruttore, chi ha una sensibilità alla luce non
poteva forzare la stanza scura di giorno: è la ragione del comando a tre stati descritto
sopra. Restano onorati anche `prefers-contrast` e la modalità a colori forzati del sistema,
ora davvero costruiti in `tokens.css` — chi alza il contrasto di sistema lo vuole in entrambe
le stanze, quindi il comando in Torre non li rende superflui.

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

### La scala di Inter Tight

Le tre famiglie erano giuste; la scala dentro Inter Tight aveva un buco, ed è costato più di
quanto sembri. Esistevano due soli ruoli — `.t-label` (10,5px, maiuscoletto, `0.13em`,
`ink-soft`) e `.t-meta` (12,5px, `ink-soft`) — e **nessun ruolo in inchiostro pieno a corpo di
lettura**. Le conseguenze si vedevano ovunque:

- ogni sezione dell'app si annunciava con `.t-label`, cioè con il carattere più piccolo dello
  schermo, in maiuscoletto spaziato e in inchiostro secondario;
- il testo che è **contenuto** — la riga di stato di una copia, il riepilogo di una
  cancellazione, un elenco di letture — finiva in `.t-meta`, cioè vestito da nota a piè di
  pagina;
- e dove nessuna delle due andava bene, venti punti dell'app se lo scrivevano a mano come
  `font-ui text-sm text-ink`, che è un ruolo non dichiarato usato da venti chiamanti.

| Ruolo | Specifica | Dove |
|---|---|---|
| `.t-section` | Inter Tight, 600, **14px**, `ink` | Titolo di sezione. Sostituisce `.t-label` in questo mestiere |
| `.t-body` | Inter Tight, 400, **15px**, interlinea 1,5, `ink` | Testo di interfaccia che è contenuto |
| `.t-meta` | Inter Tight, **13px**, `ink-soft` | Metadati veri: date, conteggi, unità. Mai contenuto, mai un comando |
| `.t-label` | Inter Tight, 10,5px, maiuscoletto | **Solo** micro-etichetta sopra un dato |

`.t-meta` sale da 12,5 a 13px. Mezzo pixel non è una rifinitura estetica: è la soglia sotto cui
una riga di metadati in `ink-soft` smette di essere scandibile su uno schermo denso, e sotto
quella soglia c'era metà del contenuto della scheda del libro.

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

**Due barre, non una resa elastica (sessione UI).** Da 640px in su la barra sta in cima ed è
fissa allo scorrimento — le due barre contestuali (§15) lo erano già, e quella di casa propria
no. Sotto i 640px le stesse quattro voci diventano una barra in fondo allo schermo, dove sta
la navigazione di un'app e dove arriva il pollice; nome utente ed "Esci" escono da lì e
passano in Torre, che è la loro sede naturale. Lo scambio è in CSS, non in JavaScript, quindi
non c'è un istante in cui compare la barra sbagliata.

Prima era una riga sola, senza `flex-wrap` e senza un solo breakpoint, identica a 320px e a
1440px: su un telefono non ci stava, e non si vedeva perché `overflow-x: hidden` sul body la
tagliava in silenzio. I bersagli erano alti ~14px.

**Senza icone, di proposito.** Una barra in fondo di solito le ha, ma in tutta l'app non
esiste un vocabolario di icone — due chevron in un selettore d'anno e qualche glifo
tipografico. Inventarne quattro qui aprirebbe un linguaggio visivo nuovo per un componente
solo. Quattro parole corte bastano, e la voce attiva si legge dal filetto come in alto.

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

**Vista unica.** Non esiste un selettore di vista e non esiste una vista a elenco: esiste uno
**scaffale di copertine con la costa**. Ogni volume, da sinistra a destra:

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
9. **Le voci senza pagine adottate** hanno la costa (lo spessore, che deriva dal conteggio
   pagine) in contorno tratteggiato, senza riempimento e senza ombra: l'assenza di dato va
   dichiarata, non gridata. Il tratteggio tocca solo la costa, mai la copertina — foto vera o
   segnaposto colorato che sia, la copertina non dipende dalle pagine e resta quella normale
   anche quando le pagine sono ignote.
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
seconda versione più desaturata per la stanza scura, non ancora costruita (`docs/lavoro-
rimandato.md`).

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
Pagina a sé, §25: qui resta solo la porta.

**Un ingresso solo per le tre funzioni assistite (sessione UI).** §7, §25 e §26 hanno aggiunto
ciascuna a suo tempo il proprio collegamento "accanto ad Aggiungi un libro", e nessuno le ha
mai viste tutte e tre insieme: la riga dei filtri era diventata campo di ricerca + cinque
pastiglie + conteggio + **quattro** collegamenti-pulsante di pari peso, misurati in 380 pixel
di comandi prima del primo libro su un telefono da 360px — metà schermata di chrome davanti al
contenuto — con l'azione principale dell'app in tono minore, ultima di quattro.

Oggi sono tre fasce: il titolo con "Aggiungi un libro" in evidenza (pulsante pieno, è il gesto
con cui la libreria esiste); il filtro; e un disclosure "Chiedi alla libreria" che raccoglie
ricerca semantica, suggerimenti e sintesi. La ragione di tenerle fuori dalla navigazione a
quattro voci resta valida — dipendono da un interruttore, e una voce di menu che può essere
spenta è una voce sbagliata — ma la conseguenza no. Un collegamento e non un secondo campo — due campi di ricerca
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

**Indice a lettere sul bordo** come elemento a sé (l'unghiatura delle rubriche): scartato. Le
tacche fra i volumi (regola 6) risolvono lo stesso problema senza un elemento separato, e non
si vuole aggiungere uno scroller a lettere.

---

## 8. Mobile

Mobile pari a desktop, con il mobile come riferimento nei casi di dubbio. Ogni schermata si
progetta e si verifica mobile-first, mai il contrario.

**Com'era davvero, prima della sessione UI.** Questa riga era un'intenzione, non una
descrizione: 66 file su 73 non avevano un solo breakpoint, il controllo più alto del sistema
era 36px, la navigazione andava in overflow a 360px, e `env(safe-area-inset-*)` non compariva
da nessuna parte. Quello che regge oggi, misurato in Chrome a 360px: nessun overflow
orizzontale, nessun bersaglio sotto i 44px, barra in fondo con area di sicurezza.

Il tocco non si risolve componente per componente: una regola sola in `tokens.css`, dietro
`@media (pointer: coarse)`, porta ogni bersaglio a `--tap`. La densità del desktop resta quella
scelta qui, e non si dimentica al prossimo componente scritto.

**Ma una densità non è una gerarchia.** La regola `pointer: coarse` risolve il *bersaglio*, non
il *peso*: un bottone alto 28px sul desktop e 44px sul telefono resta, sui due schermi, due cose
diverse — e su entrambi non dice se sia l'azione principale o l'ultima. La scala dei comandi
(§9) ora dichiara quattro pesi, e l'azione primaria è a 44px **anche col mouse**: quel numero
non appartiene al pollice, appartiene alla gerarchia.

**Il ritorno.** Sotto i 640px `ProtectedNav` non monta niente in cima. Chi progetta una rotta
nuova deve chiedersi da dove si esce: la scheda del libro non se l'era chiesto, ed è rimasta
senza ritorno su mobile fino al ridisegno (§9).

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

> **Riscritta.** La versione precedente prescriveva "volume aperto, due pagine": a sinistra
> l'opera, a destra la tua copia, separate da un vuoto di 2px. Quella specifica è caduta, e le
> ragioni stanno qui sotto perché non venga riproposta.

### Perché le due pagine sono cadute

La metafora era bella e parlava della cosa sbagliata: **l'oggetto**. Una scheda di libro non è
un libro aperto, è il posto dove un lettore torna a vedere dov'è arrivato. Costava tre volte.

1. **La colonna destra era un deposito.** Ci finivano stato, avanzamento, transizioni, voto,
   recensione, nota, parere e cancellazione: otto blocchi senza rapporto fra loro, impilati a
   `mb-5` l'uno dall'altro, senza niente che dicesse quale contasse. E in mezzo, la sola azione
   irreversibile della pagina — togliere la voce — collocata **prima** di contenuti che si
   possono ancora leggere.
2. **Le due colonne non hanno la stessa lunghezza naturale**, e per pareggiarle serviva un
   `min-h-[640px]` su entrambe: un'altezza scelta a occhio che lasciava un vuoto sotto la più
   corta. Una pezza, non un progetto.
3. **Su mobile l'ordine era rovesciato.** Impilate, le due pagine mettevano copertina, titolo,
   dati bibliografici, generi e descrizione intera **prima** della tua copia. Il PRD dice che
   il mobile è il riferimento nei casi di dubbio; qui non era nemmeno un caso di dubbio,
   perché sull'unico schermo dove l'ordine è anche una gerarchia il dato condiviso passava
   davanti a quello personale.

### Cinque zone

La metafora nuova è **dove sei / cosa ne pensi / cos'è**, e parla del lettore.

| | Zona | Contenuto |
|---|---|---|
| 1 | **Testata** | Copertina accanto al titolo, autori, stato in chiaro, la tua cronaca con questo libro |
| 2 | **Segnalibro** | Dove sei. **Una sola azione piena in tutta la pagina** |
| 3 | **Giudizio** | Voto, recensione, nota di intenzione |
| 4 | **Il libro** | Fatti, generi e "di cosa parla" — in colonna laterale |
| 5 | **La storia** | Letture e insight — in colonna principale |

Due colonne da 1024px in su, **tre blocchi**, non due: segnalibro+giudizio (zone 2+3) in
colonna 1 riga 1, il libro (zona 4) in colonna 2 su entrambe le righe (`row-span-2`, `sticky`),
la storia (zona 5) in colonna 1 riga 2 — sotto il giudizio, esplicitamente posizionata lì con
`lg:col-start`/`lg:row-start`. Sotto i 1024px la griglia collassa e i tre si impilano
nell'ordine del DOM: segnalibro+giudizio, poi il libro, poi la storia. Nessun `order-*`, nessun
`min-height` da nessuna parte: ogni blocco è alto quanto il suo contenuto.

**L'opera sta di lato** perché è il dato condiviso: non è tua, non la puoi
correggere (il PRD vieta la correzione dei generi a chiunque, e non prevede nemmeno una
segnalazione — l'assenza di comandi resta il messaggio), e la sola cosa tua che ci sta dentro,
le pagine della tua copia, resta lì perché è un fatto bibliografico e non un dato di
avanzamento.

**Niente copertina a tutta larghezza in cima.** Questa regola della versione precedente resta,
e per la stessa ragione: schiaccerebbe il contenuto personale sotto la piega dello schermo. La
copertina sta *accanto* al titolo, non sopra.

### Zona 1, la testata

Copertina sul piano 2 con la sua ombra doppia — è l'unico oggetto raster dell'app e vale la
pena che si veda come oggetto. Titolo in Fraunces `t-display`, autori sotto in Inter Tight.

Sotto gli autori **non** vanno i dati dell'opera (vivono nella zona 4): va la tua cronaca con
questo libro — "Cominciato il 12 gennaio · riletto una volta · 3 insight" — che è l'unica cosa,
in cima, che non si trova già altrove.

**Lo stato è una pastiglia, non un moncone.** Prima il nastro era un rettangolo colorato di
12×22px nell'angolo, e la parola stava altrove in `.t-label`: il dato più importante della
pagina diviso fra un segno muto e il testo più piccolo dello schermo. Ora è un punto del colore
del nastro **più la parola**. Il colore resta il legame con lo scaffale, dove il nastro *è* il
linguaggio (§7); la parola fa il lavoro che sullo scaffale fa la **lunghezza** del nastro — e
che qui la lunghezza non può fare, perché di nastri ce n'è uno solo e non c'è niente con cui
confrontarlo. "Da leggere" non ha nastro: il punto diventa un cerchio vuoto, così le cinque
pastiglie restano della stessa misura.

### Zona 2, il segnalibro

Un blocco solo, sempre nello stesso posto, che **cambia forma con lo stato** e porta una sola
azione piena. Prima questa zona non esisteva: negli stati "da leggere" e "letto" il modulo di
avanzamento spariva e al suo posto non veniva niente, quindi la parte alta della pagina restava
vuota proprio dove c'è meno da fare e più da decidere.

| Stato | Cosa dice | Azione piena |
|---|---|---|
| **In lettura** | Pagina corrente in Fraunces a corpo grande, "di N", percentuale, barra trascinabile | **Segna la pagina** |
| **Da leggere** | "Non l'hai ancora cominciato" | *(la transizione "Inizia a leggere")* |
| **In pausa** | Dove sei fermo, barra spenta, "in pausa non si registrano avanzamenti" | *(la transizione "Riprendi")* |
| **Letto** | "Finito il …", con la data d'inizio | — |
| **Abbandonato** | "Lasciato il …", con la pagina raggiunta | — |

La barra di avanzamento resta **a due colori**: quello già salvato in accento smorzato, il
tratto che si sta per salvare in accento pieno, con il segno del pavimento fra i due. È la sola
parte che cambia mentre si trascina, quindi è la sola satura. In sola lettura è alta 8px, non
1,5: un filo non dice una frazione, lo si legge solo perché accanto c'è il numero.

**Le transizioni scendono sotto, fuori dalla carta.** Cambiare stato è una cosa che fai al
libro, non il libro che ti dice dove sei. Restano le due più frequenti in evidenza e le altre
sotto "Altro" — e **l'interfaccia continua a non offrire mai una transizione vietata**, invece
di offrirla e poi rifiutarla. Il campo data usa sempre uno stile proprio (`CampoData`), mai
l'aspetto nativo del browser.

### Zona 3, il giudizio

Voto, recensione e nota di intenzione stanno in **una carta sola**: sono tre modi di dire la
stessa cosa — che cosa ne pensi — e prima erano tre blocchi slegati incastrati fra un modulo di
avanzamento e un comando di cancellazione.

Il voto resta 1–5 a scatti di mezza stella, con ogni stella divisa in due zone cliccabili e il
sollevamento al passaggio del mouse (§7); un secondo clic sul valore già scelto lo cancella. Le
stelle passano da 18 a 27px — è un gesto di precisione, quindi il bersaglio dev'essere grande —
e da glifi di testo (`★`, `☆`) a **tracciati SVG**: un glifo lo disegna il carattere che il
sistema sceglie per quel codepoint, e non è quasi mai quello dell'app.

### Zona 4, il libro

**Solo fatti in riga**, più i generi come pastiglie senza affordance di modifica. Niente
descrizione: la carta laterale è un elenco di coppie etichetta/valore, e un abstract di catalogo
è prosa da leggere, non un metadato.

Tenercela dentro costava anche l'impaginazione. In 320px mille battute sono una trentina di
righe: appena si apriva, la colonna laterale diventava più lunga della principale e accanto
restava un vuoto alto uno schermo — che `lg:sticky` non poteva rimediare, perché un elemento
sticky più alto del suo fratello non ha niente a cui restare appeso. La descrizione passa alla
zona 5.

### La storia sta nella colonna principale, e regge tutta la pagina

È la decisione strutturale della scheda, ed è costata tre correzioni sbagliate per arrivarci —
vale la pena scriverle, perché il modo in cui si sbaglia qui è più istruttivo della conclusione.

Partendo da **storico e insight tirati fuori** dalla colonna, a piena larghezza sotto la griglia,
la principale resta alta ~750px mentre la laterale con la descrizione aperta ne fa ~950. Da lì in
poi qualunque cosa si metta di lato la supera, e ogni rimedio cura un sintomo e ne produce un
altro:

1. la laterale è **troppo lunga** → vuoto a sinistra. *Rimedio: la descrizione scende in fondo.*
2. ora è **troppo corta** (~260px contro ~1300) → vuoto a destra. *Rimedio: il giudizio a
   `col-span-2`.*
3. la riga chiude pari ma il parere resta incolonnato a sinistra → **due carte impilate con il
   bordo destro disallineato**, che si legge come rotto ed è peggio del vuoto di prima.
   *Rimedio: via la griglia.*
4. senza griglia il segnalibro è largo 976px ed è la prima cosa che si vede, mentre pagine e
   descrizione stanno in fondo: **"pagina 284 di 712" arriva uno schermo prima del 712**, che è
   il solo numero della pagina che si possa correggere.
5. la griglia torna, con storico e insight **annidati dentro** lo stesso contenitore di
   segnalibro e giudizio: risolve il buco, ma su mobile — dove la griglia collassa a una colonna
   e stacka nell'ordine del DOM — l'INTERO blocco, storia compresa, precede l'aside. **Il libro
   e "di cosa parla" finiscono sotto gli insight.** *Rimedio: la storia esce dal contenitore.*

Il difetto non era mai la descrizione, il giudizio o la griglia: era il passo zero. **Con
storico e insight a bilanciare l'altezza della colonna principale, quella vale 1300px e passa**,
la laterale può aprire tutta la descrizione senza avvicinarsi — ma perché serva anche su mobile,
la storia dev'essere un **terzo figlio diretto della griglia**, non annidata dentro il blocco di
segnalibro e giudizio: annidata, pesa sull'altezza ma trascina anche l'ORDINE, e su mobile il suo
contenitore viene prima dell'aside per intero. Da tre figli diretti — in alto, il libro, la
storia, in quest'ordine nel markup — l'ordine mobile è semplicemente quello del DOM, mentre da
`lg:` in su un posizionamento esplicito (`lg:col-start-1 lg:row-start-1` sul blocco in alto,
`lg:col-start-2 lg:row-start-1 lg:row-span-2` sul libro, `lg:col-start-1 lg:row-start-2` sulla
storia) li rimette dove stavano visivamente. Tutti e cinque i rimedi diventano inutili nello
stesso momento.

Ci guadagnano anche gli insight: a 632px la misura interna dell'appunto viene ~68ch e la sentenza
~34ch, cioè esattamente il contrasto che §10 promette. A piena larghezza erano troppo larghi per
il ruolo che hanno.

**Regola generale, buona oltre questa pagina:** quando serve un `order-*` per raddrizzare la
gerarchia su mobile, o un `min-height` per pareggiare due colonne, quasi sempre il problema non è
lì — è che una colonna è messa dove non doveva. La scheda oggi non ha né l'uno né l'altro.

Per un collegato "Nella tua libreria" sta **in cima alla colonna principale**: è l'unico comando
della pagina, agisce sulla tua libreria e non sulla sua, e di lato su mobile sarebbe finito in
fondo.

### Zona 5, la storia

Letture e insight, in coda alla colonna principale, separate dal giudizio da un filetto: sopra
quello che pensi adesso, sotto quello che è successo. Per gli insight vedi §10.

**"Di cosa parla"** è una carta a sé sotto i fatti, non un blocco dentro la loro: là ci sono
coppie etichetta/valore da scandire con l'occhio, qui prosa da leggere. Tagliata a sei righe
sopra le **230 battute** — la soglia è tarata sulla colonna, non su una misura ideale: a 320px
una riga di Literata a 15px porta ~37 battute, quindi sei righe sono ~230. Tararla sui numeri di
una misura da 68ch vorrebbe dire lasciar scorrere quattordici righe prima di offrire il taglio,
cioè non tagliare. Alla misura giusta lo stesso testo che in colonna faceva trenta righe ne fa otto,
quindi aprirlo costa quasi niente e il taglio smette di essere un modo di nascondere un
problema. E il posto è quello giusto anche per gerarchia: non è un dato tuo e non è un comando,
quindi non compete col segnalibro né col giudizio, ma è il primo pezzo di contesto che serve per
leggere le letture e gli insight che seguono. L'assenza resta muta: senza abstract non c'è né
titolo né riga vuota.

### "Me lo consigli?", solo su "da leggere"

Il parere vive nella **colonna principale, sotto la zona 2, e in un solo stato**.

Prima stava in colonna laterale in ogni stato, e in tre stati su quattro faceva una domanda a
cui la pagina aveva già risposto: a chi sta leggendo un libro, a chi l'ha finito e gli ha dato
quattro stelle, a chi l'ha abbandonato a pagina sessanta, "me lo consigli?" non chiede niente.
La decisione è aperta in un solo stato — il libro è lì e non l'hai cominciato — e lì il parere è
esattamente il consiglio che serve. Sta sotto la zona 2 perché è l'aiuto a decidere il comando
che la zona 2 offre un centimetro sopra ("Comincia a leggere"), non un dato dell'opera da
incolonnare di lato.

**Un parere già chiesto non sparisce mai, ma si fa da parte.** Lo stato governa l'*invito* a
chiederne uno, non l'esistenza del blocco: legarla allo stato renderebbe un contenuto
dell'Utente irraggiungibile e incancellabile appena preme "Comincia a leggere", e il PRD dice che
ogni contenuto proprio si può cancellare.

Non basta però spegnere i comandi e lasciare la carta com'era: una carta alta seicento pixel,
intitolata con una domanda, che spiega perché non leggere un libro che stai leggendo, è rumore —
e su "in lettura" occupava più spazio del giudizio. A decisione chiusa il parere diventa
**retrospettivo**: titolo al passato ("Il parere che avevi chiesto"), da `t-sentenza` a
`t-appunto` perché non è più una frase che decide ma un appunto di allora, tagliato a due righe,
e il solo comando che serve — cancellarlo. Da seicento pixel a centoventi.

Senza parere e senza decisione aperta il blocco non compare affatto — l'assenza è muta (§15),
non una carta vuota.

Resta aperta la domanda vera, che è di prodotto e non di impaginazione: il posto giusto per
"me lo consigli?" sarebbe **prima di aggiungere il libro**, cioè sulla scheda di un libro che
non hai ancora. Oggi non si può — `POST /voci/{voce_id}/preview` lega l'artefatto a una Voce, e
una Voce esiste solo dopo l'aggiunta — ma è un limite dell'implementazione, non una scelta di
design. Vedi la nota in §15 sulla ricerca.

I vincoli del PRD che restano: privata e mai condivisibile, sotto le ottanta parole, nessun
testo tra virgolette, e a consenso revocato l'interfaccia dice che la funzione è spenta invece
di far finta che non esista. **Nessun comando di condivisione, in nessuna forma** — non un
interruttore spento, non una voce assente da un menù: la regola 23 si garantisce facendo in modo
che l'operazione non esista, e non esiste nemmeno nel database.

Cade invece l'avviso **"Sintesi generata"**, che era la terza condizione della regola 20 e una
riga `t-meta` in cima al blocco. È stato tolto dal PRD, dal contratto del server e dalla pagina.
Serviva a non far scambiare un parere generato per un giudizio proprio, ma il parere esce solo a
chi l'ha chiesto un momento prima premendo un pulsante, sotto un titolo che è la domanda stessa,
e la regola 23 garantisce che non lo veda nessun altro: non restava nessuno da avvertire, e il
tag apriva il blocco al posto della risposta. La sintesi tematica conserva il proprio avviso,
che risponde a un'altra regola e ha altri lettori.

Lo **storico delle letture** non è più un `<details>` con `summary` in `.t-label`: era una
sezione annunciata dal carattere più piccolo dello schermo, con dentro righe di solo testo in
`.t-meta`. Ora è una carta con righe leggibili, sempre aperta — non c'è niente da nascondere in
due o tre letture — ordinata **dal più recente**, con un punto del colore del nastro per esito
(in corso, conclusa, abbandonata). Continua a non comparire affatto quando c'è una sola lettura
ancora aperta: è già raccontata dalla zona 2.

**Cancellazione di una lettura.** Tre livelli di attrito, come prima: menù di riga → comando →
"Cancella davvero"/"Annulla". Cambia solo che il menù è un menù vero (vedi sotto).

**Cancellazione dell'intera Voce.** **Due livelli, non tre**: "Togli dalla libreria" apre
direttamente il riquadro di conferma, che elenca con i conteggi reali cosa sparisce insieme alla
voce, e "Cancella davvero" cancella. Il passo di mezzo che c'era prima — un menù con una sola
voce, "Elimina la voce" — non chiedeva niente: era un clic che ripeteva la parola del bottone
che l'aveva aperto. Un attrito che non fa pensare non protegge, stanca e basta; l'attrito qui
sta nel CONTENUTO della conferma, che è la parte che fa davvero fermare.

Il riquadro è un pannello in pagina, non un modale: §19 vale anche qui, e questo non è il caso
per cui fare un'eccezione. Cambia anche la **posizione**: una riga di piede a piena larghezza, in
fondo a tutto, invece che a metà della colonna della copia. Il tono resta piano — niente rosso,
`alert` ha un solo uso in tutta l'app (§3) — ma ora la posizione corrisponde al peso. Nessun
campo da digitare: quel livello resta riservato alla cancellazione dell'account.

**Perché la lettura ne tiene tre e la Voce due.** Non è un'incoerenza: sulla lettura il menù di
riga porta più di un comando, quindi aprirlo è un gesto che serve comunque; sulla Voce il
comando è uno solo e vive già su una riga tutta sua in fondo alla pagina.

### I menù si aprono al clic, non al passaggio del mouse

Tre menù dell'app erano `<details>` scritti a mano, aperti su `mouseenter` e chiusi da un
`setTimeout` di 350ms su `mouseleave`. Quattro difetti, e il primo li contiene tutti:

1. **sotto il dito `mouseleave` non arriva mai.** Su un telefono il menù si apriva al tocco e
   restava aperto finché non si toccava di nuovo la linguetta: il gesto per chiuderlo non
   esisteva;
2. **Escape non chiudeva**, perché `<details>` non lo prevede;
3. **il fuoco non tornava** alla linguetta alla chiusura;
4. **il riquadro si tagliava** dentro qualsiasi antenato con `overflow: hidden`.

Si usa il primitivo `Menu` di Base UI, che è già una dipendenza (ADR 0014) e li risolve tutti
e quattro, con in più le frecce e la digitazione per saltare a una voce. Il riquadro esce in un
portale, quindi non si taglia, e si posiziona da sé contro i bordi.

### L'invito: una forma sola per "qui puoi scrivere"

L'app diceva la stessa cosa in tre grammatiche diverse, tutte quasi invisibili: "Scrivi una
recensione" e "Aggiungi una nota" come testo sottolineato a corpo 12,5 in `ink-soft`, "Scrivi
un insight" uguale, e la correzione delle pagine come campo con bordo tratteggiato e segnaposto
"correggi". Tre affordance, nessuna delle quali si legge come un comando, per l'atto centrale
del prodotto: depositare un testo.

Ora è una forma sola — riquadro tratteggiato a piena larghezza, `+`, testo a 14px. Il
tratteggio resta, ma diventa il bordo di un bersaglio intero: dice "vuoto" con la stessa figura
con cui dice "premibile". A riempirsi, l'invito sparisce e al suo posto arriva il pannello,
come ogni altro pannello in pagina (§19: l'app non ha modali).

### Interruttori, non comandi la cui etichetta è lo stato

Spoiler e visibilità erano comandi testuali sottolineati la cui etichetta *era* anche lo stato:
"Segna come spoiler" ⇄ "Contrassegnato spoiler", "Condivisa con i collegati" ⇄ "Privata, solo
tua". Da fermo non si distingue se una riga così **descriva** o **prometta** — sono due letture
opposte, e chi decide la visibilità di un testo che i collegati leggeranno merita di saperlo
senza provare.

Diventano pastiglie premute, con `aria-pressed`: l'etichetta resta ferma, cambia il riempimento.
Niente rosso e niente verde — un interruttore acceso è inchiostro pieno.

### Un insight si corregge, non solo si cancella

Nel menù di un insight c'erano un comando solo, "Cancella", e nessun modo di rimediare a un
refuso che non fosse distruggere il testo e riscriverlo — su un contenuto che il PRD dichiara
correggibile ("l'Utente può correggere e cancellare ogni contenuto proprio: avanzamenti
sbagliati, Letture aperte per errore, insight, recensioni, note") e che i collegati stanno già
leggendo. La rotta `PATCH /insight/{id}` esisteva sul server e il fetcher `correggiInsight`
esisteva nel client: mancava solo la superficie. Il menù guadagna **"Modifica"**.

La correzione usa **lo stesso modulo** della scrittura, non uno che gli somiglia: spoiler e
visibilità decidono cosa i collegati vedranno, e devono avere la stessa forma quando li scegli
la prima volta e quando li cambi. L'insight cede il posto al modulo dove sta — stessa transizione
dell'invito che diventa pannello, §19 — invece di aprirsi altrove. Le uniche differenze sono
l'etichetta del bottone di conferma ("Salva le correzioni") e i tre valori che partono da quelli
dell'insight.

### La gerarchia dei comandi

Quattro pesi, e uno solo pieno per zona.

| Peso | Altezza (desktop) | Uso |
|---|---|---|
| **Pieno** (`accent`) | 44px | L'azione primaria di una zona. Una sola |
| **Di contorno** | 38px | Le azioni secondarie: transizioni di stato, conferme |
| **Piano** | 38px | La terza per importanza: "Altro", "Annulla", menù di riga |
| **Invito** | 48px | Ciò che non c'è ancora e puoi scrivere tu |

Prima erano tutti `size="sm"`, cioè 28px e corpo 12,8, azione primaria compresa: quattro
bottoni dello stesso peso di cui uno salva un avanzamento e uno annulla la lettura in corso.
La densità del desktop resta una scelta del documento, ma **una densità non è una gerarchia**.
Sotto il dito `@media (pointer: coarse)` continua a portare ogni bersaglio a `--tap`.

### Su mobile

L'ordine si inverte rispetto a prima: testata (copertina **accanto** al titolo, non sopra),
segnalibro, giudizio, il libro — **chiuso**, con i dati in una riga sola — e infine la storia.
La tua copia arriva subito; l'opera si apre se la vuoi.

**Il ritorno alla libreria.** `ProtectedNav` monta la barra in cima dietro `hidden sm:block`,
quindi sotto i 640px la scheda di un proprio libro non aveva **nessun** comando di ritorno: si
usciva col gesto di sistema o toccando "Libreria" in fondo, che non è tornare indietro ma
ricominciare da capo, perdendo la posizione di scorrimento sullo scaffale. Il libro di un
*collegato* ce l'aveva già, perché lì la barra globale sparisce e arriva `BarraContestoLibro`
con il suo "‹ [nome]": la rotta ospite era trattata meglio della propria. Ora c'è "‹ Libreria",
appiccicata in cima, con lo stesso `PulsanteEsci`, solo sotto i 640px.

### Rito di apertura

**Non ancora costruito** (§23): oggi il volume è un link diretto, senza transizione. Specifica
per quando verrà fatto — il volume è già sollevato dal passaggio del mouse, quindi il clic parte
da lì; la copertina cresce e va al suo posto nella testata. (La versione precedente diceva
"nella pagina sinistra": non esiste più, la copertina è nella testata.)

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

**La sentenza guadagna il margine.** I due trattamenti da soli non bastavano a mantenere la
promessa di questa sezione — "in un libro con dodici insight, le due frasi buone risaltano da
sole" — perché stavano entrambi in righe a piena larghezza divise da un filetto: una tabella
sotto a dei testi che vanno letti. La sentenza va a **misura stretta (~34ch)**, l'appunto alla
misura piena. È il contrasto fra le due misure, non solo fra i due corpi, a far risaltare la
frase breve.

**Raggruppati per lettura**, come impone il PRD, che lega ogni insight alla lettura in cui è
nato.

> **Corretta.** La versione precedente diceva: "le letture più vecchie stanno su una carta di
> luminanza appena più vicina al fondo". Era implementata come una rampa (`100 − indice × 10`
> per cento verso `surface-0`) e non funzionava: fra un gruppo e il successivo la differenza è
> del 10% su una superficie già chiarissima, sotto la soglia in cui si legge come intenzione.
> In cambio rendeva la **carta** l'unità visibile, invece del testo.

Ora la lettura è un **capo**, non una carta: la data leggibile in `.t-section`, più un punto del
colore del nastro per esito — in corso, conclusa, abbandonata. Stesso vocabolario dello scaffale
e della pastiglia di stato (§9), quindi la profondità nel tempo si legge davvero, e senza un
meccanismo tutto suo.

**Ordine: dal più recente**, gruppi compresi, e detto in cima ("7 · dal più recente"). Prima i
gruppi scorrevano dalla lettura più vecchia alla più nuova e niente lo diceva. Un quaderno a cui
si torna mostra per prima l'ultima cosa che ci hai scritto.

**Gli orfani vanno in fondo, con un nome.** Sono gli insight scritti prima di cominciare il
libro, o rimasti quando la lettura a cui erano legati è stata cancellata (PRD: "restano sulla
Voce, senza più alcuna Lettura associata"). Prima stavano **in cima**, in una carta **senza
titolo**: la prima cosa che vedevi era un gruppo di testi di cui niente spiegava la provenienza.
Ora stanno alla fine, sotto "Fuori da una lettura", con una riga che dice perché esistono.

**Visibilità e spoiler diventano segni nel margine.** Un insight privato era indistinguibile da
uno condiviso: la visibilità per singolo insight è una promessa del PRD ed è reversibile, quindi
dev'essere **scandibile con l'occhio**, non deducibile aprendo qualcosa. Un lucchetto per il
privato, un occhio coperto per lo spoiler, nel margine sinistro allineati alla prima riga, in
`ink-soft` a opacità ridotta — come il segno a matita di un lettore, non come un distintivo.
**Condiviso è il default e non prende segno**: assenza, non colore, esattamente come "da
leggere" non ha nastro (§7).

Nessun bordo e nessuna ombra sui singoli insight: una campitura appena diversa dalla carta che
li contiene. Fra un insight e l'altro c'è **spazio**, non un filetto.

Data piccola, in Inter Tight, **sotto e non sopra**: la frase viene prima. Il menù di riga sta
nel piede accanto alla data, non più sospeso sull'angolo del paragrafo (`absolute top-2
right-2`, un bersaglio di 13px a due centimetri da dove il pollice scorre).

**Quando sono decine.** Il PRD dice "insight nell'ordine delle unità o decine per libro": a otto
sentenze in Literata si è già a uno schermo pieno, e uno schermo pieno di prosa senza appigli è
esattamente ciò che rende caotica una pagina che non ha nessun difetto di dato. Si mostrano i
primi otto per lettura, poi "mostra gli altri N". **Nessun filtro e nessun tag**: il PRD li
esclude esplicitamente, e una barra di filtri su una manciata di testi è rumore.

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

**Solo sugli insight di un collegato**, non sui propri: la regola 10 difende da uno spoiler
*altrui*, non da un proprio ricordo di ciò che si è già letto. Sulla propria scheda il testo
compare sempre per intero, con il **segno nel margine** e la parola "coperto per i collegati"
accanto alla data (§10) — non un avviso su cosa sta per leggere, che qui non serve, solo la
memoria di cosa si è marcato per gli altri. Prima era un suffisso appeso alla riga della data
("· spoiler per i tuoi collegati"), leggibile solo fermandosi a leggerla. Lo stesso vale nella ricerca semantica (§25): ogni risultato è già proprio, mai di un
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

Nessun testo di supporto sotto il campo: ripeterebbe il placeholder senza aggiungere
informazione, solo rumore visivo.

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

**Nessuna preview nella riga dei risultati.** Senza descrizione conterrebbe gli stessi sei dati
della riga stessa, e una riga di ricerca non è il posto per una chiamata al fornitore per
risultato. Questo però non chiude la domanda posta in §9: il parere prima dell'aggiunta ha senso
su una **scheda** di libro non ancora in libreria, non in un elenco. Oggi manca sia la scheda sia
la rotta — `POST /voci/{voce_id}/preview` pretende una Voce — ed è lavoro da mettere in conto,
non una porta chiusa.

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
  accanto — e, nella ciambella, dentro: uno spicchio neutro proprio come le altre voci;
- "di cui 2 riletture" chiarisce che l'unità è la Lettura e non il Libro.

Selettore ad anno a frecce, con l'intervallo dichiarato dal primo anno con dati a oggi. Anni
futuri non selezionabili; un anno intermedio senza letture mostra zeri, non un errore.

Autori più letti: classifica a cinque voci con "mostra tutte", barre in `accent`, mai una
scala di colori diversi per voce — sono la stessa grandezza misurata su soggetti diversi.
Generi principali: stesso principio ma a ciambella, perché il part-to-whole si legge meglio
come porzione di un intero che come barre affiancate;
resta un solo accento, non una tavolozza — gli spicchi sono la stessa tinta a passi di
opacità decrescenti (rampa sequenziale sul peso, non identità per colore), lo spicchio "non
classificato" è neutro (`surface-2`, lo stesso dell'assente sullo scaffale), al più cinque
spicchi con peso proprio oltre i quali si ripiegano in "Altri generi" — "mostra tutte" nella
legenda sotto la ciambella resta la via per vedere ogni genere singolarmente.

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

**Scheda Annali del collegato.** Le sue metriche di lettura, calcolate sui suoi
dati: stessa card della propria vista Annali (§14), più l'affiancamento con le tue metriche
dello stesso anno e i libri letti in comune con i voti affiancati.

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

Le impostazioni contengono cinque cose e basta: l'avviso di visibilità, **la luce della
stanza**, il consenso all'elaborazione assistita, l'esportazione dei libri letti, la
cancellazione dell'account.

La luce è arrivata dopo (sessione UI, §3): la riga precedente diceva "nessun comando sulla
luce, che non è una preferenza ma una conseguenza dell'ora", e resta vero come *comportamento
predefinito* — "Segui l'ora" è il valore che nessuno deve scegliere per averlo. Ma la
conseguenza dell'ora, senza scampo, era anche il costo che §3 dichiarava di accettare per chi
ha una sensibilità alla luce. Sta per prima fra le cinque perché è la sola che non riguarda i
dati: cambia come si vede l'app, non cosa l'app fa dei tuoi testi.

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

Quattro decisioni di design (esportazione dei libri letti e cancellazione dell'account,
ADR 0011):

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

### Esportazione dei libri letti

Un pulsante piano, tra il consenso e la cancellazione: nessuna conferma, perché non è
un'azione distruttiva. Scarica un CSV con i libri che l'Utente ha segnato come letti — titolo,
autori, generi, date di lettura, voto e recensione — mai insight né nota di intenzione (ADR
0011). Una riga di didascalia lo dice, così chi si aspetta di ritrovarci anche i propri insight
non se lo scopre solo aprendo il file.

Non è collegata alla cancellazione dell'account che segue subito sotto: non la propone, non la
richiede, non la ricorda. È semplicemente lì, sempre disponibile, per chi la vuole usare prima di
qualunque altra cosa.

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

**La forma di un errore (sessione UI).** La regola "cosa è successo e cosa fare" era la meno
rispettata di tutte: diciannove messaggi su quaranta cominciavano con *"Non è stato possibile"*
seguito da un infinito. Impersonale, modale e infinito — tre strati di distanza fra chi legge e
il fatto — e nessuno dei due pezzi che la regola chiede: non dicevano cosa fosse successo, solo
che qualcosa non era riuscito, e quasi mai cosa fare.

La forma adottata: **il soggetto è la cosa**, e segue il passo successivo.

> prima "Non è stato possibile salvare la recensione."
> dopo &nbsp;"La recensione non è stata salvata. Il testo è ancora qui."

Dove il testo dell'Utente è ancora nel campo, il messaggio lo dice: è la regola 25 del PRD resa
visibile, ed è l'informazione che più serve a chi ha appena scritto trecento parole.

Sono spariti anche i termini da idraulica che arrivavano fino allo schermo — *"Il backend non è
raggiungibile"*, *"Il backend ha risposto con stato 500"*, e persino il nome di una variabile
d'ambiente — e il titolo predefinito *"Qualcosa è andato storto"*, che compariva sopra ogni
errore dell'app senza aggiungere nulla ed è la stessa specie di "ops" che questa sezione vieta.

**Una voce sola per l'attesa.** Ce n'erano sette. Ora la prima persona vale solo dove l'app sta
davvero lavorando per te, quasi sempre con il modello ("Ci penso…", "Cerco temi…"); altrove
nessuna etichetta, perché uno scheletro con la forma del contenuto dice già cosa sta arrivando.

**L'apostrofo è quello tipografico (`’`), mai quello dritto.** Ce n'erano 248 dritti e nessuno
tipografico: in un'app che serve Fraunces e Literata con l'asse `opsz`, `'` è una tacca da
macchina da scrivere in mezzo alle grazie, ed era il difetto tipografico più visibile del
codice. Le stringhe vivono in `frontend/messages/it.json`/`en.json`, il catalogo `next-intl`
dell'interfaccia bilingue (issue #34): le stesse chiavi che finora stavano in
`src/messaggi/it.ts`, ora con la traduzione inglese a fianco.

**Tre canali, non cinque (sessione UI).** Ne convivevano cinque per dire le stesse cose —
toast, testo in linea con `useState` locale in otto componenti, testo per riga in quattro
altri, `ErrorState`, e il caso a sé del login — e il successo non ne aveva nessuno:
`"Salvato."` era copiato a mano in tre componenti, ciascuno con il proprio timer, e nessuno
dei tre lo puliva allo smontaggio né lo annunciava a un lettore di schermo.

| Canale | Quando | Dove |
|---|---|---|
| **In linea** (`ui/messaggio.tsx`) | il caso normale: il comando è ancora sotto gli occhi | accanto al comando, `aria-live="polite"` |
| **Toast** (`providers/toast-provider.tsx`) | il bersaglio può essere già scorso via, o la scrittura è ottimistica e l'errore arriva dopo che l'interfaccia si è mossa | in fondo alla pagina, `role="alert"` |
| **`ErrorState` / `EmptyState`** | fallisce o è vuota una regione intera | al posto della regione |

Un toast in fondo alla pagina non dice a quale riga di un elenco si riferisce: è la ragione
per cui il primo canale è il predefinito e il secondo l'eccezione, non il contrario.

Nessun modale, nessun avviso che si sovrappone: solo pannelli in pagina. Il toast è l'unica
deviazione, e resta tale. Resta fermo tutto il resto della regola: nessun
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

**Mai il layout, mai `box-shadow`.** La regola diceva "si animano solo `transform` e
`opacity`", ed era violata in nove componenti che usavano `transition-colors` — correttamente,
perché `color` e `background-color` passano dal paint e non dal layout, e sono la cosa giusta
per uno stato al passaggio del mouse. La regola vera è quella qui sopra: `box-shadow` non è
compositabile e ogni transizione di piano passa da uno pseudo-elemento a cui si anima
`opacity`; larghezze, altezze e margini non si animano mai. Tutto dietro
`prefers-reduced-motion`.

**Niente Motion, niente GSAP (sessione UI).** Questa sezione li dava per adottati; non sono mai
stati installati, e nulla di ciò che l'app fa li richiede. L'ingresso dei pannelli in pagina usa
`@starting-style` — che questa stessa sezione prevedeva e che non era stato costruito — e le
durate passano dai token `--dur-*`, che esistevano da sempre e non usava nessuno.

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
3. ~~**Il segnalibro trascinabile.**~~ Provato e rimosso (§12): il rischio di ambiguità del
   gesto su libri lunghi ha pesato più della soddisfazione del trascinamento. Resta il campo
   numerico con la barra a due colori.
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
4. ~~**Il perimetro della traduzione**, che il PRD rinvia alla fase di costruzione.~~ Deciso
   nell'issue #34: framework (`next-intl`, lingua dedotta da `Accept-Language`, nessun
   selettore) più le quattro categorie già estratte (errori, assenze, sessione, attese).
   L'estrazione del resto delle stringhe (comandi, etichette, intestazioni) resta fuori,
   perimetro deliberato — vedi `docs/lavoro-rimandato.md`.
5. **Fraunces accanto a Literata**, sulla stessa schermata: titolo in Fraunces, insight in
   Literata, a mezzo centimetro di distanza.
6. **Le ombre al buio.** Un'ombra scura su un fondo scuro può sparire o, peggio, formare un
   alone. Vanno tarate sulla schermata reale, non calcolate.

---

## 24. Descrizione dell'opera

Il Libro ha una descrizione (§9, entità Descrizione nel PRD). Fonte preferita Wikipedia — prosa
scritta per spiegare di cosa parla un libro, non per venderlo — con ripiego su Google Books
quando l'opera non è abbastanza notabile per avere una voce. Nessuna generazione da un modello:
solo testo che una fonte ha già scritto, mai inventato.

**Standardizzazione assistita delle descrizioni fuori standard.** Alcune voci Wikipedia si
riducono a una sola frase ("Le notti bianche è un racconto giovanile di Fëdor Dostoevskij."),
sotto lo standard di prosa breve che questa sezione chiede; altre — soprattutto le trame di
Google Books, scritte per vendere — lo superano abbondantemente. La regola "mai inventato"
resta, ma si applica ai *fatti*, non alla *formulazione*: un lavoro in secondo piano
(`app/lavori/standardizzazione_descrizione.py`) riformula le sole descrizioni fuori dalla fascia
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
  modello (espanso o accorciato) — stesso trattamento di `anno_dedotto`/`lingua_dedotta`. Il
  campo resta nell'API per un'eventuale reintroduzione in scheda, ma oggi il testo riformulato
  si mostra senza distinguerlo dalla citazione letterale della fonte (stessa scelta di "dedotto",
  §9).

Non richiede consenso dell'Utente (funzione bibliografica su dato condiviso, come classificazione
dei generi, deduplicazione e riconduzione degli autori — ADR 0008): lavora solo su
titolo/autori/anno/generi/descrizione di catalogo, mai su contenuto personale.

**Traduzione assistita delle descrizioni mancanti.** Il meccanismo sopra recupera testo
reale per lingua ma non traduce mai: dove nessuna fonte ha il testo in una delle due lingue
dell'interfaccia, il blocco descrizione semplicemente non compare. Quando un'opera ha una
descrizione reale in una lingua ma non nell'altra — tipicamente: testo inglese da Wikipedia,
nessuna voce italiana — un lavoro in secondo piano (`app/lavori/traduzione_descrizione.py`)
traduce il testo esistente verso la lingua mancante, mai lo genera da zero: stessa regola "mai
inventato", applicata qui alla lingua invece che alla lunghezza. Accodato sia alla nascita della
scheda (`catalogo_repository.crea_scheda`, quando Google Books ha scritto una sola lingua) sia
dopo il tentativo Wikipedia (`app/lavori/descrizioni.py`, l'ultimo scrittore della pipeline
quando Wikidata ha sitelink), perché solo lì si conosce lo stato definitivo delle due lingue.

Scritture difensive, stesso principio delle altre funzioni di questa sezione: se un testo reale
arriva per quella lingua fra l'accodamento e l'esecuzione (Wikipedia batte la traduzione), la
scrittura della traduzione è un `insert ... on conflict do nothing` — non sovrascrive mai un
testo reale con uno tradotto. Fonte e attribuzione (`fonte`, `url_fonte`) sono ereditate dalla
riga sorgente: il testo cambia lingua, non provenienza — e l'attribuzione CC BY-SA di Wikipedia
resta dovuta anche su un derivato tradotto. Un testo tradotto fuori dalla fascia 200-900
caratteri viene accodato per la stessa standardizzazione già descritta sopra, invece di
duplicare la logica di lunghezza nel prompt di traduzione.

**Trattamento di trasparenza**: nessun campo dedicato — si riusa
`libro_descrizione.riformulata`, il cui significato si allarga da "riformulato" a "il testo di
questa riga non è la citazione letterale della fonte in questa lingua". Stessa sorte
dell'etichetta in scheda: non introdotta, il campo resta solo nell'API.

**Scope**: solo le due lingue dell'interfaccia (`it`/`en`). Se l'unica descrizione disponibile è
in una terza lingua (un volume Google Books in una lingua diversa da queste due), resta fuori
scope — la scheda si comporta come oggi, nessun blocco descrizione.

---

## 25. Ricerca semantica

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
come avviso su ciò che si sta per leggere, che qui non serve.

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

---

## 26. Suggerimenti di lettura

**Una pagina a sé, `/suggerimenti`.** Stessa ragione di `/cerca`: dipende dal consenso, e la
navigazione (§5) resta a quattro voci. Ci si arriva da un collegamento in fondo alla riga dei
filtri della Libreria, accanto a "Cerca nei tuoi insight" — non da una voce di menu.

**Effimeri.** A differenza della preview e della sintesi tematica, un suggerimento non è un
`artefatto_generato`: il PRD non lo elenca fra gli artefatti, e ogni pressione del pulsante
"Suggeriscimi qualcosa" (poi "Suggeriscimi altro") ne genera di nuovi senza conservare i
precedenti. Non c'è una vista "i tuoi suggerimenti passati".

**Ogni titolo che arriva alla pagina è già verificato**, non più sperato: il backend chiede fino
a otto candidati e scarta quelli che nessun catalogo conosce prima di rispondere
(`suggerimenti_service._verifica_e_diversifica`) — la ricerca lato client, con lo stesso
procedimento di `/aggiungi` (§13, locale poi esterno), non decide più *se* mostrare un comando
"Aggiungi" ma lo trova quasi sempre. Il ramo di solo testo — titolo, autori, motivazione, senza
copertina né comando — resta come margine di sicurezza per un risultato esterno scaduto dalla
cache fra le due ricerche, non come esito atteso.

**La motivazione è sempre concreta**, mai una lode generica: il prompt lega ogni suggerimento a
un elemento reale del profilo di chi chiede — un titolo amato, un autore delle letture recenti,
un tema che torna negli insight — sullo stesso registro della preview (§9). Tre o quattro frasi,
non una sola: abbastanza per spiegare davvero, mai un trattino lungo o medio (sostituito con una
virgola se il modello lo scrive lo stesso). Sopra `t-meta`, ha il trattamento tipografico di un
insight vero (`t-sentenza`/`t-appunto`, §10) con lo stesso troncamento a otto righe e "Mostra
tutto" degli insight nella scheda del libro — non è più metadato, è un testo da leggere.

**Una preferenza per questa sola richiesta**, facoltativa e sempre visibile — mai dietro un
"più opzioni" — un campo a riga sola sopra il pulsante, stesso trattamento del campo di ricerca
semantica (§25): "Un libro breve, qualcosa di leggero, niente crime stavolta…". Non salvata, non
un artefatto, non un insight: vive nel corpo della singola richiesta e sparisce con lei. Il
backend la tratta come una preferenza da considerare insieme al profilo, mai come un'istruzione
che sostituisce le regole di generazione — una nota che assomiglia a un tentativo di cambiare
argomento (rivelare le istruzioni del modello, farlo comportare diversamente) viene ignorata in
silenzio, senza errore per l'Utente: i suggerimenti arrivano lo stesso, semplicemente senza
tenerne conto.

**Il profilo, non più uno storico piatto.** Il backend distingue tre gruppi con ruoli diversi
invece di un solo elenco di libri finiti: i libri amati (voto alto, di qualsiasi età — il gusto
che dura), le letture più recenti (qualsiasi voto — dove sei ora), i libri non piaciuti o
abbandonati (per capire cosa evitare, mai per proporre "altri libri così"). Un libro già in
libreria, in **qualunque stato** — anche "da leggere" — non viene mai riproposto.

**Un'etichetta silenziosa per la scoperta.** Ogni proposta è "affine" (vicina a ciò che ami o
leggi ora) o "scoperta" (stesso territorio, un passo di lato). Solo "scoperta" si mostra in
pagina, in `t-meta`, accanto alla motivazione — "affine" è l'esito atteso e dirlo su ogni riga
sarebbe rumore ripetuto, non informazione.

**Nessun badge "sintesi generata"**: a differenza della preview e della sintesi tematica, qui
non c'è un singolo testo in prosa la cui origine vada dichiarata — la pagina stessa, con il suo
titolo e la sua introduzione, dice già che si tratta di proposte del modello.

Due stati vuoti, entrambi testo e non un riquadro rosso: consenso revocato ("L'elaborazione
assistita è spenta", con rimando alla Torre) e profilo insufficiente (nessun libro amato,
nessuna lettura conclusa, nessun deluso).

---

## 27. Sintesi tematica

Un elenco di temi, ciascuno con le prove attaccate — non un paragrafo unico: un tema verificabile
e collegato ai libri da cui viene serve, un riassunto in prosa della libreria no.

**Una pagina a sé, `/sintesi`.** Stessa ragione di §25/§26: dipende dal consenso, quattro voci
di navigazione restano quattro, si arriva da un collegamento nella riga dei filtri della
Libreria.

**Un tema è una carta**, su piano 1 con grana, non una riga di elenco: nome del tema in
`t-label` (stesso trattamento delle intestazioni di gruppo negli insight, §10 — un'etichetta, non
il contenuto), poi la frase che lo descrive in `t-sentenza`/`t-appunto` a seconda della
lunghezza — la stessa soglia e lo stesso carattere di un insight vero, perché lo è nella
sostanza: un'osservazione breve, non una didascalia generata. Sotto, i libri distinti da cui
viene il tema, ciascuno un collegamento alla propria scheda — mai un nome senza un posto dove
andare. Un comando testuale, "Mostra gli insight", apre l'elenco degli insight e delle recensioni
veri che hanno prodotto il tema, con lo stesso trattamento della ricerca semantica (§25): titolo
del libro come collegamento, testo, poi tipo e data.

**Nessun tema debole.** "Trasversale ... tra libri diversi" (PRD) si prende alla lettera: un tema
sostenuto da un solo libro non è trasversale, e non compare — non attenuato, non segnalato come
incerto, proprio assente. Se dopo il filtro non resta alcun tema, la sintesi non si genera né
sostituisce quella esistente: **meglio nessuna carta che una carta vuota o un pattern inventato
su un libro solo**. Due modi distinti in cui questo succede, con un testo diverso per ciascuno:
non hai ancora scritto nulla ("Scrivi qualche insight o recensione prima di chiedere una
sintesi"), oppure hai scritto ma nulla si collega ancora fra libri diversi ("Non emerge ancora un
tema che attraversi libri diversi. Continua a scrivere e a leggere, poi riprova").

**Sostituisce, non si accumula** — a differenza della preview (§9), che accumula apposta perché
un parere per ogni rilettura ha senso. Esiste al più una sintesi tematica per utente: generarne
una nuova cancella la precedente, mai prima di avere quella nuova pronta (un tentativo che non
supera i filtri sopra non deve lasciare l'Utente senza alcuna sintesi). Il pulsante lo dice:
"Genera una sintesi" la prima volta, "Genera di nuovo" quando ce n'è già una, mai "Aggiungi" o
un'icona che lascerebbe intendere un accumulo.

**Lo stesso avviso della preview**: badge "Sintesi generata", campo della risposta e non frase
dentro un testo, sopra l'elenco dei temi — vale per l'intero risultato, non ripetuto su ogni
carta.

**Regola 32, come per la preview**: a consenso revocato la sintesi già generata resta leggibile
e cancellabile dal proprietario, temi ed insight collegati compresi; solo il pulsante "Genera di
nuovo" sparisce, sostituito da un rimando alla Torre.
