# Montaigne · Design frontend

Il come dell'interfaccia. Compagno del PRD, che porta il cosa. Descrive la struttura visiva e
di interazione del sistema così com'è pensata oggi: un riferimento per lavorare in modo
coerente, non una specifica immutabile — si aggiorna quando cambia la comprensione del
prodotto o quando si trova un'idea migliore.

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
aria. Il colore non è nero puro ma l'inchiostro del tema con alpha. Quando la stanza è scura le
ombre si allungano e si scuriscono, non spariscono. Su mobile la componente lunga si accorcia:
le stesse ombre, su uno schermo tenuto a trenta centimetri, sembrano sporco.

**Grana:** SVG `feTurbulence` in data-URI, sotto un chilobyte, statico, opacità 0.035. Sta sul
piano 1 e sul piano 2, mai sul piano 0. La grana su una carta dice che è carta; la grana su un
fondo dice solo che avevamo paura del vuoto. Mai animata: il filtro si applica alla bitmap
della forma, quindi ogni cambiamento di forma o posizione lo ricalcola, e oltre quattro
primitive concatenate le prestazioni su mobile crollano.

**Bordi:** un solo spessore, 1px, sempre l'inchiostro del tema con alpha, mai un grigio scelto a
mano. Raggi: 4px sugli oggetti piccoli (pastiglie, volumi, barre), 10px su campi e pulsanti,
14px sulle carte. Niente sopra i 14px.

---

## 3. Luce

**Una stanza sola.** Non esiste un tema chiaro e un tema scuro: esiste una superficie che dal
mattino alla notte si scurisce e cambia calore, conseguenza dell'ora, come lo scaffale è
conseguenza della libreria.

**Il comando in Torre.** Un selettore a tre stati — **Segui l'ora / Chiara / Scura** — dà a chi
ha una sensibilità particolare alla luce la possibilità di fissare la stanza. "Segui l'ora"
resta il valore predefinito: chi non lo tocca vede la stanza seguire l'ora, e due collegati
senza preferenze espresse vedono la stessa stanza allo stesso momento. Il calcolo resta lato
server, il cambio avviene solo al cambio pagina, nessun timer nel browser: la preferenza viaggia
in un cookie `httpOnly` letto dal layout radice. `prefers-contrast` e la modalità a colori
forzati del sistema restano onorati indipendentemente da questo comando (`tokens.css`).

Fissare una preferenza fissa un ancoraggio (`giorno` o `notte`) senza interpolare: sono scelte,
non momenti.

Quattro ancoraggi: alba, giorno, tramonto, notte. L'ora corrente sta sempre fra due e i colori
si interpolano.

**Interpolazione in OKLCH.** I mezzitoni restano saturi e leggibili; in sRGB il passaggio fra
alba e giorno darebbe un mezzogiorno grigio e fangoso.

**Calcolo lato server.** Il PRD fissa il fuso CET uguale per tutti; calcolarlo nel browser
produrrebbe un mismatch di idratazione in Next.js. Alba e tramonto da tabella a latitudine
fissa, non dalla posizione dell'utente: due collegati vedono la stessa stanza alla stessa ora.

Il valore si aggiorna al cambio pagina, mai con un timer, e mai mentre si sta scrivendo: in quel
caso è rimandato alla navigazione successiva.

**Il passaggio al buio non si interpola, scatta.** Dentro la fascia chiara si passa da alba a
giorno a tramonto in continuo; attraversando notte si va all'ancoraggio più vicino.
Interpolando linearmente, a metà transizione fondo e inchiostro si troverebbero entrambi a
luminanza media e il contrasto scenderebbe sotto 2:1 per una decina di minuti, due volte al
giorno — un difetto che nessuna verifica sui singoli ancoraggi intercetta, perché ognuno preso
da solo è a norma. Lo scatto non si vede, dato che il valore cambia solo al cambio pagina.

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

**La lampada.** Un solo `radial-gradient` a basso contrasto, fisso, ancorato in alto a sinistra.
Non si muove, non pulsa, non segue il puntatore. È l'unica ragione per cui il piano 0 non è del
tutto piatto, ed è calibrata per restare invisibile finché non la si cerca.

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

**Invariante della mensola.** `shelf` resta più scuro di `surface-0` nei quattro ancoraggi,
altrimenti il ripiano legge come una striscia di luce sotto i libri invece che come un oggetto
d'ombra. Verificato in CI insieme ai contrasti, non solo sui quattro ancoraggi ma campionando
l'anno.

**Contrasti.** `ink` su `surface-1` sta fra 12.5:1 e 14.3:1. `ink-soft` su `surface-1` non
scende sotto 6.0:1. `accent-strong` su `surface-1` non scende sotto 6.1:1. Testo scuro su
`accent` pieno resta sopra 4.8:1. Campionando ogni dieci minuti su un anno intero, incluse tutte
le posizioni intermedie, il minimo assoluto è 6.08:1. Il campionamento gira in CI, per
accorgersi se un valore modificato rompe una fascia oraria che nessuno guarda mai.

**Regola sull'ottone.** `accent` è un colore di riempimento e non va usato come testo su
superficie chiara, dove il contrasto crolla sotto 3:1. Per testo, icone e numeri esiste
`accent-strong`.

**Regola sul rosso.** `alert` compare in un solo posto in tutto il prodotto, il contatore delle
richieste ricevute accanto a Torre, perché è l'unica cosa che chiede un'azione. Non sugli
errori, che sono testuali. Non sulla cancellazione dell'account. Non sui nastri, che hanno un
rosso proprio di stato.

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
anonima in display. Fraunces ha carattere in grande e diventa faticosa nel testo lungo. Sono due
mestieri diversi.

**Un serif su un'etichetta di UI è un bug.** EMAIL, PASSWORD, ENTRA sono comandi, non lettura.

**Sentenza e appunto restano entrambi in Literata.** L'asse di dimensione ottica regola
contrasto e proporzioni ed è ciò che permette a 19px e 15px di essere lo stesso carattere con
due voci diverse. Fraunces sulle sentenze creerebbe due serif adiacenti nello stesso elenco.

**Se si deve tagliare:** si toglie Fraunces e si porta Literata a `opsz 72` sui titoli. Si perde
carattere, non si rompe nulla. Inter Tight non si tocca.

### La scala di Inter Tight

| Ruolo | Specifica | Dove |
|---|---|---|
| `.t-section` | Inter Tight, 600, 14px, `ink` | Titolo di sezione |
| `.t-body` | Inter Tight, 400, 15px, interlinea 1,5, `ink` | Testo di interfaccia che è contenuto |
| `.t-meta` | Inter Tight, 13px, `ink-soft` | Metadati veri: date, conteggi, unità. Mai contenuto, mai un comando |
| `.t-label` | Inter Tight, 10,5px, maiuscoletto | Solo micro-etichetta sopra un dato |

Quattro ruoli distinti, così un titolo di sezione non condivide il trattamento con un metadato
né un contenuto vero (una riga di stato, un riepilogo, un elenco) finisce vestito da nota a piè
di pagina.

**Composizione.** `text-wrap: balance` sui soli titoli, dove è costoso e oltre le sei righe non
ha effetto. `text-wrap: pretty` sui paragrafi lunghi. `text-box-trim` sui titoli display, perché
a corpo grande lo spazio ottico sopra e sotto si vede. `font-variant-numeric: tabular-nums` su
ogni numero di metrica, sempre, altrimenti le colonne ballano al cambio d'anno. Nessun
`letter-spacing` negativo sotto i 24px; sopra, fino a `-0.02em` sul display.

---

## 5. Navigazione

Quattro voci: **Libreria, Annali, Lettori, Torre.** In inglese: Library, Annals, Readers, Tower.

| Voce | Contenuto |
|---|---|
| Libreria | Scaffale, filtri, ricerca |
| Annali | Metriche per anno |
| Lettori | Elenco membri |
| Torre | Collegamenti e impostazioni |

La barra sta sul piano 0, non su una carta: non è contenuto, è la stanza. La voce attiva si
segnala con l'inchiostro pieno e un filetto, non con un riempimento.

**Due barre, non una resa elastica.** Da 640px in su la barra sta in cima ed è fissa allo
scorrimento. Sotto i 640px le stesse quattro voci diventano una barra in fondo allo schermo,
dove sta la navigazione di un'app e dove arriva il pollice; nome utente ed "Esci" passano in
Torre, che è la loro sede naturale. Lo scambio è in CSS, non in JavaScript, quindi non c'è un
istante in cui compare la barra sbagliata.

**Senza icone, di proposito.** In tutta l'app non esiste un vocabolario di icone — due chevron
in un selettore d'anno e qualche glifo tipografico. Quattro parole corte bastano, e la voce
attiva si legge dal filetto come in alto.

Il contatore delle richieste ricevute sta accanto a Torre ed è l'unico elemento in `alert` di
tutta l'app: senza contatore una richiesta resterebbe invisibile per sempre, non avendo l'app
notifiche.

Questa barra è quella di "casa tua". Nel contesto di un collegato (§15) sparisce del tutto,
sostituita da una barra contestuale diversa: non è una variazione di questa, è un'altra barra.

Il rimando letterario sta nell'insegna, non nella segnaletica interna: dentro le pagine i titoli
restano piani (collegamenti, impostazioni, cancella il tuo account, chi vede cosa).

---

## 6. Accesso

**Split verticale.** A sinistra l'insegna in Fraunces a corpo molto grande sul piano 0, con la
lampada dietro e la citazione sotto. A destra, o sotto su mobile, il modulo su piano 1.

Il modulo non è un rettangolo appoggiato su uno sfondo: è una zona di carta che occupa tutta la
sua metà, e il confine fra i due piani è il salto di luminanza, senza bordo e senza ombra.

Campi con la sola riga inferiore, etichette in Inter Tight maiuscolo spaziato, pulsante in
`accent` pieno. L'errore di accesso è testo in `ink` sotto il campo, non un riquadro rosso: la
stringa del fornitore di autenticazione va tradotta, mai mostrata grezza.

Su mobile l'insegna resta in cima e si accorcia, il modulo prende il resto. La citazione sparisce
sotto i 600px di altezza: è la prima cosa a cedere.

**Primo accesso:** schermata a sé, non un pannello sovrapposto. Accettare l'informativa è
condizione per entrare, quindi non è un avviso da scacciare, è una porta.

---

## 7. Libreria

**Vista unica.** Non esiste un selettore di vista e non esiste una vista a elenco: esiste uno
**scaffale di copertine con la costa**. Ogni volume, da sinistra a destra:

- **La costa**, larga `clamp(6px, pagine / 22, 28px)`, nel colore dominante scurito. Lo spessore
  è il numero di pagine, non l'altezza, che è il formato di stampa e non dice nulla. Le voci
  senza pagine adottate prendono uno spessore mediano.
- **La copertina vera**, `120 × 180` px su desktop e `96 × 144` su mobile (proporzione 2:3
  fissa, `object-fit: cover`, mai deformata, mai con bande).
- **Il nastro di stato**, che esce dal lato di taglio (`right: 16px`), non dal centro, così non
  copre mai la copertina.

### Struttura dello scaffale

1. **Il riquadro esiste prima dell'immagine.** Il recupero della copertina è un lavoro in
   secondo piano (PRD): un libro appena aggiunto compare senza immagine e si riempie dopo. Il
   volume nasce già della dimensione definitiva — `width`/`height` fissi, mai `aspect-ratio` da
   solo — e non salta quando l'immagine atterra.
2. **Nessuna didascalia sotto i libri.** La copertina è l'etichetta. Dove manca, il segnaposto
   porta titolo e autore composti dentro il riquadro.
3. **Il segnaposto non è uno stato di errore.** Niente icona di immagine rotta, niente libro
   generico, niente punto esclamativo: titolo in Fraunces e autore in Inter Tight sul colore
   dominante. Un errore di caricamento ricade sul segnaposto in silenzio.
4. **Il colore dominante serve ancora**, anche con le copertine vere: regge la costa, il
   segnaposto e il riquadro nell'attesa.
5. **Le mensole si riempiono sulla larghezza reale**, non su un numero fisso di libri. Si
   impacchettano i volumi finché entrano nella larghezza del contenitore, poi si chiude la
   mensola e se ne apre una successiva; si ricalcola al ridimensionamento (`ResizeObserver`,
   debounce ~150ms).
6. **La lettera dell'autore è una tacca fra un volume e l'altro**, larga 18px, con un filetto di
   10px che scende sulla mensola. Non è un ripiano a sé.
7. **Ordinamento alfabetico per cognome dell'autore, stabile.** A parità di cognome, per titolo.
   Un libro con più autori si ordina sul primo. Uno scaffale stabile permette alla memoria
   spaziale di formarsi: ordinare per attività recente riordinerebbe la fila a ogni avanzamento.
8. **Fascia delle letture in corso in cima**, con gli stessi oggetti più un filo di avanzamento
   di 3px sul bordo inferiore della copertina. Su mobile scorre in orizzontale con aggancio
   (`scroll-snap-type: x proximity`). I libri in lettura stanno solo nella fascia: due insiemi
   distinti, non due viste sugli stessi dati.
9. **Le voci senza pagine adottate** hanno la costa in contorno tratteggiato, senza riempimento
   e senza ombra: l'assenza di dato è dichiarata, non gridata. Il tratteggio tocca solo la costa,
   mai la copertina.
10. **Il sollevamento** è `translateY(-10px)` più il passaggio all'ombra del piano 2, su uno
    pseudo-elemento a cui si anima `opacity`, mai su `box-shadow` (non compositabile). Dietro
    `prefers-reduced-motion` resta il salto di piano e sparisce il movimento.

**Colore dominante**, calcolato lato server alla nascita della scheda (`app/lavori/
copertine.py`, backend) e salvato sul Libro — mai estratto nel browser con canvas. Il segnaposto
client dall'id del Libro (`spine-color.ts`) è il ripiego per le schede senza copertina. Un solo
valore per libro; una seconda versione più desaturata per la stanza scura è prevista ma non
ancora costruita (`docs/lavoro-rimandato.md`).

**La mensola.** Una barra di 10px sotto la fila, più scura del piano 0 in tutti e quattro gli
ancoraggi (ancoraggio `shelf` in `src/lib/light.ts`, verificato da `scripts/check-contrast.mts`),
con l'ombra doppia rivolta verso il basso. È l'unico elemento dell'app che allude a un mobile:
niente montanti, niente cornice, niente parete.

### Filtri e ricerca

**Filtro testuale** su titoli e autori, sempre disponibile, che non chiama nessun modello: un
campo con la sola riga inferiore, non una scatola arrotondata, `aria-label` esplicita.

**Filtro per stato**, gratuito perché i nastri sono già un codice colore: pastiglie in contorno
con un quadratino di colore di 7px e l'etichetta in `ink-soft`. Attive: nessun bordo, fondo
`ink` al 9%, testo in `ink`. Non pastiglie piene colorate: i libri restano l'unico posto dell'app
dove il colore è un dato.

**Ricerca semantica separata**, sui propri insight, dipendente dal consenso. Non è fusa nel
campo sopra: revocare il consenso lascerebbe l'utente senza il modo di trovare un libro. Pagina
a sé, §22: qui resta solo la porta.

**Un ingresso solo per le tre funzioni assistite.** Tre fasce: il titolo con "Aggiungi un libro"
in evidenza (pulsante pieno, è il gesto con cui la libreria esiste); il filtro; e un disclosure
"Chiedi alla libreria" che raccoglie ricerca semantica, suggerimenti e sintesi — tenute fuori
dalla navigazione a quattro voci perché dipendono da un interruttore, e una voce di menu che può
essere spenta è una voce sbagliata. Un collegamento e non un secondo campo: due campi di ricerca
affiancati sulla stessa riga si sbagliano, e uno dei due costa una chiamata al modello mentre
l'altro no. Nascosto sulla libreria di un collegato: si cerca solo nei propri testi.

### Accessibilità

Il colore del nastro da solo non basta: rosso e verde sono indistinguibili per un daltonico. La
lunghezza del nastro porta la differenza, e il volume in lettura ha anche una linea chiara sul
bordo.

### Fuori perimetro attuale

**Azioni dal volume senza aprire il libro** (registrare un avanzamento, cambiare stato con un
tocco lungo su mobile): un miglioramento da valutare, non ancora costruito — oggi il volume è
solo un link alla scheda.

**Indice a lettere sul bordo** come elemento a sé: non previsto. Le tacche fra i volumi (punto 6)
risolvono lo stesso problema senza un elemento separato.

---

## 8. Mobile

Mobile pari a desktop, con il mobile come riferimento nei casi di dubbio. Ogni schermata si
progetta e si verifica mobile-first, mai il contrario.

Il tocco non si risolve componente per componente: una regola sola in `tokens.css`, dietro
`@media (pointer: coarse)`, porta ogni bersaglio a `--tap`. La densità del desktop resta quella
scelta qui.

**Una densità non è una gerarchia.** La regola `pointer: coarse` risolve il *bersaglio*, non il
*peso*: un bottone alto 28px sul desktop e 44px sul telefono resta, sui due schermi, due cose
diverse, e su entrambi non dice se sia l'azione principale o l'ultima. La scala dei comandi (§9)
dichiara quattro pesi, e l'azione primaria è a 44px anche col mouse: quel numero appartiene alla
gerarchia, non al pollice.

**Il ritorno.** Sotto i 640px `ProtectedNav` non monta niente in cima. Chi progetta una rotta
nuova deve chiedersi da dove si esce.

**Scaffale a più mensole:** volumi (§7) che vanno a capo su ripiani impacchettati sulla larghezza
reale, copertina ridotta a `96 × 144`, scorrimento verticale, tocco che apre. Il sollevamento non
serve: il dito è già il puntatore. Ogni mensola porta la sua ombra doppia, ed è la ripetizione
delle ombre a dare la profondità che su desktop dà il sollevamento.

**Fascia orizzontale con aggancio solo per le letture in corso** (§7, punto 8): su due o tre
libri il centro dello schermo fa da puntatore naturale; con più libri il gesto diventa oneroso,
motivo per cui resta confinata a quella fascia e non è la vista principale dello scaffale.

---

## 9. Scheda del libro

La metafora è **dove sei / cosa ne pensi / cos'è**, e parla del lettore: una scheda di libro non
è un libro aperto, è il posto dove un lettore torna a vedere dov'è arrivato.

### Cinque zone

| | Zona | Contenuto |
|---|---|---|
| 1 | **Testata** | Copertina accanto al titolo, autori, stato in chiaro, la tua cronaca con questo libro |
| 2 | **Segnalibro** | Dove sei. Una sola azione piena in tutta la pagina |
| 3 | **Giudizio** | Voto, recensione, nota di intenzione |
| 4 | **Il libro** | Fatti, generi e "di cosa parla" — in colonna laterale |
| 5 | **La storia** | Letture e insight — in colonna principale |

Due colonne da 1024px in su, tre blocchi: segnalibro+giudizio (zone 2+3) in colonna 1 riga 1, il
libro (zona 4) in colonna 2 su entrambe le righe (`row-span-2`, `sticky`), la storia (zona 5) in
colonna 1 riga 2, sotto il giudizio (`lg:col-start`/`lg:row-start`). Sotto i 1024px la griglia
collassa e i tre si impilano nell'ordine del DOM: segnalibro+giudizio, poi il libro, poi la
storia. Nessun `order-*`, nessun `min-height`: ogni blocco è alto quanto il suo contenuto — la
storia (letture e insight) è ciò che dà alla colonna principale l'altezza naturale per bilanciare
la colonna laterale quando la descrizione è aperta, per questo è un terzo figlio diretto della
griglia e non annidata dentro il blocco di segnalibro e giudizio: da annidata, trascinerebbe con
sé anche l'ordine su mobile.

**L'opera sta di lato** perché è il dato condiviso: non è tua, non la puoi correggere (il PRD
riserva la correzione dei generi a fuori app), e la sola cosa tua che ci sta dentro, le pagine
della tua copia, resta lì perché è un fatto bibliografico e non un dato di avanzamento.

**Niente copertina a tutta larghezza in cima**: schiaccerebbe il contenuto personale sotto la
piega dello schermo. La copertina sta accanto al titolo, non sopra.

### Zona 1, la testata

Copertina sul piano 2 con la sua ombra doppia — è l'unico oggetto raster dell'app. Titolo in
Fraunces `t-display`, autori sotto in Inter Tight.

Sotto gli autori non vanno i dati dell'opera (vivono nella zona 4): va la tua cronaca con questo
libro — "Cominciato il 12 gennaio · riletto una volta · 3 insight".

**Lo stato è una pastiglia**: un punto del colore del nastro più la parola. Il colore resta il
legame con lo scaffale, dove il nastro *è* il linguaggio (§7); la parola fa il lavoro che sullo
scaffale fa la lunghezza del nastro, e che qui la lunghezza non può fare, non essendoci nulla con
cui confrontarla. "Da leggere" non ha nastro: il punto diventa un cerchio vuoto, così le cinque
pastiglie restano della stessa misura.

### Zona 2, il segnalibro

Un blocco solo, sempre nello stesso posto, che cambia forma con lo stato e porta una sola azione
piena.

| Stato | Cosa dice | Azione piena |
|---|---|---|
| **In lettura** | Pagina corrente in Fraunces a corpo grande, "di N", percentuale, barra trascinabile | **Segna la pagina** |
| **Da leggere** | "Non l'hai ancora cominciato" | *(la transizione "Inizia a leggere")* |
| **In pausa** | Dove sei fermo, barra spenta, "in pausa non si registrano avanzamenti" | *(la transizione "Riprendi")* |
| **Letto** | "Finito il …", con la data d'inizio | — |
| **Abbandonato** | "Lasciato il …", con la pagina raggiunta | — |

La barra di avanzamento è a due colori: quello già salvato in accento smorzato, il tratto che si
sta per salvare in accento pieno, con il segno del pavimento fra i due. È la sola parte che
cambia mentre si trascina, quindi è la sola satura. In sola lettura è alta 8px, non 1,5: un filo
non dice una frazione, lo si legge solo perché accanto c'è il numero.

**Le transizioni scendono sotto, fuori dalla carta.** Cambiare stato è una cosa che fai al libro,
non il libro che ti dice dove sei. Restano le due più frequenti in evidenza e le altre sotto
"Altro", e l'interfaccia non offre mai una transizione vietata, invece di offrirla e poi
rifiutarla. Il campo data usa sempre uno stile proprio (`CampoData`), mai l'aspetto nativo del
browser.

### Zona 3, il giudizio

Voto, recensione e nota di intenzione stanno in una carta sola: sono tre modi di dire la stessa
cosa, cioè che cosa ne pensi.

Il voto resta 1–5 a scatti di mezza stella, con ogni stella divisa in due zone cliccabili e il
sollevamento al passaggio del mouse; un secondo clic sul valore già scelto lo cancella. Stelle a
27px, come tracciati SVG, non glifi di testo — un bersaglio di precisione va reso grande e
disegnato dall'app, non dal font di sistema.

### Zona 4, il libro

Solo fatti in riga, più i generi come pastiglie senza affordance di modifica. Niente descrizione:
la carta laterale è un elenco di coppie etichetta/valore, e un abstract di catalogo è prosa da
leggere, non un metadato — passa alla zona 5, dove la colonna ha la misura giusta per contenerlo
senza sbilanciare l'impaginazione.

### Zona 5, la storia

Letture e insight, in coda alla colonna principale, separate dal giudizio da un filetto: sopra
quello che pensi adesso, sotto quello che è successo. Per gli insight vedi §10.

**"Di cosa parla"** è una carta a sé sotto i fatti, non un blocco dentro la loro: prosa da
leggere, non coppie etichetta/valore. Tagliata a sei righe sopra le 230 battute — soglia tarata
sulla larghezza della colonna: a 320px una riga di Literata a 15px porta ~37 battute, quindi sei
righe sono ~230. L'assenza resta muta: senza abstract non c'è né titolo né riga vuota.

### "Me lo consigli?", solo su "da leggere"

Il parere vive nella colonna principale, sotto la zona 2, e in un solo stato: quello in cui la
decisione è ancora aperta, cioè "da leggere". Negli altri stati la domanda "me lo consigli?" ha
già una risposta implicita nei fatti (si sta leggendo, si è già votato, si è abbandonato), e non
serve.

**Un parere già chiesto non sparisce mai, ma si fa da parte.** Lo stato governa l'invito a
chiederne uno, non l'esistenza del blocco: legarla allo stato renderebbe un contenuto dell'Utente
irraggiungibile appena si preme "Comincia a leggere", e il PRD garantisce che ogni contenuto
proprio si possa cancellare. A decisione chiusa il parere diventa retrospettivo: titolo al
passato ("Il parere che avevi chiesto"), da `t-sentenza` a `t-appunto`, tagliato a due righe, e il
solo comando che serve — cancellarlo.

Senza parere e senza decisione aperta il blocco non compare affatto.

I vincoli che restano: privata e mai condivisibile, sotto le ottanta parole, nessun testo tra
virgolette, e a consenso revocato l'interfaccia dice che la funzione è spenta invece di far
finta che non esista. Nessun comando di condivisione, in nessuna forma — l'operazione non esiste
nemmeno nel database.

Lo stesso parere si può chiedere **prima** di avere il libro, sulla scheda di §13: là non c'è una
Voce a cui legarlo, quindi non viene salvato. Qui sì, ed è la ragione per cui questo blocco ha una
forma retrospettiva e quello no.

Lo **storico delle letture** è una carta con righe leggibili, sempre aperta, ordinata dal più
recente, con un punto del colore del nastro per esito (in corso, conclusa, abbandonata). Non
compare quando c'è una sola lettura ancora aperta: è già raccontata dalla zona 2.

**Cancellazione di una lettura.** Tre livelli di attrito: menù di riga → comando → "Cancella
davvero"/"Annulla".

**Cancellazione dell'intera Voce.** Due livelli: "Togli dalla libreria" apre direttamente il
riquadro di conferma, che elenca con i conteggi reali cosa sparisce insieme alla voce, e "Cancella
davvero" cancella. L'attrito sta nel contenuto della conferma, non in un passo di mezzo che non
chiederebbe nulla.

**Perché la lettura ne tiene tre e la Voce due.** Sulla lettura il menù di riga porta più di un
comando, quindi aprirlo è un gesto che serve comunque; sulla Voce il comando è uno solo e vive già
su una riga tutta sua in fondo alla pagina.

Il riquadro è un pannello in pagina, non un modale (§19). La posizione è una riga di piede a
piena larghezza, in fondo a tutto. Il tono resta piano — niente rosso, `alert` ha un solo uso in
tutta l'app (§3). Nessun campo da digitare: quel livello resta riservato alla cancellazione
dell'account.

### I menù si aprono al clic, non al passaggio del mouse

Si usa il primitivo `Menu` di Base UI, che è già una dipendenza: apertura al clic e al tocco,
chiusura con Escape, ritorno del fuoco alla linguetta, posizionamento in portale così il riquadro
non si taglia dentro un antenato con `overflow: hidden`, più frecce e digitazione per saltare a
una voce.

### L'invito: una forma sola per "qui puoi scrivere"

Un riquadro tratteggiato a piena larghezza, `+`, testo a 14px — un'unica affordance per ogni
punto in cui si può depositare un testo (recensione, nota, insight, correzione delle pagine). Il
tratteggio è il bordo di un bersaglio intero: dice "vuoto" con la stessa figura con cui dice
"premibile". A riempirsi, l'invito sparisce e al suo posto arriva il pannello, come ogni altro
pannello in pagina (§19: l'app non ha modali).

### Interruttori, non comandi la cui etichetta è lo stato

Spoiler e visibilità sono pastiglie premute, con `aria-pressed`: l'etichetta resta ferma, cambia
il riempimento. Niente rosso e niente verde — un interruttore acceso è inchiostro pieno.

### Un insight si corregge, non solo si cancella

Il menù di un insight porta anche "Modifica", oltre a "Cancella": un contenuto che il PRD
dichiara correggibile lo è anche in interfaccia. La correzione usa lo stesso modulo della
scrittura, non uno che gli somiglia: spoiler e visibilità devono avere la stessa forma quando li
si sceglie la prima volta e quando li si cambia. L'insight cede il posto al modulo dove sta,
invece di aprirsi altrove. Le uniche differenze sono l'etichetta del bottone di conferma ("Salva
le correzioni") e i tre valori che partono da quelli dell'insight.

### La gerarchia dei comandi

Quattro pesi, e uno solo pieno per zona.

| Peso | Altezza (desktop) | Uso |
|---|---|---|
| **Pieno** (`accent`) | 44px | L'azione primaria di una zona. Una sola |
| **Di contorno** | 38px | Le azioni secondarie: transizioni di stato, conferme |
| **Piano** | 38px | La terza per importanza: "Altro", "Annulla", menù di riga |
| **Invito** | 48px | Ciò che non c'è ancora e puoi scrivere tu |

Sotto il dito `@media (pointer: coarse)` porta ogni bersaglio a `--tap`, ma la densità non è la
gerarchia: i quattro pesi restano distinti su ogni schermo.

### Su mobile

L'ordine: testata (copertina accanto al titolo, non sopra), segnalibro, giudizio, il libro —
chiuso, con i dati in una riga sola — e infine la storia. La tua copia arriva subito; l'opera si
apre se la vuoi.

**Il ritorno alla libreria.** Sotto i 640px la scheda di un proprio libro porta "‹ Libreria",
appiccicata in cima, con lo stesso `PulsanteEsci` della barra. Il libro di un collegato ha invece
`BarraContestoLibro`, con il suo "‹ [nome]" verso la sua libreria (§15).

### Rito di apertura

Il volume è già sollevato dal passaggio del mouse; il clic parte da lì, la copertina cresce e va
al suo posto nella testata. Sotto i 400 millisecondi, una volta sola, mai al ritorno: al ritorno
il libro non si richiude.

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

In un libro con dodici insight, le due frasi buone risaltano da sole senza che nessuno le abbia
marcate.

Nessun effetto di incisione, nessun `text-shadow`: su un serif variabile a corpo 19 il doppio
contorno sporca le grazie e sui fondi scuri produce un alone. Corpo, peso e interlinea sono già
tre segnali e bastano.

**La sentenza va a misura stretta (~34ch), l'appunto alla misura piena.** È il contrasto fra le
due misure, non solo fra i due corpi, a far risaltare la frase breve dentro un elenco di dodici.

Data piccola, in Inter Tight, spaziata, sotto e non sopra: la frase viene prima.

**Raggruppati per lettura**, come impone il PRD, che lega ogni insight alla lettura in cui è
nato. La lettura è un capo, non una carta: la data leggibile in `.t-section`, più un punto del
colore del nastro per esito — in corso, conclusa, abbandonata. Stesso vocabolario dello scaffale
e della pastiglia di stato (§9).

**Ordine: dal più recente**, gruppi compresi, e detto in cima ("7 · dal più recente").

**Gli orfani vanno in fondo, con un nome.** Sono gli insight scritti prima di cominciare il
libro, o rimasti quando la lettura a cui erano legati è stata cancellata (il PRD: "restano sulla
Voce, senza più alcuna Lettura associata"). Stanno alla fine, sotto "Fuori da una lettura", con
una riga che dice perché esistono.

**Visibilità e spoiler sono segni nel margine.** La visibilità per singolo insight è una
promessa del PRD, reversibile, quindi va scandita con l'occhio, non dedotta aprendo qualcosa. Un
lucchetto per il privato, un occhio coperto per lo spoiler, nel margine sinistro allineati alla
prima riga, in `ink-soft` a opacità ridotta. Condiviso è il default e non prende segno: assenza,
non colore, esattamente come "da leggere" non ha nastro (§7).

Nessun bordo e nessuna ombra sui singoli insight: una campitura appena diversa dalla carta che li
contiene. Fra un insight e l'altro c'è spazio, non un filetto.

Il menù di riga sta nel piede accanto alla data, non sospeso sull'angolo del paragrafo.

**Quando sono decine.** Il PRD dice "insight nell'ordine delle unità o decine per libro": si
mostrano i primi otto per lettura, poi "mostra gli altri N". Nessun filtro e nessun tag: il PRD
li esclude esplicitamente.

**Solo dentro la scheda del libro.** La vista trasversale è rinviata. Ricerca semantica e sintesi
tematica producono comunque risultati che attraversano più libri, ma una pagina di risultati non
è una vista di navigazione: mostra l'insight con accanto il libro da cui viene.

---

## 11. Spoiler

**Pagina non tagliata.** Comando: "Taglia per leggere". Richiama le pagine intonse dei libri
antichi: irreversibile nella metafora, reversibile nel prodotto.

Non è una scelta estetica. Uno spoiler non va mai restituito in chiaro in elenchi o anteprime, e
sfocare con CSS non basta perché il testo resterebbe nel DOM. Quindi il server manda solo il
fatto che esiste, il gesto di scoprire fa una richiesta, e l'animazione copre la latenza.

Il taglio è una `clip-path` animata su una carta del piano 1, non una texture di carta strappata.

**Solo sugli insight di un collegato**, non sui propri: la regola difende da uno spoiler
*altrui*, non da un proprio ricordo di ciò che si è già letto. Sulla propria scheda il testo
compare sempre per intero, con il segno nel margine e la parola "coperto per i collegati" accanto
alla data (§10) — non un avviso su cosa sta per leggere, solo la memoria di cosa si è marcato per
gli altri. Lo stesso vale nella ricerca semantica (§22): ogni risultato è già proprio, mai di un
collegato.

---

## 12. Registrazione dell'avanzamento

**Principio: rendere impossibile lo stato invalido invece di rifiutarlo dopo.**

**Pannello sulla pagina, non sovrapposto.** Nessuna finestra sovrapposta, nessuna sfocatura. Su
mobile si espande la sezione della tua copia. Senza strati sovrapposti non c'è nulla che possa
chiudersi portandosi via il testo in scrittura.

**Segnalibro trascinabile e campo numerico, accoppiati.** Si trascina per avvicinarsi, si digita
per precisare — su un libro da 1200 pagine un pixel vale diverse pagine. Il trascinamento rende
fisico il vincolo del PRD: la porzione già letta è un muro, e il segnalibro non torna indietro
perché il dito non ci riesce. Da tastiera, frecce ±1, con maiuscolo ±10. Il campo numerico non
impone lo stesso muro mentre si sta ancora digitando le cifre — solo alla perdita del focus; il
tetto (le pagine adottate), quando c'è, si applica sempre, anche a metà digitazione.

| Elemento | Regola |
|---|---|
| Numero grande, a fuoco all'apertura, tastiera numerica, invio salva | Il caso normale è: tocco, tre cifre, invio |
| "42 pagine dal 14 agosto" | Il PRD conta le pagine come somma degli incrementi, mai delle pagine raggiunte |
| Barra a due colori | Quello che avevi in `ink-soft`/`accent` attenuato, il tratto in più in `accent` pieno |
| Rifiuto (pagina, data, tetto) | Un toast in fondo alla pagina (§19), non testo sotto il campo |
| "Correggi il totale" | Sta con gli altri fatti bibliografici sulla pagina sinistra, non nel pannello dell'avanzamento — è l'unico campo bibliografico che l'Utente corregge sulla propria copia. Si clicca il numero, si scrive, si esce dal campo: salva da solo. Rifiutata se il nuovo totale è inferiore a un avanzamento già inserito |

Nessun limite dichiarato in anticipo con una frase: il vincolo si scopre tentando. `min`/`max`
sul campo restano solo come suggerimento per tastiera numerica e lettori di schermo, senza
bloccare l'invio.

**Salvataggio ottimistico.** Il segnalibro e il numero si spostano subito, la conferma arriva
dopo. Se la scrittura fallisce, un toast lo dice e il valore salvato resta quello precedente.

**Nel contesto di un collegato:** sparisce il pannello per intero. Restano barra e numeri in
sola lettura, che sono un dato di lettura visibile ai collegati (§15).

### Due varianti

**Voce senza pagine adottate:** spariscono totale, percentuale e massimo. Restano numero e
incremento. Un incremento fuori scala produce un avviso, non un rifiuto.

**Chiusura del libro:** "Ho finito" non passa da qui, chiede solo la data di fine. Il PRD genera
da solo l'avanzamento finale alle pagine adottate. Va detto in una riga, altrimenti sembra che
l'app abbia inventato un dato.

---

## 13. Ricerca e aggiunta

Un campo solo, placeholder "Titolo o autore". Il PRD è netto: non esistono altre vie d'ingresso,
né codice digitato né scansione. Nessun selettore di modalità.

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
risultato. Il parere prima dell'aggiunta ha senso su una scheda di libro non ancora in libreria,
non in un elenco: quella scheda ora c'è, ed è la sezione qui sotto.

### La scheda di un libro che non hai

`/book/catalogo/{libroId}` e `/book/google/{volumeId}` (URL in inglese, [#41](lavoro-rimandato.md)).
Ci si arriva dal **titolo** di una riga di ricerca, che diventa un link: il verbo resta il verbo.
Sono due gesti diversi — guardare e prendere — e fonderli in un bersaglio solo significherebbe
sceglierne uno da perdere.

**Stessa carta per tutti i libri, contenuto più magro dove la fonte è più magra.** Il PRD vuole i
risultati "presentati insieme, senza distinzione": una carta che comparisse solo sulle righe già
nel sistema renderebbe visibile la divisione interno/esterno che il prodotto nasconde, e la
renderebbe visibile nel modo peggiore, apparentemente arbitraria ("perché di questo libro posso
sapere di cosa parla e di quest'altro no?"). Fuori dal sistema mancano lingua originale e prosa di
Wikipedia; la carta semplicemente non le mostra, e l'assenza resta muta.

**Guardare non fa nascere una scheda.** La catena che risolve l'identità di un'opera costa oltre
dieci secondi di chiamate esterne più quattro o cinque lavori in secondo piano, e sta dietro
l'aggiunta per scelta (ADR 0002): farla scattare su ogni sguardo la sposterebbe dove non deve
stare e riempirebbe il catalogo di schede che nessuno ha. Un volume di Google resta un volume di
Google finché qualcuno non lo aggiunge. Un volume i cui identificativi sono già noti al catalogo è
invece servito **dalla scheda vera**, con i suoi dati migliori.

**L'anno cambia etichetta, non numero.** Quello dei cataloghi esterni è l'anno di *questa
edizione*: la riga dice "Questa edizione" invece di "Prima pubblicazione", e per la stessa ragione
le pagine dicono "pagine, questa edizione". Chiamarlo anno dell'opera sarebbe plausibile e
sbagliato per ogni classico ristampato — e nemmeno il modello lo riceve come tale.

**"Di cosa parla" sta nella colonna principale**, al contrario di §9. Là la colonna principale è
occupata dalla tua copia e la descrizione è il contesto per leggerla; qui la tua copia non esiste e
la descrizione *è* il contenuto della pagina. In 320px di colonna laterale sarebbe la "striscia
lunga con il vuoto accanto" che §9 rimprovera alla vecchia scheda. Nessun taglio a sei righe: quel
numero era tarato su quella colonna, e qui nasconderebbe la ragione per cui si è arrivati.

**"Me lo consigli?" con una sola differenza: non viene salvato.** Stessi vincoli di §9 — privato,
sotto le ottanta parole, nessun testo tra virgolette, spento a consenso revocato con l'interfaccia
che lo dice. Ma un artefatto è legato alla Voce da cui è stato invocato (regola 23), e qui una Voce
non c'è: il parere vive quanto la pagina, e la riga d'invito lo dice prima che qualcuno ci si
affezioni, non dopo averlo perso. Nessun comando "Cancella" — ricaricare è già la cancellazione.
Qui non serve nemmeno il "solo su da leggere" di §9: la decisione è aperta per definizione, è
l'intera ragione della pagina. Appena il libro entra in libreria l'invito sparisce (da lì in poi la
domanda ha un posto migliore, dove la risposta si conserva) ma un parere già letto resta dov'è.

**Un comando solo, in cima:** "Aggiungi alla libreria", che diventa "Vai al libro" sul posto —
come nella riga di ricerca, e per la stessa ragione: chi aggiunge non deve perdere la pagina che
stava leggendo.

**Velocità percepita.** Risultati che compaiono mentre si digita, con le schede già nel sistema
mostrate per prime perché non richiedono una chiamata esterna.

**Copertina assente:** segnaposto con titolo e autore, composto in Fraunces sul colore dominante
(§7). Il recupero è un lavoro in secondo piano, quindi un libro appena aggiunto può comparire
sullo scaffale come segnaposto tipografico e riempirsi dopo. Il volume non salta quando arriva
l'immagine: nasce già della dimensione definitiva.

**Nessun risultato è un vicolo cieco e lo dice.** Il PRD non prevede la creazione manuale di
schede: il libro va chiesto a chi mantiene l'istanza. Nessun pulsante "crea comunque", perché non
esiste. La richiesta è un gesto facile, non una frase di scuse: una riga da copiare con titolo e
autore già dentro.

**Fonti irraggiungibili è un altro stato**, distinto da "non esiste", altrimenti chi cerca pensa
che il libro non ci sia mentre è solo il catalogo che non risponde.

---

## 14. Annali

Stessi piani e stessa luce dello scaffale, in tono minore. I numeri in Inter Tight, tabulari,
allineati. Nessun trattamento tipografico speciale: l'espressività è riservata agli insight.

Una carta per blocco di metrica, tutte sul piano 1, nessuna sollevata: negli Annali non c'è
niente da afferrare, quindi non c'è niente da sollevare.

**Ogni numero porta accanto il suo limite, in una riga piccola, sempre**, non solo quando c'è
un'anomalia.

Le righe riflettono comportamenti del PRD:

- i libri senza pagine adottate contano solo le pagine registrate a mano, e la somma non è mai
  presentata come completa;
- il peso di un libro si ripartisce fra autori e generi, così un libro vale sempre uno. I
  decimali (1,5 accanto a un autore) restano visibili, con la frase che li spiega sotto;
- i libri senza genere restano fuori dalla classifica dei generi e lo scarto è dichiarato accanto
  — e, nella ciambella, dentro: uno spicchio neutro come le altre voci;
- "di cui 2 riletture" chiarisce che l'unità è la Lettura e non il Libro.

Selettore ad anno a frecce, con l'intervallo dichiarato dal primo anno con dati a oggi. Anni
futuri non selezionabili; un anno intermedio senza letture mostra zeri, non un errore.

Autori più letti: classifica a cinque voci con "mostra tutte", barre in `accent`, mai una scala
di colori diversi per voce — sono la stessa grandezza misurata su soggetti diversi. Generi
principali: stesso principio ma a ciambella, perché il part-to-whole si legge meglio come
porzione di un intero che come barre affiancate; resta un solo accento, non una tavolozza — gli
spicchi sono la stessa tinta a passi di opacità decrescenti, lo spicchio "non classificato" è
neutro (`surface-2`, lo stesso dell'assente sullo scaffale), al più cinque spicchi con peso
proprio oltre i quali si ripiegano in "Altri generi".

La spiegazione della divergenza a cavallo d'anno compare solo quando serve, cioè quando in
quell'anno esiste almeno una lettura che attraversa il capodanno: il libro conta nell'anno di
chiusura mentre le pagine restano divise fra i due anni secondo quando sono state segnate.

---

## 15. Libreria di un collegato

**La stessa stanza, con la lampada di un altro.** Il piano 0 scende di 0.02 in luminanza e perde
quasi tutto il croma; le carte restano, ma nastri e stelle passano da `accent` a `ink-soft`.

**La barra globale sparisce del tutto**, sostituita da una barra contestuale: link di uscita "‹
Lettori" (la stessa via da cui si è entrati, non il tasto indietro del browser), il nome della
persona con le iniziali accanto, fisso mentre si scorre la pagina, e due schede interne —
**Libreria** e **Annali**. La barra globale torna solo uscendo da "‹ Lettori". Vale identico per
la scheda del singolo libro di un collegato (§9): anche lì la barra globale sparisce, sostituita
da "‹ [nome]" verso la sua libreria e il titolo del libro accanto alle sue iniziali — un livello
alla volta, mai un salto diretto a Lettori da dentro un libro.

**Scheda Annali del collegato.** Le sue metriche di lettura, calcolate sui suoi dati: stessa
card della propria vista Annali (§14), più l'affiancamento con le tue metriche dello stesso anno
e i libri letti in comune con i voti affiancati.

**Libri in comune.** L'intestazione della sua libreria porta anche il numero di opere che
possiedi anche tu, calcolato dalle due liste già caricate.

**L'assenza è muta.** Nessun lucchetto dove starebbe la nota di intenzione, nessun "questo
insight è privato", nessun posto vuoto che riveli che qualcosa esiste e non ti è dato. Un
lucchetto è metadato: rivela che una nota c'è, e il PRD dice che non è visibile a nessuno mai —
e quel "mai" comprende sapere che esiste. Vale identico per insight e recensioni resi privati.

**Nessuna superficie di scrittura e nessuna traccia di dove sarebbero.** Niente "segna
avanzamento", niente stelle cliccabili, niente campo nota. La pagina destra non ha un solo
pulsante, e nemmeno un solo elemento sul piano 2, perché il piano 2 è il piano di ciò che si può
toccare.

**Anche la coda dei libri da leggere è visibile**, come impone il PRD: non esistono libri
nascosti né parti di libreria riservate.

**Collegamento interrotto:** la schermata non dice "sei stato rimosso" e non dice "errore". Dice
che quella libreria non è più accessibile e riporta all'elenco. Una stanza chiusa, non un guasto.

---

## 16. Lettori

L'elenco mostra nomi e i tre stati della relazione, e nient'altro: non relazioni fra terzi, non
libri, non metriche, nessun conteggio di collegamenti, nessuna anteprima. È un registro di nomi.

Le richieste compaiono solo nella Torre. Nell'elenco una richiesta in attesa è testo, non un
pulsante.

**Il rifiuto non lascia traccia.** Chi ha chiesto vede la relazione tornare ad assente,
indistinguibile da chi non ha mai chiesto. Nessun blocco, richiesta reinviabile.

Qui non c'è scaffale e non ci sono oggetti: sono persone, non volumi. Una sola carta lunga sul
piano 1, righe separate da filetti, iniziali in Fraunces. Nessuna immagine di profilo, che il PRD
non prevede.

**Due gruppi, non una lista sola.** L'elenco fa due mestieri con frequenze opposte: andare da
qualcuno con cui sei già collegato, quotidiano, e trovare qualcuno da chiedere, che in un gruppo
chiuso capita poche volte l'anno.

- **I tuoi collegamenti** — solo chi ha una relazione attiva. Ogni riga è pura navigazione:
  iniziali, nome, un chevron, l'intera riga è il link verso la sua libreria (§15). Nessuno stato
  scritto accanto: essere nell'elenco è già lo stato.
- **Altri membri** — chi non è (ancora) collegato. A destra della riga, tre varianti secondo la
  relazione: un bottone "Chiedi il collegamento" quando è assente; il testo "Richiesta inviata"
  quando l'hai chiesta tu; il testo "Ti ha chiesto il collegamento" quando l'ha chiesta lui.
  Resta vero l'invariante sopra: qui è sempre testo, mai un pulsante che accetta o rifiuta.

Sotto il secondo gruppo, una riga ricorda che le richieste si accettano nella Torre. Un gruppo
vuoto non mostra la sua carta.

---

## 17. Torre

Una superficie sola, due sezioni. Sopra i collegamenti (richieste ricevute, inviate, attivi con
interruzione), sotto le impostazioni.

Le impostazioni contengono cinque cose: l'avviso di visibilità, la luce della stanza, il consenso
all'elaborazione assistita, l'esportazione dei libri letti, la cancellazione dell'account. La
luce sta per prima fra le cinque perché è la sola che non riguarda i dati: cambia come si vede
l'app, non cosa l'app fa dei tuoi testi.

**Interrompere un collegamento: azione immediata, senza dialogo di conferma, con un annulla che
resta per qualche secondo.** Interrompere non è simmetricamente reversibile: tu interrompi da
solo, ma per tornare indietro serve che l'altro accetti una nuova richiesta.

**I due testi lunghi sono quelli del PRD, parola per parola.** L'avviso di visibilità e il testo
del consenso non vanno riscritti in forma più breve.

Sotto il consenso, una riga sulle note di intenzione: non escono mai, in nessuno stato del
consenso.

L'interruttore nasce acceso. Spegnendolo va detto cosa succede subito e cosa no: le cinque
funzioni si spengono e gli indici si cancellano, ma gli artefatti già generati restano come
contenuti dell'utente.

Decisioni di design che governano l'interruttore:

- **È l'unico interruttore dell'app.** Primitivo `@base-ui/react` come gli altri
  (`components/ui/switch.tsx`), traccia in `accent` quando è acceso — l'unico uso ammesso
  dell'accento come riempimento — e `surface-2` quando è spento. Nessun rosso: `alert` ha un uso
  solo in tutta l'app, e non è questo.
- **Nessuna finestra di annullamento**, a differenza dell'interruzione di un collegamento (sei
  secondi). La differenza è la reversibilità: spegnere il consenso lo è del tutto — riaccendendolo
  gli indici si ricostruiscono da soli. Un "annulla" su un gesto reversibile è rumore.
- **La riga sotto l'interruttore cambia con lo stato**, e dice sempre la cosa che si sta per
  fare, non quella appena fatta: acceso, spiega cosa succede spegnendo; spento, spiega cosa
  succede riaccendendo (ricostruzione, con la ricerca semantica che si dichiara incompleta finché
  non finisce).
- **Il comando è ottimistico**, come ogni altro dell'app: l'interruttore si muove subito e torna
  indietro da solo se la scrittura non riesce, con l'errore in testo sotto — mai un riquadro
  rosso.
- **Una riga di stato reale**, non solo generica: sotto il testo che spiega cosa *farà*
  l'interruttore, quando il consenso è acceso una seconda riga dice lo stato vero ("Gli indici
  sono pronti." / "Gli indici si stanno ricostruendo..."), aggiornata a ogni cambio.

### Esportazione dei libri letti

Un pulsante piano, tra il consenso e la cancellazione: nessuna conferma, perché non è un'azione
distruttiva. Scarica un CSV con i libri che l'Utente ha segnato come letti — titolo, autori,
generi, date di lettura, voto e recensione — mai insight né nota di intenzione. Una riga di
didascalia lo dice, così chi si aspetta di ritrovarci anche i propri insight non se lo scopre
solo aprendo il file.

Non è collegata alla cancellazione dell'account che segue subito sotto: non la propone, non la
richiede, non la ricorda. È sempre disponibile, per chi la vuole usare prima di qualunque altra
cosa.

### Cancellazione dell'account

Non è un pulsante rosso. È in fondo, in tono piano, sul piano 1 come tutto il resto. La
difficoltà sta dove deve stare: bisogna scrivere il proprio nome utente, e il pulsante resta
spento finché non coincide.

Il rosso e i toni allarmati sono evitati di proposito: un'azione che richiede di digitare il
proprio nome è già difficile da compiere per errore. Il rosso, in quest'app, vuol dire una cosa
sola, ed è il contatore delle richieste.

Schermata finale: due righe che dicono che l'account non c'è più e che per rientrare serve
parlare con chi mantiene l'istanza.

---

## 18. Stati vuoti e riautenticazione

Uno stato vuoto è un invito ad agire, tranne quando non c'è niente da fare, e in quel caso lo
dice.

Gli stati vuoti sono l'unico posto dell'app dove si concede un disegno: una mensola vuota in SVG
a tratto, un chilobyte, colore `ink-soft`, larga quanto il contenuto. Non un rettangolo
tratteggiato, non un'illustrazione piena, non una mascotte.

**Scaffale vuoto:** la mensola disegnata, e sotto un promemoria che il PRD rende possibile: si
può datare una lettura a quando è successa, quindi caricare la libreria storica senza schiacciarla
sulla data di inserimento.

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

**La forma di un errore: il soggetto è la cosa, e segue il passo successivo.**

> "La recensione non è stata salvata. Il testo è ancora qui."

Dove il testo dell'Utente è ancora nel campo, il messaggio lo dice: è l'informazione che più
serve a chi ha appena scritto trecento parole. Nessun termine tecnico interno arriva fino allo
schermo, e nessun titolo generico ("Qualcosa è andato storto") compare sopra un errore senza
aggiungere nulla.

**Una voce sola per l'attesa.** La prima persona vale solo dove l'app sta davvero lavorando per
te, quasi sempre con il modello ("Ci penso…", "Cerco temi…"); altrove nessuna etichetta, perché
uno scheletro con la forma del contenuto dice già cosa sta arrivando.

**L'apostrofo è quello tipografico (`’`), mai quello dritto.** Le stringhe vivono in
`frontend/messages/it.json`/`en.json`, il catalogo `next-intl` dell'interfaccia bilingue.

**Tre canali.**

| Canale | Quando | Dove |
|---|---|---|
| **In linea** (`ui/messaggio.tsx`) | il caso normale: il comando è ancora sotto gli occhi | accanto al comando, `aria-live="polite"` |
| **Toast** (`providers/toast-provider.tsx`) | il bersaglio può essere già scorso via, o la scrittura è ottimistica e l'errore arriva dopo che l'interfaccia si è mossa | in fondo alla pagina, `role="alert"` |
| **`ErrorState` / `EmptyState`** | fallisce o è vuota una regione intera | al posto della regione |

Un toast in fondo alla pagina non dice a quale riga di un elenco si riferisce: è la ragione per
cui il primo canale è il predefinito e il secondo l'eccezione. Nessun modale, nessun avviso che
si sovrappone: solo pannelli in pagina. Il rosso (`alert`) non compare mai su un errore, nemmeno
nel toast, che è testo su una carta di piano 2 come ogni altro pannello. Vedi §12 per il dettaglio
sull'avanzamento.

**Conferma di un salvataggio senza un bottone "Salva" esplicito** (pagine adottate, nota di
intenzione: si scrive e si esce dal campo, il blur salva da solo): il toast resta riservato agli
errori, quindi la conferma è una riga discreta ("Salvato.", mai "con successo") accanto al campo,
che compare per un momento e sparisce.

Interfaccia bilingue italiano e inglese dal primo giorno. Stringhe fuori dal codice fin
dall'inizio; date e numeri seguono la lingua del browser. I contenuti scritti dagli utenti non si
traducono.

---

## 20. Stack e strumenti

Next.js App Router su Vercel.

### Base

- **Tailwind v4 su token propri**, dichiarati in `@theme`. Colore, piani, ombre e luce come
  variabili CSS: l'ora è un cambio di variabili, non di componenti. Nessun colore va mai scritto
  a mano in un componente.
- **Una sola sorgente di verità per la palette:** `src/lib/light.ts`. Uno script di build genera
  `src/styles/tokens.anchors.css`, che non si modifica a mano.
- **Base UI** (`@base-ui/react`) come libreria di primitivi, non un'estetica preconfezionata da
  disfare.
- **`next/font/local`** per le tre famiglie variabili, subset latino.
- **Nessuna libreria 3D, nessuna libreria di smooth scroll, nessuna libreria di illustrazioni.**
  Gli unici SVG dell'app sono la mensola vuota, la grana e le icone, disegnati a mano e inline.

### Movimento

| Strumento | A cosa serve |
|---|---|
| **CSS** (`transform`, `opacity`, `transition-colors`) | Sollevamento, transizioni di piano, stati al passaggio del mouse |
| **View Transitions** | Rito di apertura. Dentro la stessa pagina disponibile ovunque; fra pagine diverse ancora in evoluzione nei browser. Miglioramento progressivo, mai fondamenta |
| **Animazioni CSS guidate dallo scroll** | Fisarmonica, striscia agganciata. Girano sul compositore solo se animano transform e opacity |
| **`sibling-index()`** | Scaglionare la fisarmonica senza JavaScript |
| **Query `scroll-state`** | Sollevare il volume agganciato al centro su mobile |
| **`@starting-style`** | Ingresso dei pannelli senza JavaScript |

**Mai il layout, mai `box-shadow`.** Si anima solo `transform`, `opacity` e proprietà di paint
come `color`/`background-color` (corrette per uno stato al passaggio del mouse, perché non
passano dal layout). `box-shadow` non è compositabile: ogni transizione di piano passa da uno
pseudo-elemento a cui si anima `opacity`. Larghezze, altezze e margini non si animano mai. Tutto
dietro `prefers-reduced-motion`.

**Niente Rive, niente Lottie.** Sono strumenti per animazioni disegnate in un editor esterno: tutto
ciò che si muove in quest'app è una transizione di stato, e CSS copre i casi senza aggiungere
runtime.

Le voci di supporto browser vanno ricontrollate prima di costruire una feature che ne dipende, in
particolare su Safari e le transizioni fra pagine diverse.

---

## 21. Descrizione dell'opera

Il Libro ha una descrizione (§9, entità Descrizione nel PRD). Fonte preferita Wikipedia — prosa
scritta per spiegare di cosa parla un libro, non per venderlo — con ripiego su Google Books
quando l'opera non è abbastanza notabile per avere una voce. Nessuna generazione da un modello:
solo testo che una fonte ha già scritto, mai inventato.

**Standardizzazione assistita delle descrizioni fuori standard.** Alcune voci Wikipedia si
riducono a una sola frase, sotto lo standard di prosa breve; altre — soprattutto le trame di
Google Books, scritte per vendere — lo superano abbondantemente. La regola "mai inventato" si
applica ai fatti, non alla formulazione: un lavoro in secondo piano
(`app/lavori/standardizzazione_descrizione.py`) riformula le sole descrizioni fuori dalla fascia
200-900 caratteri — espandendole o accorciandole secondo il caso — a 400-600 caratteri, 3-5
frasi, registro enciclopedico (neutro, informativo, mai promozionale). Quelle già nella fascia
restano quelle originali della fonte. Chiamato "standardizzazione" e non "arricchimento", perché
il lavoro accorcia tanto quanto espande.

Tre vincoli tengono ferma la regola:

- **Ancorato solo a fatti già verificati**: il modello riceve il testo sorgente reale e i dati già
  presenti nel database (titolo, autori, anno di prima pubblicazione, generi) — mai la sua
  conoscenza generale dell'opera. Il prompt istruisce esplicitamente a fingere di non sapere altro
  sull'opera, con un esempio concreto di cosa non fare, dopo che un modello generico ha aggiunto
  di sua iniziativa un dettaglio non presente nella frase sorgente. Se il sorgente è troppo scarno
  per raggiungere 400 caratteri restando fedele, il testo prodotto resta più breve.
- **Accorciare non deve alterare il significato**: nessun fatto nuovo, e il prompt vieta
  esplicitamente di tagliare un dettaglio che ne qualifica un altro (una data, una condizione)
  lasciando un'affermazione che il testo originale non faceva.
- **Tracciato in database**: `libro_descrizione.riformulata` marca il testo come riformulato dal
  modello — stesso trattamento di `anno_dedotto`/`lingua_dedotta`. Il testo riformulato si mostra
  oggi senza distinguerlo dalla citazione letterale della fonte.

Non richiede consenso dell'Utente: è una funzione bibliografica su dato condiviso, come
classificazione dei generi, deduplicazione e riconduzione degli autori, e lavora solo su
titolo/autori/anno/generi/descrizione di catalogo, mai su contenuto personale.

**Traduzione assistita delle descrizioni mancanti.** Il meccanismo sopra recupera testo reale per
lingua ma non traduce mai: dove nessuna fonte ha il testo in una delle due lingue dell'interfaccia,
il blocco descrizione semplicemente non compare. Quando un'opera ha una descrizione reale in una
lingua ma non nell'altra, un lavoro in secondo piano (`app/lavori/traduzione_descrizione.py`)
traduce il testo esistente verso la lingua mancante, mai lo genera da zero. Accodato sia alla
nascita della scheda (`catalogo_repository.crea_scheda`) sia dopo il tentativo Wikipedia
(`app/lavori/descrizioni.py`), perché solo lì si conosce lo stato definitivo delle due lingue.

Se un testo reale arriva per quella lingua fra l'accodamento e l'esecuzione, la scrittura della
traduzione è un `insert ... on conflict do nothing`: non sovrascrive mai un testo reale con uno
tradotto. Fonte e attribuzione (`fonte`, `url_fonte`) sono ereditate dalla riga sorgente — il
testo cambia lingua, non provenienza, e l'attribuzione CC BY-SA di Wikipedia resta dovuta anche su
un derivato tradotto. Un testo tradotto fuori dalla fascia 200-900 caratteri viene accodato per la
stessa standardizzazione già descritta sopra.

**Scope**: solo le due lingue dell'interfaccia (`it`/`en`). Se l'unica descrizione disponibile è
in una terza lingua, resta fuori scope: la scheda si comporta come oggi, nessun blocco
descrizione.

---

## 22. Ricerca semantica

**Una pagina a sé, `/cerca`.** Non un secondo campo sullo scaffale: revocare il consenso
lascerebbe l'utente senza il modo di trovare un libro, e i due campi farebbero un mestiere
diverso con lo stesso aspetto. Ci si arriva da un collegamento in fondo alla riga dei filtri
della Libreria — dove nasce il bisogno — e non da una voce di menu: la navigazione ha quattro
voci (§5) e restano quattro.

**Non cerca mentre si digita**, a differenza del filtro dello scaffale e della ricerca sui
cataloghi (§13). Ogni interrogazione costa una chiamata al fornitore, e una domanda in linguaggio
naturale si finisce di scrivere prima di volerla porre. Campo con la sola riga inferiore come
ogni altro campo dell'app, `aria-label` esplicita, e un pulsante "Cerca" accanto.

**Un risultato è l'insight, con accanto il libro da cui viene**, come stabilisce §10: prima il
titolo e l'autore in `t-meta` come collegamento alla scheda, poi il testo nel suo trattamento
tipografico normale (sentenza o appunto secondo la lunghezza), poi la data e il tipo.

**Uno spoiler compare in chiaro qui**, a differenza di ogni altro elenco: la regola protegge da
uno spoiler *altrui*, e in questa pagina ogni risultato è già del richiedente, mai di un
collegato (la ricerca non attraversa mai i contenuti condivisi, §7). Il contrassegno resta
comunque leggibile accanto a data e tipo, come promemoria di ciò che si è marcato per gli altri.

**I risultati passano un filtro di pertinenza minima**, non solo un limite di quantità:
`cerca_semantico` scarta chi è oltre una certa distanza dalla domanda, invece di riempire sempre
fino a un tetto fisso. Senza quel filtro, una libreria piccola restituirebbe sempre tutto ciò che
ha, semplicemente riordinato. La soglia è tarata sui dati e resta rivedibile in un punto solo
(commento sulla RPC, `supabase/migrations/`).

### I tre stati che non vanno confusi

| Stato | Cosa si mostra |
|---|---|
| Nessuna corrispondenza | "Non hai ancora scritto nulla che somigli a questa domanda." |
| Consenso revocato | Uno stato vuoto che dice che la funzione è spenta e rimanda alla Torre |
| Indici in ricostruzione | I risultati che ci sono, più una riga che dichiara che sono incompleti |

Un elenco vuoto direbbe la cosa falsa più credibile che esista — che non hai scritto nulla al
riguardo — quindi il caso "consenso revocato" va dichiarato esplicitamente. Lo stesso per gli
indici incompleti: la riga sta sopra i risultati, non sotto, perché chi legge un elenco corto
deve sapere perché è corto prima di concludere che è tutto.

Nessuno dei tre è un errore, e nessuno dei tre è un riquadro rosso: sono testo, come ogni altro
messaggio dell'app (§19).

---

## 23. Suggerimenti di lettura

**Una pagina a sé, `/suggerimenti`.** Stessa ragione di `/cerca`: dipende dal consenso, e la
navigazione (§5) resta a quattro voci. Ci si arriva da un collegamento in fondo alla riga dei
filtri della Libreria, accanto a "Cerca nei tuoi insight".

**Effimeri.** A differenza della preview e della sintesi tematica, un suggerimento non è un
`artefatto_generato`: ogni pressione del pulsante "Suggeriscimi qualcosa" (poi "Suggeriscimi
altro") ne genera di nuovi senza conservare i precedenti. Non c'è una vista "i tuoi suggerimenti
passati".

**Ogni titolo che arriva alla pagina è già verificato.** Il backend chiede fino a otto candidati e
scarta quelli che nessun catalogo conosce prima di rispondere
(`suggerimenti_service._verifica_e_diversifica`) — la ricerca lato client, con lo stesso
procedimento di `/aggiungi` (§13, locale poi esterno), trova quasi sempre un comando "Aggiungi"
da mostrare. Il ramo di solo testo — titolo, autori, motivazione, senza copertina né comando —
resta come margine di sicurezza per un risultato esterno scaduto dalla cache fra le due ricerche.

**La motivazione è sempre concreta**, mai una lode generica: il prompt lega ogni suggerimento a
un elemento reale del profilo di chi chiede — un titolo amato, un autore delle letture recenti,
un tema che torna negli insight — sullo stesso registro della preview (§9). Tre o quattro frasi,
mai un trattino lungo o medio (sostituito con una virgola se il modello lo scrive lo stesso).
Trattamento tipografico di un insight vero (`t-sentenza`/`t-appunto`, §10), stesso troncamento a
otto righe e "Mostra tutto".

**Una preferenza per questa sola richiesta**, facoltativa e sempre visibile — mai dietro un "più
opzioni" — un campo a riga sola sopra il pulsante, stesso trattamento del campo di ricerca
semantica (§22). Non salvata, non un artefatto, non un insight: vive nel corpo della singola
richiesta e sparisce con lei. Il backend la tratta come una preferenza da considerare insieme al
profilo, mai come un'istruzione che sostituisce le regole di generazione — un tentativo di
cambiare argomento (rivelare le istruzioni del modello, farlo comportare diversamente) viene
ignorato in silenzio: i suggerimenti arrivano lo stesso, senza tenerne conto.

**Il profilo distingue tre gruppi con ruoli diversi**, non uno storico piatto: i libri amati
(voto alto, di qualsiasi età), le letture più recenti (qualsiasi voto), i libri non piaciuti o
abbandonati (per capire cosa evitare, mai per proporre "altri libri così"). Un libro già in
libreria, in qualunque stato — anche "da leggere" — non viene mai riproposto.

**Un'etichetta silenziosa per la scoperta.** Ogni proposta è "affine" (vicina a ciò che ami o
leggi ora) o "scoperta" (stesso territorio, un passo di lato). Solo "scoperta" si mostra in
pagina, in `t-meta`, accanto alla motivazione.

**Nessun badge "sintesi generata"**: a differenza della preview e della sintesi tematica, qui non
c'è un singolo testo in prosa la cui origine vada dichiarata — la pagina stessa, con il suo
titolo e la sua introduzione, dice già che si tratta di proposte del modello.

Due stati vuoti, entrambi testo e non un riquadro rosso: consenso revocato ("L'elaborazione
assistita è spenta", con rimando alla Torre) e profilo insufficiente (nessun libro amato, nessuna
lettura conclusa, nessun deluso).

---

## 24. Sintesi tematica

Un elenco di temi, ciascuno con le prove attaccate — non un paragrafo unico: un tema verificabile
e collegato ai libri da cui viene serve, un riassunto in prosa della libreria no.

**Una pagina a sé, `/sintesi`.** Stessa ragione di §22/§23: dipende dal consenso, quattro voci di
navigazione restano quattro, si arriva da un collegamento nella riga dei filtri della Libreria.

**Un tema è una carta**, su piano 1 con grana, non una riga di elenco: nome del tema in
`t-label` (stesso trattamento delle intestazioni di gruppo negli insight, §10), poi la frase che
lo descrive in `t-sentenza`/`t-appunto` a seconda della lunghezza — un'osservazione breve, non
una didascalia generata. Sotto, i libri distinti da cui viene il tema, ciascuno un collegamento
alla propria scheda. Un comando testuale, "Mostra gli insight", apre l'elenco degli insight e
delle recensioni veri che hanno prodotto il tema, con lo stesso trattamento della ricerca
semantica (§22): titolo del libro come collegamento, testo, poi tipo e data.

**Nessun tema debole.** Un tema sostenuto da un solo libro non è trasversale, e non compare — non
attenuato, non segnalato come incerto, assente. Se dopo il filtro non resta alcun tema, la
sintesi non si genera né sostituisce quella esistente: meglio nessuna carta che una carta vuota o
un pattern su un libro solo. Due testi distinti per i due modi in cui questo succede: non hai
ancora scritto nulla ("Scrivi qualche insight o recensione prima di chiedere una sintesi"), oppure
hai scritto ma nulla si collega ancora fra libri diversi ("Non emerge ancora un tema che
attraversi libri diversi. Continua a scrivere e a leggere, poi riprova").

**Sostituisce, non si accumula** — a differenza della preview (§9), che accumula apposta perché un
parere per ogni rilettura ha senso. Esiste al più una sintesi tematica per utente: generarne una
nuova cancella la precedente, mai prima di avere quella nuova pronta. Il pulsante lo dice: "Genera
una sintesi" la prima volta, "Genera di nuovo" quando ce n'è già una.

**Lo stesso avviso della preview**: badge "Sintesi generata", campo della risposta e non frase
dentro un testo, sopra l'elenco dei temi — vale per l'intero risultato, non ripetuto su ogni
carta.

**Come per la preview**: a consenso revocato la sintesi già generata resta leggibile e cancellabile
dal proprietario, temi ed insight collegati compresi; solo il pulsante "Genera di nuovo" sparisce,
sostituito da un rimando alla Torre.
