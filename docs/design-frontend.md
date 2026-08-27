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

**Il comando nel Profilo.** Un selettore a tre stati — **Segui l'ora / Giorno / Notte** — dà a chi
ha una sensibilità particolare alla luce la possibilità di fissare la stanza. "Giorno" e "Notte"
nominano l'ancoraggio che fissano, non un'invenzione a parte: si chiamavano "Chiara"/"Scura", un
secondo vocabolario per gli stessi due ancoraggi (§2) che il resto del documento chiama "giorno" e
"notte". "Segui l'ora"
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

**Regola sul rosso.** `alert` compare in **due posti** in tutto il prodotto, e non ne esistono
altri: il contatore delle richieste ricevute accanto a Lettori, perché è l'unica cosa che chiede
un'azione, e il bordo della zona di cancellazione dell'account (§17). Non sugli errori, che sono
testuali. Non sui nastri, che hanno un rosso proprio di stato. Non su un pulsante, quello della
cancellazione compreso.

*Era un posto solo.* Il secondo è arrivato quando la cancellazione dell'account è stata raccolta
in una zona di pericolo: un riquadro che si annuncia come tale è la convenzione che chiunque
riconosce, e spendere il rosso lì è più difendibile che spenderlo solo su un contatore. Due usi
restano leggibili come "una cosa che chiede attenzione"; tre non lo sarebbero più, ed è per
questo che l'elenco sopra è chiuso.

E mai come **testo**: `alert` tiene 4.57:1 su `surface-1` nel punto peggiore dell'anno, cioè sette
centesimi sopra la soglia AA del corpo. Sette centesimi non sono un margine, sono una coincidenza.
Entrambi gli accostamenti sono verificati su tutto l'anno da `scripts/check-contrast.mts`.

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

### Le due scale della testata di pagina

Erano tre — 44, 34 e 28 — e una sola era scritta da qualche parte: 34 era nato nella barra di un
collegato e 28 sulla scheda del libro, ciascuno per conto proprio, ripetuti a mano su sei
componenti come `text-[44px] sm:text-[56px]`. Ora sono due, stanno in `tokens.css` col loro corpo
dentro, e la distinzione non è l'importanza ma **la natura della stringa**.

| Ruolo | Specifica | Dove |
|---|---|---|
| `.t-page` | Fraunces 300, 44 / 56px, opsz pari al corpo | Una **parola fissa** dell'interfaccia, nota in anticipo: Quaderni, Lettori, Profilo, Aggiungi un libro, e l'anno degli Annali |
| `.t-contenuto` | Fraunces 300, 34 / 46px, opsz pari al corpo | Una stringa di **lunghezza ignota**, che deve andare a capo e troncarsi: il nome di un collegato, il titolo di un libro |

`.t-page-num` è la variante per un titolo che è un numero (l'anno): cifre tabulari e spaziatura a
zero, perché il tracking negativo è pensato per parole. **Non si compone con `.t-num`**, che porta
anche `font-family: var(--font-ui)` ed è definita più in basso nello stesso layer: il titolo
uscirebbe in Inter Tight. È la solita insidia delle due classi che si scavalcano sulla stessa
proprietà, la stessa che per mesi ha fatto vincere `.t-label` su `text-ink`.

**Il titolo del libro sale da 28 a 34.** Era la stringa più importante dell'app e il carattere più
piccolo fra i titoli — più piccolo della parola «Profilo».

### L'asse ottico segue il corpo

`opsz` su Fraunces è una **misura, non un gusto**: va posto al corpo a cui il testo viene reso, ed
è la ragione per cui il file variabile con l'asse sta in repo. `.t-display` lo fissava a 72 a ogni
dimensione, cioè dava le proporzioni da manifesto — aste sottili, grazie affilate — a un titolo da
28px. Su un telefono, su fondo chiaro, si vede.

Ora passa da `--t-opsz`, che ogni ruolo pone al proprio corpo. Non si usa
`font-optical-sizing: auto`, che farebbe il lavoro da sé: WebKit lo disattiva in presenza di
`font-variation-settings`, e `SOFT` si può dichiarare solo da lì.

**Su Literata vale il contrario, ed è deliberato.** Lì l'asse ottico è usato come *voce* e non come
misura — opsz 32 a 19px per la sentenza, opsz 12 a 15px per l'appunto — ed è esattamente ciò che
permette a due corpi di essere lo stesso carattere con due registri. Un valore diverso dal corpo,
là, è la scelta; su Fraunces era una svista.

**Composizione.** `text-wrap: balance` sui soli titoli, dove è costoso e oltre le sei righe non
ha effetto. `text-wrap: pretty` sui paragrafi lunghi. `text-box-trim` sui titoli display, perché
a corpo grande lo spazio ottico sopra e sotto si vede. `font-variant-numeric: tabular-nums` su
ogni numero di metrica, sempre, altrimenti le colonne ballano al cambio d'anno. Nessun
`letter-spacing` negativo sotto i 24px; sopra, fino a `-0.02em` sul display.

---

## 5. Navigazione

Quattro voci: **Libreria, Quaderni, Annali, Lettori.** In inglese: Library,
Notebooks, Annals, Readers.

| Voce | Contenuto |
|---|---|
| Libreria | Scaffale, filtri |
| Quaderni | Ciò che hai scritto: ricerca per significato e temi trasversali |
| Annali | Metriche per anno |
| Lettori | Le persone e il rapporto con loro |

**Quaderni non è il ritorno della Torre.** La quarta voce di prima era un
contenitore di impostazioni che si apriva una volta al mese; questa è il posto
dove sta ciò che l'Utente ha scritto — insight, recensioni, e i temi che li
attraversano — cioè metà della materia dell'app, che fino ad agosto 2026 viveva
in tre pagine senza ingresso (`/cerca`, `/sintesi`, `/suggerimenti`) raggiungibili
solo da un disclosure chiuso in mezzo ai filtri della Libreria.

Le due obiezioni che le tenevano fuori dalla barra — scritte nelle sezioni che
quelle tre pagine descrivevano — vanno tolte, non aggirate. La prima — «la navigazione ha quattro voci e restano
quattro» — è un argomento sulla barra usato per decidere una collocazione: dice
dove una funzione *non* va, non dove va. La seconda — «una voce di menu che può
essere spenta è una voce sbagliata» — vale per una funzione, non per una materia:
i propri scritti esistono anche a consenso revocato, ed è solo il modo di
interrogarli che si spegne, cosa che la pagina dichiara invece di sparire.

Quella seconda risposta è stata a lungo una promessa e basta: fino al 25 agosto
2026 Quaderni a consenso revocato era due stati vuoti, perché la pagina non
conteneva i propri scritti — li interrogava soltanto. Ora li contiene (§22), e la
promessa è mantenuta dal codice: sfogliare, filtrare, scrivere e ripescare un
vecchio pensiero non chiedono niente al fornitore.

Il nome sta nel registro di «Annali»: una parola piana che nomina la cosa, non il
meccanismo che la produce. Una voce chiamata «Assistente» o «Chiedi» sarebbe stato
il cassetto di prima con una linguetta più grande, e avrebbe violato la regola di
questo stesso paragrafo — il rimando letterario sta nell'insegna, non nella
segnaletica interna.

**Erano quattro, e la quarta era "Torre".** Conteneva i collegamenti e le impostazioni, e ne è
uscita per due ragioni indipendenti. La prima è la frequenza: le altre tre si aprono ogni giorno,
quella si apriva una volta al mese, e tenerla alla pari mentiva su quanto servisse. La seconda è
il nome — era l'unica voce metaforica su una barra di nomi letterali, contro la regola che questo
stesso paragrafo enuncia poche righe più sotto ("il rimando letterario sta nell'insegna, non nella
segnaletica interna").

Dei suoi due contenuti, i **collegamenti** sono passati a Lettori (§16): accettare una richiesta
non è un'impostazione, è la cosa più urgente dell'app, e stava sepolta accanto a "cancella
l'account" mentre nella pagina dove compariva la persona la stessa richiesta era testo inerte. Ciò
che resta è il proprio account, che ora si chiama **Profilo** (§17) e non sta in barra: ci si
arriva dalle proprie iniziali, in alto a destra nella barra su desktop e in cima al contenuto su
telefono, dove la barra in alto non esiste. "Profilo" non è una parola inventata qui: è quella che
il PRD usa per questa superficie ("Interruttore nel profilo dell'Utente", "una superficie dedicata
nel profilo"), mentre riserva "impostazioni" alle azioni sui dati — che sono infatti i titoli
delle sezioni là dentro.

Con l'arrivo di Quaderni le linguette in fondo tornano quattro, e l'etichetta resta nel
maiuscoletto pieno di §4 senza stringerne la spaziatura: la più lunga, «QUADERNI», misura
una sessantina di pixel su una linguetta che a 320px ne ha ottanta.

La barra sta sul piano 0, non su una carta: non è contenuto, è la stanza. La voce attiva si
segnala con l'inchiostro pieno e un filetto, non con un riempimento.

**Due barre, non una resa elastica.** Da 640px in su la barra sta in cima ed è fissa allo
scorrimento, con le proprie iniziali e il nome utente in fondo a destra. Sotto i 640px le stesse
voci diventano una barra in fondo allo schermo, dove sta la navigazione di un'app e dove
arriva il pollice; le iniziali passano in cima al contenuto, allineate a destra sopra il titolo
di pagina, perché lassù non c'è più una barra che le ospiti. "Esci" non sta in nessuna delle due:
è nel Profilo, prima sezione. Lo scambio è in CSS, non in JavaScript, quindi non c'è un istante
in cui compare la barra sbagliata.

**Senza icone, di proposito.** In tutta l'app non esiste un vocabolario di icone — due chevron
in un selettore d'anno e qualche glifo tipografico. Quattro parole corte bastano, e la voce attiva
si legge dal filetto come in alto. Le iniziali non fanno eccezione: sono già il modo in cui l'app
rappresenta una persona (§16, §15), non un'icona nuova, e non portano il filetto della voce
attiva nemmeno sul Profilo — non sono una destinazione fra le altre, sono chi sei.

Il contatore delle richieste ricevute sta accanto a **Lettori** ed è l'unico elemento in `alert`
di tutta l'app: senza contatore una richiesta resterebbe invisibile per sempre, non avendo l'app
notifiche. Stava accanto a Torre, cioè accanto a una pagina diversa da quella in cui la richiesta
compariva: segnalava una cosa da fare altrove. Ora sta accanto al posto dove si agisce, e quando
non c'è nulla da fare sparisce insieme alla sua sezione.

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
6. **La lettera dell'autore è una tacca fra un volume e l'altro**, con un filetto di 10px che
   scende sulla mensola. Non è un ripiano a sé, e **non occupa larghezza**: sta dentro il gap che
   separava già i due volumi (larghezza zero, margini negativi di mezzo gap). Era un elemento in
   flusso di 18px più il proprio gap — trenta pixel di mensola per una lettera, che su un telefono
   sono un quarto di volume, ed erano la ragione per cui una riga ne teneva due invece di tre.
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

### La testata: tre righe, e non di più

Sopra lo scaffale c'erano quattro fasce di comandi — titolo di pagina con l'azione primaria,
campo col conteggio appeso in coda, cinque pastiglie, e un disclosure "Chiedi alla libreria" —
che misurate facevano **232px su desktop e 307 su un telefono**: mezza schermata di comandi
prima del primo libro, sulla pagina più visitata dell'app. Da agosto 2026 sono tre righe, 176px
e 252, e ognuna fa un mestiere solo.

> **Emendamento (revisione delle testate).** L'argomento con cui questa sezione tolse il titolo —
> «la linguetta accesa lo dice già» — **non regge alla propria misura**, ed è giusto dirlo qui invece
> di lasciarlo scoperto. Quella linguetta è `.t-label`: 10,5px, maiuscoletto, al bordo *opposto* a
> quello dove cade l'occhio, cioè il carattere più piccolo dell'app — la stessa dimensione che il §4
> dichiara illeggibile come titolo. E se bastasse davvero, dovrebbero cadere anche i titoli di
> Quaderni, Lettori e Profilo, che ripetono la parola accesa tali e quali: l'argomento non era stato
> applicato a sé stesso. Apple, che pure concede di lasciare vuoto un titolo ridondante, lo fa per
> viste di *dettaglio* il cui contenuto si identifica da sé, e ai livelli alti spedisce la
> ridondanza ovunque (tab «Library» → titolo «Library»).
>
> **La conclusione resta però giusta, per un'altra ragione.** Il titolo sulla Libreria non serve
> perché l'orientamento arriva altrove: dalla **barra del titolo** che compare allo scorrimento (§8).
> Con quella in piedi, la prima schermata non deve più pagare un titolo per averlo — e questo vale
> per tutte le pagine, non solo per questa.

**1. Il campo, e accanto l'azione primaria.** Il titolo di pagina non c'è: «La tua libreria» stava
sotto una linguetta accesa che diceva già «Libreria», nel carattere più piccolo della pagina.
La riga che lascia libera la prende il **filtro testuale** su titoli e autori — sempre disponibile,
nessuna chiamata a nessun modello, campo con la sola riga inferiore e `aria-label` esplicita — che
smette così di sembrare un accessorio del conteggio. Accanto, «Aggiungi un libro» a pulsante pieno
e 44px: è il gesto con cui la libreria esiste, e da lì si arriva anche ai suggerimenti di lettura
(§13). Sulla libreria di un collegato l'azione non c'è e il campo prende la riga da solo.

Un campo di ricerca e un'azione primaria sulla stessa riga si distinguono da sé: il campo è una
riga di inchiostro senza riquadro, il pulsante un oggetto pieno del piano 2, e l'etichetta dice
«Aggiungi», non «Cerca».

**0. Il saluto** (sotto i 640px). Sopra il campo restava una riga con la sola porta del profilo: un
cerchietto allineato a destra e nient'altro, in cima alla pagina più visitata dell'app. Liberata dal
dover fare wayfinding, quella riga adesso porta un saluto — `.t-saluto`, Fraunces 24px.

**Ventiquattro e non tredici, e non trentotto.** Il numero è misurato, non scelto: a interlinea 1,15
la riga è alta 27,6px, cioè **meno del cerchietto da 28 che le sta accanto**, quindi il saluto entra
in una riga che esiste già e non sposta la prima mensola di un pixel. A 13px sarebbe stato il
carattere più piccolo della pagina — l'errore che il §4 condanna sui titoli di sezione. A 38 sarebbe
costato una cinquantina di pixel e sarebbe diventato un titolo che non dice dove sei, pagandone il
prezzo senza farne il lavoro.

**Segue l'orologio, non il sole.** Sarebbe stato più elegante agganciarlo ai quattro ancoraggi della
luce (§3), e per un momento è sembrata la scelta giusta: l'unico punto in cui la stanza si dice a
parole invece che in colore. Non regge. Gli ancoraggi sono **solari** — `schedule()` tiene «giorno»
fino a un'ora e mezza prima del tramonto — quindi il 21 giugno alle 19:30 il saluto direbbe
«buongiorno» a chi in italiano si aspetta «buonasera». I saluti seguono le convenzioni
dell'orologio. Resta comune ciò che conta: stessa sorgente d'ora (fuso CET fisso), calcolo lato
server a ogni cambio pagina, mai nel browser.

Quattro fasce, in `lib/saluto.ts`: 5–13 «Buongiorno», 13–18 «Buon pomeriggio», 18–24 «Buonasera»,
0–5 «Buonanotte». L'ultima è la sola discutibile — detto a chi va a dormire è un congedo — ma a chi
apre la propria libreria alle due di notte è ciò che una persona direbbe, ed è l'unico saluto che
l'italiano offra per quella fascia.

**Niente citazione del giorno.** Le massime di Montaigne sono già il rito del login (§1) e «Il
pensiero che torna» è già il quotidiano effimero dei Quaderni (§22), fatto però di parole
dell'Utente. Un terzo dispositivo giornaliero indebolirebbe entrambi, e metterebbe decorazione sopra
i libri esattamente dove questa sezione ha combattuto per recuperare pixel.

**2. Le pastiglie di stato, additive, col conteggio in fondo alla riga.** Gratuito perché i nastri
sono già un codice colore: pastiglie in contorno con un quadratino di colore di 7px e l'etichetta
in `ink-soft`; attive senza bordo, fondo `ink` al 9%, testo in `ink`. Non pastiglie piene colorate:
i libri restano l'unico posto dell'app dove il colore è un dato.

**Additive, non a sottrazione.** Nascevano tutte e cinque accese e si spegnevano per escludere:
cinque bersagli accesi che nessuno ha toccato dicono «cinque filtri applicati» quando non ne è
applicato nessuno, e `aria-pressed` raccontava all'assistente vocale l'inverso di ciò che l'Utente
crede di fare. Ora nessuna nasce accesa, le accese si sommano, e una sesta pastiglia — **«Tutti»** —
rende lo stato di partenza dichiarato invece che dedotto.

Il conteggio chiude la stessa riga perché dice esattamente ciò che le pastiglie decidono: quanti
volumi si stanno vedendo. Con un filtro attivo mette per primo il numero cambiato e tiene il totale
accanto per dare la scala («38 di 124»).

**3. L'intestazione dello scaffale.** Prima solo la fascia in cima portava la sua etichetta e le
mensole sotto non ne avevano nessuna visibile: due sezioni sorelle, una annunciata e una no. Ora
sotto «In lettura» c'è «Tutta la libreria».

**Niente cassetto.** Il disclosure "Chiedi alla libreria" teneva chiuse, in 13px di inchiostro
tenue e sopra il contenuto, le tre funzioni più caratteristiche dell'app: un contenitore intitolato
al meccanismo che lo riempie, cioè il posto in cui una funzione va a non essere trovata. Le tre sono
andate dove nasce il loro bisogno — ricerca per significato e temi in **Quaderni** (§5, §22),
suggerimenti in **«Aggiungi un libro»** (§13) — e la ricerca semantica resta comunque **fuori da
questo campo**, per la ragione di sempre: revocare il consenso lascerebbe l'Utente senza il modo di
trovare un libro.

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

**La barra del titolo.** Proprio perché in cima non c'è niente, fino a questa revisione il titolo da
44px usciva dallo schermo dopo un dito di scorrimento e **non tornava più**: da lì in poi l'unica
cosa a dire dove si fosse era la linguetta accesa in fondo, `.t-label` a 10,5px, al bordo opposto a
quello dove cade l'occhio. Era il difetto più grave delle testate, e non era nominato da nessuna
parte.

`.barra-titolo` è la risposta che iOS dà dal 2017 e dà ancora in iOS 26, e che Material 3 dà con lo
stesso gesto (large → small): il titolo grande orienta all'arrivo e si ritira quando si legge,
lasciando la parola in una riga alta `--tap`. Non è un componente nuovo — 15px, peso 600, centrato,
è esattamente la testata che la barra di un collegato monta già (§15).

Tre dettagli che non si indovinano:

- **`IntersectionObserver`, non un ascoltatore di `scroll`.** Non serve una proporzione: la barra c'è
  o non c'è, e l'incrocio fra le due lo fa `opacity` con `--dur-panel`. Un osservatore sta fermo
  finché il bordo non passa.
- **La soglia è 22px, cioè mezza barra, non 44.** Con 44 la barra comparirebbe a pagina ferma:
  `<main>` ha 12px di padding e un titolo da 44px con `text-box-trim` misura circa 31px di riquadro,
  quindi sta fra y=12 e y=43 — interamente sopra la linea dei 44.
- **La barra è `aria-hidden` e `pointer-events: none` quando è trasparente.** Ripete alla lettera
  l'`<h1>` che sta nel flusso, e a un lettore di schermo il titolo va detto una volta sola; senza la
  seconda, si mangerebbe i tocchi sui primi 44px di ogni pagina.

Il guadagno vero non è estetico: con l'orientamento garantito qui, **la prima schermata non deve più
pagare il titolo per averlo**. È la condizione che permette alla Libreria di restare senza (§7).

**Scaffale a più mensole:** volumi (§7) che vanno a capo su ripiani impacchettati sulla larghezza
reale, scorrimento verticale, tocco che apre. Il sollevamento non serve: il dito è già il
puntatore. Ogni mensola porta la sua ombra doppia, ed è la ripetizione delle ombre a dare la
profondità che su desktop dà il sollevamento.

**Tre volumi per mensola, non due.** Su 390px la colonna di contenuto è 358, e con i numeri del
desktop una mensola ne teneva due. Quattro misure cambiano — nessuna tocca il disegno del volume,
tutte stanno in `tokens.css`, e `shelf-pack.ts` le **legge** invece di ricopiarle:

- la tacca dell'autore passa a larghezza zero (§7, regola 6) e vale anche su desktop, dove
  guadagna trenta pixel a ogni cambio di iniziale;
- `--shelf-gap` scende di un passo della scala, da `--sp3` a `--sp2`;
- `--spine-max` passa da 28px a 14: la stessa `clamp` con un tetto più basso, esattamente come già
  fa la copertina — lo spessore continua a dire le pagine, su una scala compressa;
- `--cover-w` diventa `clamp(84px, (100vw − 88px) / 3, 96px)`, cioè si adatta perché tre volumi
  stiano in riga su **ogni** telefono e non solo su quelli da 390: a 390 dà i 96 di prima, a 360
  dà 90, sotto si ferma a 84.

Caso peggiore, tre mattoni da mille pagine: 3×96 + 3×14 + 2×8 = 346 su 358.

`--cover-w` è una `clamp()` e non si può leggere con `getPropertyValue`, che di una proprietà
personalizzata non registrata restituisce il testo della formula e non il risultato: lo scaffale
misura quindi una sonda alta zero e larga `var(--cover-w)`, ed è il browser stesso a dire quanto
sta applicando.

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
browser — e quando accompagna un pulsante prende il riquadro e la **sua stessa altezza** (§24): il
riquadro scritto a mano che c'era prima era alto 34 accanto a un pulsante da 44, e la riga non
aveva una linea di base.

### Zona 3, il giudizio

Voto, recensione e nota di intenzione stanno in una carta sola: sono tre modi di dire la stessa
cosa, cioè che cosa ne pensi.

Il voto resta 1–5 a scatti di mezza stella, con ogni stella divisa in due zone cliccabili e il
sollevamento al passaggio del mouse; un secondo clic sul valore già scelto lo cancella. Stelle
come tracciati SVG, non glifi di testo — un bersaglio di precisione va reso grande e disegnato
dall'app, non dal font di sistema. **La misura cambia col puntatore** (`--stella`, §24): 28px col
mouse, 40 sotto il dito. Con 28 ciascuna metà era larga 14px, ed era l'unico bersaglio dell'app
che nessuna regola poteva salvare — due bersagli dentro la larghezza di uno non si allargano
ciascuno per conto suo: si allarga ciò che li contiene.

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

**La vista trasversale non è più rinviata** (25 agosto 2026). Diceva "solo dentro la scheda del
libro", ed era vero quando gli insight non avevano un altro posto dove stare: ricerca semantica e
sintesi tematica producevano risultati che attraversavano più libri, ma erano pagine di risultati,
non una vista di navigazione. Ora quella vista esiste ed è **Quaderni** (§22), che i propri scritti
li contiene invece di limitarsi a interrogarli — sfogliabili per tipo, periodo e libro, senza
formulare una domanda e senza consenso.

Restano vere due cose che quella frase difendeva. Dentro la scheda gli insight restano **raggruppati
per lettura**, che è l'unico posto in cui quel raggruppamento significa qualcosa; e una carta dei
Quaderni mostra sempre **l'insight con accanto il libro da cui viene**, mai una riga di libro — il
testo è il contenuto, il libro è la provenienza.

**E si scrive anche da lì.** Un insight nasceva solo da `POST /voci/{id}/insight`, cioè solo dalla
scheda. Con una voce di navigazione intitolata alla materia, quella regola diceva che il quaderno
era l'unico quaderno in cui non si poteva scrivere. Da Quaderni si scrive scegliendo il libro, coi
libri in lettura proposti per primi — è il momento in cui si ha il libro in mano, e da lì alla
scheda ci sono quattro passi in cui il pensiero si perde. **La correzione invece resta sulla
scheda**, ed è deliberato: due superfici che modificano lo stesso testo devono restare d'accordo su
spoiler, visibilità e lettura di appartenenza, e dal titolo di una carta alla scheda c'è un clic.

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

**Due corsie in pagina, un mestiere solo.** Sopra il catalogo, per chi un titolo ce l'ha già;
sotto, separati da un filetto, i **suggerimenti di lettura** (§23) per chi non ce l'ha. Non sono
una seconda funzione appiccicata: il bisogno è lo stesso — voglio un libro nuovo — e prima
vivevano su una pagina orfana che si raggiungeva solo da un disclosure chiuso in mezzo ai filtri
della Libreria. Il consenso governa solo la seconda corsia; quando è spento la prima non se ne
accorge.

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

**La testata.** Il titolo è l'anno, e l'occhiello `ANNALI` sopra di esso c'è **sempre** — non più
solo sulla pagina di un collegato, dove era l'unica delle due versioni ad avere un nome. Un nudo
«2026» non dice di quale sezione sia il titolo; l'occhiello dà la parola, il numero la specificità,
e la barra del titolo (§8) scrive «Annali», non l'anno, perché il suo mestiere è dire dove si è.

**Il sottotitolo è caduto.** «L'anno raccontato dai numeri.» non spiegava un meccanismo — quello era
il difetto della riga che l'aveva preceduta — ma non diceva nulla che la pagina non mostrasse già:
l'insegna di sé stessa, cioè il riempitivo che il §19 vieta. La regola generale che ne esce vale
ovunque: **un sottotitolo esiste solo se dichiara un confine che la pagina non può mostrare.** Per
questo quello dei Quaderni resta — dice a chi appartengono i testi che si stanno guardando, una
regola di visibilità invisibile allo schermo — e nessun altro è stato aggiunto.

Stessi piani e stessa luce dello scaffale, in tono minore. I numeri in Inter Tight, tabulari,
allineati. Nessun trattamento tipografico speciale: l'espressività è riservata agli insight.

**Il titolo della pagina è l'anno.** Non la parola "Annali", che è già accesa nella barra di
navigazione due righe più sopra: un titolo che ripete l'indirizzo non nomina il contenuto. Il
contenuto è un anno, e sta in Fraunces a 56px con il selettore accanto.

**Tre pesi, non tre lastre uguali.** Il piano resta uno solo, `surface-1`: negli Annali non c'è
niente da afferrare, quindi non c'è niente da sollevare e non esiste un piano 2 in questa pagina.
Ma stesso piano non vuol dire stesso peso, e la gerarchia la fa la tipografia:

1. **L'anno**, a piena larghezza. Quattro numeri a 52px (libri finiti, pagine, giorni con
   lettura, voto medio) e sotto la forma dell'anno, cioè le pagine mese per mese.
2. **Chi e cosa**, due colonne da 1024px in su: autori più letti e generi.
3. **Voti e letture**, due colonne, numeri a 28px.

Tre gradini di dimensione del numero. Prima erano tre carte identiche per forma e larghezza, e la
pagina non aveva un primo elemento.

### Il limite di un numero si dice una volta, e con un numero dentro

La regola precedente ("ogni numero porta accanto il suo limite, in una riga piccola, sempre") aveva
l'intento giusto e l'esecuzione sbagliata: sotto "5.240" stavano diciotto parole di scuse, e
misurato in inchiostro il limite pesava più del dato che qualificava. Due cose distinte erano state
fuse in una riga sola.

- **L'unità** ("pagine lette", "di cui 2 riletture") dice cosa si sta guardando: resta attaccata al
  numero, sempre, e non porta spiegazioni.
- **Il limite** è una proprietà del conteggio, non della cifra: esce dal flusso della carta e va in
  una **chiosa**, cioè un riquadro che si apre da un punto interrogativo accanto al titolo
  ("Autori più letti (?)"), **una sola per carta**. Cinque carte con cinque righe di prosa in coda
  facevano di questa pagina metà numeri e metà note a piè di pagina, e una spiegazione che non
  cambia mai da un anno all'altro non merita di occupare spazio a ogni visita. Il punto
  interrogativo dice che c'è qualcosa da sapere; il testo si legge quando serve saperlo.

La chiosa è un **glifo tipografico, non un'icona**: l'app non ha un vocabolario di icone e non è
questo il posto per aprirne uno (§5). Non è nemmeno un quarto canale di messaggi: i tre canali
portano l'esito di qualcosa che è appena successo, questa porta un'annotazione su un dato, sempre
vera e sempre la stessa. Si apre al passaggio del mouse, al clic e al tocco, prende il fuoco da
tastiera e si chiude con Escape (`ui/chiosa.tsx`, Base UI `Popover`): un riquadro che si aprisse
solo in hover sarebbe invisibile da tastiera e irraggiungibile su un telefono, dove `mouseleave`
non arriva mai.

E il limite smette di essere perpetuo. "La somma non è mai completa" era vero per costruzione, quindi
non diceva nulla di questo anno; `libri_senza_pagine` lo rende un fatto contabile ("3 dei 17 libri
finiti non hanno un conteggio di pagine adottato"), e quando vale zero **la frase sparisce**, perché
la somma è davvero completa. Una disclaimer che c'è sempre non si legge più dalla seconda visita;
una frase che nomina tre libri sì. È più onesto, non meno. Vale identico per il denominatore del
voto medio e per lo scarto dei generi.

### Le metriche

Dieci, tutte ricalcolate a ogni richiesta (ADR 0004) e tutte ricavate dalle stesse tre letture di
`lettura`, `avanzamento` e `voce_di_libreria`: nessuna tabella nuova, nessuna query in più.

| | Cosa dice |
|---|---|
| Libri finiti, di cui riletture | Solo esito "conclusa". L'unità è la Lettura, non il Libro |
| Pagine lette | Somma degli incrementi datati nell'anno, mai delle pagine raggiunte |
| Pagine mese per mese | La forma dell'anno: dodici barre in `accent`, etichetta solo sul mese più alto |
| Giorni con lettura, su quelli trascorsi | L'abitudine, non il volume. Un incremento nullo non fa un giorno |
| Voto medio, e la distribuzione a cinque colonne | L'unica dimensione di giudizio. Un voto per Voce, non per Lettura |
| Autori più letti | Cinque voci con "mostra tutti", barre in `accent` |
| Generi | A ciambella, un solo accento a passi di opacità |
| Abbandoni | Fuori dai libri finiti (regola 13), dentro le pagine |
| Durata media di una lettura, e la più lunga | Estremi inclusi: una lettura aperta e chiusa in giornata dura un giorno |
| Libri senza genere, libri senza pagine adottate | Gli scarti, dichiarati nella chiosa e non nascosti |

Restano **fuori per scelta, non per dimenticanza**: i giorni consecutivi, perché una serie da
difendere trasforma un registro in un dovere e il primo giorno saltato in un fallimento, in un
prodotto che non ha né notifiche né obiettivo annuale; l'obiettivo annuale stesso; mood e pace
dichiarati a mano, perché quel giudizio qui è testo (insight e recensione), non caselle. Restano
fuori **perché non calcolabili**: lunghezza media e libro più lungo, dato che non esiste un conteggio
pagine canonico sul Libro ma solo `pagine_adottate` sulla Voce (ADR 0003), e una media su un
sottoinsieme autoselezionato sarebbe un numero falso con l'aria di essere vero; tempo e velocità di
lettura, che richiederebbero un cronometro. Resta **rimandata** la metrica sull'anno di prima
pubblicazione: il dato c'è, ma il PRD dice che anno e lingua non alimentano metriche in questa
versione, e una parte di quegli anni è dedotta dal modello e non di fonte.

### Il selettore d'anno

**Una finestra di tre anni, non tutti e non due frecce sole.** Due chevron e un numero usavano
dell'intervallo dichiarato dal backend solo il permesso di disabilitare un pulsante. Mostrarli
tutti capovolgeva il problema: a otto anni la riga occupava metà intestazione per una navigazione
che si usa di rado, e la sua larghezza cambiava di anno in anno man mano che l'intervallo cresce.

La finestra è di tre: l'anno scelto e i suoi due vicini, centrata finché può e appoggiata a un
estremo quando non può, così agli estremi si vedono comunque tre anni e non uno. Larghezza
costante. I vicini bastano a dire che l'anno sta dentro una serie; dove comincia la serie lo dice
una riga sotto, "dal 2019", che compare solo quando c'è davvero dell'altro dietro la finestra. Il
numero grande dell'intestazione dice già quale anno si guarda, quindi qui non va ripetuto in
grande. L'anno attivo si segnala con inchiostro pieno e filetto, il linguaggio della voce di
navigazione attiva (§5), mai un riempimento. Anni futuri non selezionabili; un anno intermedio
senza letture mostra zeri, non un errore.

### Le classifiche

Autori: cinque voci con "mostra tutti e N", barre in `accent`, mai una scala di colori diversi per
voce, perché sono la stessa grandezza misurata su soggetti diversi. Il binario della barra è
l'inchiostro del tema con alpha: `surface-2` su una carta `surface-1` sono 0,985 contro 0,965 di
luminanza, cioè un binario invisibile, e una barra corta non si distingue da una barra assente.
Sotto i 640px il nome sale sopra la barra: a 390px una colonna nome fissa lascerebbe alla barra meno
di 90px.

Generi: stesso principio ma a ciambella, perché il part-to-whole si legge meglio come porzione di un
intero. Un solo accento, non una tavolozza: gli spicchi sono la stessa tinta a passi di opacità
decrescenti, lo spicchio "non classificato" è neutro (`surface-2`), al più cinque spicchi con peso
proprio oltre i quali si ripiegano in "Altri generi". **Nessun numero scritto dentro gli spicchi:**
a 9px stava sotto il minimo tipografico di `.t-label`, e `on-accent` su `accent-strong` pieno crolla
a 2,9:1 di giorno. I pesi stanno nella legenda, dove si leggono.

*Questa scelta resta la più discutibile della pagina, ed è dichiarata come tale: l'intero della
ciambella non è intero, perché i pesi sono frazionari e i libri senza genere entrano come spicchio
pur essendo dichiarati fuori dalla classifica. Le barre direbbero la stessa cosa con una grammatica
sola per due classifiche. Se si cambia idea, cambia il contenuto di una carta su cinque e nient'altro.*

### La divergenza a cavallo d'anno

Compare solo quando in quell'anno esiste almeno una lettura che attraversa il capodanno: il libro
conta nell'anno di chiusura mentre le pagine restano divise fra i due anni secondo quando sono state
segnate. **La frase concorda col numero**, perché il servizio manda il conteggio e non solo il flag:
era al singolare fisso, e con due letture a cavallo diceva il falso.

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

**Scheda Annali del collegato.** Le sue metriche di lettura, calcolate sui suoi dati: le stesse
carte della propria vista Annali (§14), più i libri letti in comune con i voti affiancati.

Che non sia casa tua lo dicono **quattro segnali**, e nessuno di loro è un avviso: la barra globale
sparita e sostituita da "‹ Lettori" con nome e iniziali; la stanza raffreddata da `[data-guest]`, che
porta `accent` e `accent-strong` a `ink-soft` e quindi rende grigie barre e ciambella; sopra l'anno
una micro-etichetta, "ANNALI DI <nome>", che sulla propria pagina non esiste mai; e la terza persona
nelle carte ("come li **ha** votati", "le pagine che **ha** segnato a mano"). Il terzo serve da
quando il titolo di pagina è l'anno: senza, la sua pagina si aprirebbe con lo stesso numero della tua.

**L'affiancamento è una riga, non una carta.** Due carte pari affiancate *sono* un confronto, e qui
il confronto è vietato: con quattro numeri e un profilo mensile per carta sarebbe diventata una gara
anche visiva, un grafico accanto a un grafico. I tuoi quattro numeri restano tutti, in una riga sola
di terzo peso sotto la sua carta, senza percentuali e senza "più" o "meno". Resta grigia come il
resto: metterci il tuo ottone romperebbe la lampada di un altro per un contrasto che non serve.

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

**Qui vive l'intero ciclo di vita di un collegamento**, dalla richiesta all'interruzione. Prima
accettare, rifiutare, ritirare e interrompere si facevano nella Torre, e qui una richiesta in
attesa era testo inerte con una riga che rimandava altrove: la stessa relazione in due pagine, e
quella in cui compariva la persona era l'unica che non poteva agire. Il contatore rosso non era
una funzione, era la toppa che serviva a portare l'Utente nell'altra pagina.

Qui non c'è scaffale e non ci sono oggetti: sono persone, non volumi. Carte lunghe sul piano 1,
righe separate da filetti, iniziali in Fraunces. Nessuna immagine di profilo, che il PRD non
prevede — e su un'istanza aperta sarebbe anche la prima cosa da moderare.

### La ricerca, non l'ordine delle sezioni

L'elenco faceva due mestieri con frequenze opposte — andare da qualcuno con cui sei già collegato,
quotidiano, e trovare qualcuno da chiedere, raro — e la risposta era stata **due carte**, "i tuoi
collegamenti" e "altri membri". Il ragionamento era giusto, la soluzione risolveva l'ORDINE e non
il TROVARE: per chiedere un collegamento bisognava scorrere oltre tutti i collegati, e più
collegamenti si avevano più lontano finiva il gesto raro. Con l'istanza aperta (PRD, *Elenco dei
membri*) quella lista non finisce nemmeno.

**Un campo di ricerca in cima, che raggiunge chiunque.** Si digita il nome e si agisce sulla riga
dov'è: che la persona sia il terzo collegato o il novantesimo iscritto non cambia nulla. È la
ricerca, e non la disposizione delle sezioni, a reggere un elenco che non ha fine. Sotto le due
lettere non parte alcuna interrogazione: una lettera sola restituirebbe una fetta arbitraria
dell'anagrafica a ogni battuta, che è enumerazione travestita da ricerca.

**Nessun conteggio dei membri accanto al titolo.** Il numero dei collegati sì — è un dato
dell'Utente — ma quanti siano gli iscritti no, e il backend non lo calcola nemmeno.

### Tre sezioni, in ordine di urgenza

1. **Ti hanno chiesto il collegamento** — l'unica cosa con una scadenza sociale, e l'unica per cui
   esiste il contatore. Righe con "Accetta" e "Rifiuta", non più testo inerte. Quando non ce n'è,
   la sezione sparisce insieme al contatore: il caso normale non si annuncia, e un "Nessuna
   richiesta ricevuta." che occupa una riga è rumore.
2. **I tuoi collegamenti** — pura navigazione: iniziali, nome, un chevron, l'intera riga è il link
   verso la sua libreria (§15). Nessuno stato scritto accanto, perché essere nell'elenco è già lo
   stato, e nessun comando distruttivo a un dito dal gesto quotidiano.
3. **Altri lettori** — chi non ha ancora una relazione, con in cima le richieste inviate
   ("Richiesta inviata" più "Ritira"). Una richiesta inviata non è un altro tipo di persona, è la
   stessa persona in un altro stato, e servirla in una sezione sua costringerebbe a una quarta
   sezione per due righe. Senza ricerca questa sezione è una fetta breve degli ultimi arrivati,
   non l'anagrafica, e una riga sotto lo dice.

Una sezione vuota non mostra la sua carta. Non esiste alcun rimando a un'altra pagina: tutto ciò
che si può fare a una persona si fa sulla sua riga.

### Interrompere un collegamento

**Sta dietro "Modifica"**, sull'intestazione dell'elenco: il comando compare al posto del chevron,
e solo sulle righe di chi è collegato. Fuori da quella modalità la riga resta pura navigazione.

La ragione è la reversibilità asimmetrica: si interrompe da soli, ma per tornare indietro serve
che l'altro accetti una nuova richiesta. Un gesto così non sta a un dito di distanza da quello che
si fa ogni giorno — entrare in una libreria — e "Modifica" è la distanza giusta: un tocco in più,
visibile, dove stanno le persone, senza scorrere nulla.

*Due posti scartati, per memoria.* In fondo alla pagina del collegato, come iOS fa nei Contatti:
quella scheda è corta, una libreria può essere di centinaia di volumi, e in fondo a un elenco così
il comando non lo trova nessuno. E sempre visibile sulla riga: a un tocco dalla navigazione
quotidiana, sul telefono, è un errore che aspetta di accadere. Restando fuori dalla pagina del
collegato, quella pagina torna anche ad avere **zero pulsanti**, come §15 prescrive.

**Azione immediata, senza dialogo di conferma, con un annulla che resta sei secondi.** La DELETE
parte solo allo scadere della finestra: fino a lì la riga si spegne e mostra "Annulla".

**Il rifiuto non lascia traccia.** Chi ha chiesto vede la relazione tornare ad assente,
indistinguibile da chi non ha mai chiesto, e la richiesta è reinviabile. Sull'assenza di un blocco
e sul perché oggi sia una lacuna dichiarata e non una scelta, vedi PRD (*Collegamento tra utenti*)
e `docs/lavoro-rimandato.md`.

---

## 17. Profilo

**Si chiamava Torre, e conteneva anche i collegamenti.** Quelli sono passati a Lettori (§16); il
nome è cambiato per le ragioni in §5. Non è più una voce di barra: ci si arriva dalle proprie
iniziali.

Una superficie sola, sei sezioni, in un ordine che è un racconto da sé verso l'esterno e poi
fuori: **il tuo account** (nome utente ed "Esci"), **chi vede cosa**, **la luce della stanza**,
**il consenso all'elaborazione assistita**, **l'esportazione dei libri letti**, **la cancellazione
dell'account**.

"Il tuo account" era una didascalia sopra l'elenco dei collegamenti ("Sei entrato come …"); ora
che la pagina è del solo account è la prima sezione e ha il peso di una riga vera. La luce viene
prima delle tre che riguardano i dati perché è la sola che non li riguarda: cambia come si vede
l'app, non cosa l'app fa dei tuoi testi.

**I due testi lunghi sono quelli del PRD, parola per parola.** L'avviso di visibilità e il testo
del consenso non vanno riscritti in forma più breve.

### Il comando prima del testo

La sezione del consenso metteva l'informativa — trecentosettanta battute — davanti
all'interruttore, con altri tre paragrafi sotto: per sapere se il consenso fosse acceso bisognava
leggere un muro. Ora l'ordine dentro la carta è quello in cui serve: **cos'è** ("Attiva" /
"Spenta"), **com'è messo adesso** (la riga di stato reale sugli indici), l'interruttore, un
filetto, e **poi** il testo del PRD per intero. Non una parola in meno: solo non più di traverso
al comando.

Un paragrafo è stato tolto perché era un doppione, non per accorciare: "le cinque funzioni
assistite si spengono e gli indici di ricerca costruiti sui tuoi testi vengono cancellati" è già
l'ultima frase del testo del PRD, due righe sopra nella stessa carta. Ne resta la sola metà che
aggiungeva qualcosa, ed è la più rassicurante: i pareri e le sintesi già generati restano.

Sotto, una riga sulle note di intenzione: non escono mai, in nessuno stato del consenso.

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

**Una zona di pericolo**, come nella maggior parte dei prodotti: ultima della pagina, staccata da
ciò che precede con un filetto e dello spazio, e raccolta in una carta il cui bordo è in `alert`.
È il secondo e ultimo uso del rosso in tutta l'app (§3). Non è decorazione: la separazione e il
bordo sono ciò che distingue un'azione irreversibile da una preferenza, e prima questa sezione era
indistinguibile da "esporta i libri letti".

**Il rosso sta sul bordo, non sul testo, e non sul pulsante.** Sul testo non può stare per una
ragione misurata: `alert` su `surface-1` tiene 4.57:1 nel punto peggiore dell'anno, sette
centesimi sopra la soglia AA del corpo. Sul pulsante non sta perché non servirebbe a niente: la
difficoltà sta dove deve stare, cioè nel dover **scrivere il proprio nome utente**, e il pulsante
resta spento finché non coincide. Un pulsante rosso non ha mai fermato nessuno che non fosse già
stato fermato da quello.

*Diceva il contrario, e vale la pena dire perché è cambiato.* La regola era "non è un pulsante
rosso… il rosso, in quest'app, vuol dire una cosa sola, ed è il contatore delle richieste", e il
suo argomento — un'azione che richiede di digitare il proprio nome è già difficile da compiere per
errore — resta vero e infatti il pulsante è rimasto piano. Quello che l'argomento non copriva è la
**reperibilità**: la difficoltà di eseguirla non è la stessa cosa del riconoscerla mentre si scorre
la pagina. La zona risolve il secondo problema senza toccare il primo.

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

**Nessun trattino lungo nei testi che scrive il modello.** Né la lineetta em (—) né quella en
(–), in nessun punto di una descrizione di libro, di una preview, di una sintesi tematica o di
una motivazione di suggerimento: al loro posto una virgola, un punto, o una frase costruita in
modo da non averne bisogno. Due ragioni, e la prima basterebbe da sola: è il segno di
interpunzione con cui si riconosce a colpo d'occhio una prosa scritta da un modello, e un testo
che l'app già dichiara come generato non ha bisogno di annunciarlo anche nella punteggiatura.
La seconda è che in italiano l'inciso fra lineette appartiene alla prosa letteraria, e questi
sono testi di catalogo e pareri, non racconti. Il trattino breve (-) resta ammesso: è un altro
segno, e serve nelle parole composte.

La regola vale per l'**output del modello**, non per l'interfaccia scritta a mano né per questo
documento, dove la lineetta è di casa. Vive in tre punti che si tengono insieme: la costante
`REGOLA_TRATTINI_PER_IL_MODELLO` in `app/core/testo.py`, che ogni prompt include invece di
riscriverla; il controllo in `app/services/testo_generato.py`, che rifiuta il testo e ne chiede
un altro (mai lo aggiusta: un testo riparato verrebbe firmato come se il modello l'avesse
scritto così); e `tests/test_prompt_trattini.py`, che impedisce a un prompt nuovo di
contraddirla usando lineette nelle proprie istruzioni — che è esattamente com'era nato il
difetto, con la regola presente in uno solo dei sei prompt.

**Il registro dei testi che scrive il modello.** I prompt vincolavano i fatti, la lunghezza e la
punteggiatura, e non dicevano nulla sulla lingua: "neutro, informativo, mai promozionale" nomina
il difetto ma non lo fa riconoscere, e un modello che non sa quali frasi siano di mestiere le
scrive lo stesso. `REGOLA_STILE_PER_IL_MODELLO` (`app/core/testo.py`, accanto a quella dei
trattini) vieta per nome le formule da quarta di copertina — capolavoro, imperdibile, avvincente,
indimenticabile, magistrale, un viaggio dentro qualcosa, una riflessione profonda, ti terrà
incollato alle pagine — insieme alle domande retoriche, alle esclamazioni e all'aggettivo che non
dice nulla che il sostantivo non dica già; e chiede il concreto invece dell'astratto, il verbo
invece della nominalizzazione, e frasi di lunghezza diversa invece di tre uguali in fila. Un
elenco di parole e non un aggettivo sul tono: è l'unica forma di questa regola che si possa
davvero rispettare. Il pubblico è la ragione — chi tiene un registro delle proprie letture
distingue un testo scritto da uno assemblato, e una descrizione che scivola nella quarta di
copertina squalifica la scheda intera.

Vale per i **cinque prompt che producono prosa da leggere**: le due standardizzazioni di
descrizione, il parere, i temi, i suggerimenti. Resta fuori la traduzione, che deve restare fedele
anche a un originale scritto male, e restano fuori le classificazioni, che non producono prosa. La
regola non usa virgolette di alcun tipo, perché il prompt del parere le vieta nell'output:
mostrargliene una sarebbe lo stesso difetto del trattino lungo scritto dentro la regola che lo
vietava. `tests/test_prompt_trattini.py` verifica entrambe le cose, e che nessuno dei cinque
prompt perda la regola per strada.

**Due voci, non una.** La regola di stile dice come *non* si scrive; la voce dice a chi si parla, e
non può essere la stessa per tutti e cinque. `VOCE_PERSONALE` (parere, temi, suggerimenti) dà del
tu, vieta i convenevoli e l'entusiasmo pubblicitario, e proibisce il preambolo — senza, un modello
apre con «Ecco cinque proposte per te» e chiude con «Buona lettura», due righe che nessuno ha
chiesto. `VOCE_CATALOGO` (le due standardizzazioni di descrizione) tiene la terza persona, non si
rivolge mai a chi legge e non dà giudizi di valore: **una descrizione è dato condiviso**, la stessa
riga la leggono tutti, e dandole del tu direbbe a ogni lettore una cosa che vale per un altro.

Il confine fra le due coincide con quello fra `llm.py` e `llm_personale.py`, che esiste per la
regola 19 del PRD (docs/adr/0018) — cioè per vedere a colpo d'occhio quali funzioni inviano
contenuti di un Utente. Non è una coincidenza: è personale ciò che è rivolto a qualcuno.

Perché sono costanti e non frasi nei prompt: `genera_suggerimenti` **non stabiliva alcuna voce**,
pur producendo la prosa più lunga che l'app mostri (cinque motivazioni di tre o quattro frasi), e
gli altri due la scrivevano a mano in due forme già divergenti — «senza convenevoli e senza
entusiasmo pubblicitario» nel parere, «senza convenevoli» nei temi. La stessa deriva del trattino
lungo, presente in uno solo dei sei prompt.

**La forma di un errore: il soggetto è la cosa, e segue il passo successivo.**

> "La recensione non è stata salvata. Il testo è ancora qui."

Dove il testo dell'Utente è ancora nel campo, il messaggio lo dice: è l'informazione che più
serve a chi ha appena scritto trecento parole. Nessun termine tecnico interno arriva fino allo
schermo, e nessun titolo generico ("Qualcosa è andato storto") compare sopra un errore senza
aggiungere nulla.

**Due frasi, e ciascuna la sa un posto diverso.** Questa forma non è una raccomandazione di
stile: è la struttura con cui i messaggi sono costruiti. La prima frase dice cosa non è
successo, e la sa soltanto il chiamante — `lib/api` non sa se stava salvando una recensione o
correggendo un totale di pagine. La seconda dice cosa fare, e la sa soltanto il trasporto —
il componente non sa se è caduta la rete, se il server ha risposto 500 o se è scattato il
limitatore. Per questo `lib/api` **classifica e non scrive**: restituisce un `ErroreApi` con un
genere, e la frase si compone da due voci del catalogo.

| genere | seconda frase |
|---|---|
| `rete` | "Controlla la connessione e riprova." |
| `server` | "Riprova fra poco." |
| `configurazione` | "Parla con chi mantiene l'istanza." |
| `sessione` | "La sessione è scaduta: ricarica la pagina." |
| `limite` | "Aspetta qualche secondo e riprova." |
| `assenza`, `regola` | nessuna: la frase è intera e viene da `assenze.*`/`regole.*` |

Dove esiste una **rassicurazione** ("Il testo è ancora qui."), quella prende il posto del
rimedio invece di aggiungersi: tre frasi in un toast sono un paragrafo, e a chi ha appena
scritto importa più sapere che nulla è andato perso che sentirsi dire di riprovare. La scelta
sta nel catalogo (`rassicurazioni.*`) e non in un elenco nel codice, perché è una decisione di
scrittura.

Un'assenza e una regola saltano la composizione: nominano una causa precisa che il dominio non
conosce ("Questo libro non è più nella tua libreria", "Il nuovo totale è inferiore a un
avanzamento già registrato"). Comporre lì darebbe "Lo stato non è cambiato. Riprova fra poco."
su un 409, cioè un invito a ripetere all'infinito una cosa che la regola vieta.

Il difetto che questa struttura chiude, e che vale la pena non rifare: le frasi stavano dentro
i fetcher, tre stringhe per novantatré punti, tutte con il server per soggetto e nessuna nel
catalogo bilingue. Con `Accept-Language: en` un errore di rete durante un voto si leggeva in
italiano.

**Una voce sola per l'attesa.** La prima persona vale solo dove l'app sta davvero lavorando per
te, quasi sempre con il modello ("Ci penso…", "Cerco temi…"); altrove nessuna etichetta, perché
uno scheletro con la forma del contenuto dice già cosa sta arrivando.

**L'apostrofo è quello tipografico (`’`), mai quello dritto** — anche nelle frasi che scrive il
backend, che sono testi d'interfaccia come gli altri. Le stringhe vivono in
`frontend/messages/it.json`/`en.json`, il catalogo `next-intl` dell'interfaccia bilingue, e
`npm run check:messaggi` verifica in CI che catalogo e codice non divergano: nessuna chiave usata
e assente, nessuna presente e mai usata, nessun `error_code` del backend senza una frase, le due
lingue in parità.

**Tre canali.**

| Canale | Quando | Dove |
|---|---|---|
| **In linea** (`ui/messaggio.tsx`) | il caso normale: il comando è ancora sotto gli occhi | accanto al comando, `aria-live="polite"` |
| **Toast** (`providers/toast-provider.tsx`) | il bersaglio può essere già scorso via, o la scrittura è ottimistica e l'errore arriva dopo che l'interfaccia si è mossa | in fondo alla pagina, `role="alert"`, con "Riprova" dove riprovare può funzionare |
| **`ErrorState` / `EmptyState`** | fallisce o è vuota una regione intera | al posto della regione |

Un toast in fondo alla pagina non dice a quale riga di un elenco si riferisce: è la ragione per
cui il primo canale è il predefinito e il secondo l'eccezione. Vale anche il rovescio: quando il
toast è il canale giusto, il bersaglio non è più sotto gli occhi, e allora il rimedio deve stare
nel toast — "Riprova" accanto al messaggio, non un invito a ritrovare da soli la riga che si era
toccata. Si offre solo dove può riuscire (`riprovabile()`): mai su una regola, un'assenza o una
sessione scaduta, che hanno rimedi propri e diversi.

**In una riga di elenco il messaggio sta sotto la riga, non accanto al comando.** Messo nella
colonna del comando — che non cede, `shrink-0` — il suo testo schiaccia la colonna del titolo
finché questa non si tronca: in `ricerca/riga-risultato.tsx` "Un indovino mi disse / Tiziano
Terzani" si riduceva a "U / T.". La riga resta intatta e il messaggio le sta sotto, a tutta
larghezza. Nessun modale, nessun avviso che
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

## 22. Quaderni

**Una voce di navigazione (§5), non tre pagine dietro un cassetto.** Fino ad agosto 2026 la
ricerca semantica stava su `/cerca` e la sintesi tematica su `/sintesi`: due pagine con lo stesso
identico impianto — titolo, paragrafo di spiegazione, un comando, un elenco — che nascevano
entrambe vuote e si raggiungevano solo da un disclosure chiuso in mezzo ai filtri della Libreria.
Non sono due funzioni diverse: sono la stessa materia — ciò che hai scritto — interrogata oppure
vista da lontano. Da qui la fusione.

Quel lavoro era di **collocazione**: tre pagine orfane sono diventate raggiungibili. Non aveva
toccato cosa succede dentro Quaderni una volta arrivati, che restava il minimo indispensabile — un
campo, e sotto o i temi o i risultati di una domanda. Il ridisegno del **25 agosto 2026** riprende
in mano il contenuto.

### Il difetto da cui si parte

La pagina non conteneva nulla di proprio. Aveva un campo che interrogava i propri scritti e una
sintesi che li riassumeva; gli scritti veri vivevano solo dentro la scheda del libro. Era
un'interfaccia al modello con un nome da luogo, e si vedeva da tre cose:

- **a consenso revocato era due stati vuoti**, mentre §5 prometteva l'opposto ("i propri scritti
  esistono anche a consenso revocato, ed è solo il modo di interrogarli che si spegne"). Non era
  una svista di implementazione: la pagina non aveva gli scritti da mostrare;
- **le due regioni non si toccavano mai.** Si alternavano in un ternario, e un tema apriva i propri
  insight dentro la propria carta — cioè un elenco di scritti dentro una carta dentro un elenco di
  carte, mentre la pagina intorno non conteneva gli scritti affatto;
- **nessun gesto era gratuito.** Le uniche due cose che si potevano fare passavano entrambe dal
  fornitore, mentre la Libreria ne ha due che non costano niente (§7).

### Un corpus, tre lenti

Il modello non è più "due regioni che si alternano". **La pagina contiene ciò che hai scritto,
sempre**, e le lenti ne cambiano ordine e selezione, non l'esistenza.

| Lente | Cosa fa alla regione | Costo | Consenso |
|---|---|---|---|
| **Sfoglia** (a riposo) | dal più recente | zero | funziona spento |
| **Chiedi** | riordina per vicinanza a una domanda | un embedding | serve |
| **Tema** | restringe agli scritti che lo sostengono | zero | serve per generarlo |

Da qui tre conseguenze. C'è **una sola sorgente di carte**: i risultati di una domanda e la vista
sfogliata sono lo stesso componente, e se le due forme divergessero divergerebbero anche i due
elenchi. I **filtri valgono per tutte e tre le lenti** allo stesso modo. E non esiste più un ramo
in cui la pagina mostra un riquadro al posto del contenuto.

### Lo slot sollevato in cima

Un posto solo, sopra i comandi, che tiene due cose che non coesistono mai.

**A riposo, il pensiero che torna**: un proprio scritto di almeno due mesi fa, ripescato, uno al
giorno. È il gesto che Readwise ha costruito in grande — la ripresentazione — applicato alla
materia che qui è propria: non una citazione di un autore, ma una frase che hai scritto tu, e che
aprendo la pagina ti ritrovi davanti senza aver chiesto niente. È anche la schermata che vende
l'app da sola, ed è **piano 2** e non piano 1: non è una riga dell'elenco capitata in cima, è una
cosa che ti viene messa davanti. Il salto di piano è l'unica differenza — corpo, carattere e misura
restano quelli di un insight qualsiasi, perché §10 non ammette una terza misura tipografica decisa
da chi scrive la pagina.

**Tetto di quattro righe**, poi "Mostra tutto". Quattro è la misura sotto cui una sentenza non si
tronca mai (§10: sotto le ~200 battute sta in tre righe e mezza), quindi il comando compare solo
quando il pensiero è davvero un appunto lungo — e la carta resta sotto i ~230px, cioè si legge in un
colpo d'occhio e si scavalca con la stessa facilità se non se ne ha voglia. Il comando compare solo
se la troncatura ha morso davvero, il che si misura: il CSS non lo dice a nessuno.

**Nessuna tabella di stato.** La scelta è deterministica sul giorno — hash dell'utente più la data
di Europa centrale — quindi resta ferma per ventiquattr'ore da sé. Una riga che registri cosa è già
uscito andrebbe mantenuta, cancellata insieme all'account e ricostruita alla revoca del consenso:
tre obblighi in cambio di una rotazione un po' meno prevedibile. "Mostrane un altro" copre il caso
in cui se ne voglia un altro senza aspettare domani. **Non dipende dal consenso**: è una riga già
scritta, ripescata, e nessun testo esce verso il fornitore.

**Mentre si scrive, lo stesso slot diventa il foglio.** Piano 1, la carta su cui si scrive — la
differenza di piano è la differenza fra un oggetto che ti viene porto e una superficie su cui
agisci. Non due blocchi che si sommano: chi sta scrivendo non ha bisogno di un vecchio pensiero
sopra le mani. Per la stessa ragione lo slot sparisce del tutto quando una lente è accesa: chi ha
appena posto una domanda non lo vuole sopra la risposta.

### La carta di uno scritto

Prima il titolo e l'autore in `t-meta` come collegamento alla scheda, poi il testo nel suo
trattamento tipografico normale (sentenza a misura stretta o appunto alla misura piena, §10), poi
il piede.

**Due colonne su desktop, non una riga per scritto.** A una colonna sulla larghezza piena una
sentenza in Literata a 19px correrebbe su novanta caratteri, il doppio della misura che §10 le
assegna, e l'elenco leggerebbe come un registro. A due colonne ogni carta sta sui 470px e la pagina
legge come un quaderno: molti frammenti scandibili invece di poche righe lunghe. Griglia e non
colonne CSS, che scorrerebbero in basso lungo la prima colonna e poi ripartirebbero dall'alto —
su un elenco cronologico significa leggere "dal più recente" due volte.

**Nel piede un dato, non un comando ripetuto.** Il piede porta «3 vicini», non «Vicini a questo».
Su venti carte, venti pulsanti identici sono rumore che l'occhio impara a saltare; un numero è
informazione, e dice già di per sé che quel pensiero ha compagnia. Le carte senza vicini non
mostrano nulla, quindi la riga non compare venti volte su venti. A indici spenti non compare mai:
uno `0` affermerebbe che quel pensiero non ha compagnia, cosa che in quel momento nessuno sa.

**Aprendo i vicini la carta prende tutta la riga.** Ciò che esce è la coda di quel pensiero, non un
secondo elenco che gli sta accanto, e a mezza colonna si leggerebbe come tale.

**Uno spoiler compare in chiaro**, a differenza di ogni altro elenco: la regola 10 protegge da uno
spoiler *altrui*, e qui ogni riga è già del richiedente (verificato lato server). Il contrassegno
resta accanto a data e tipo, **insieme al lucchetto di "solo tuo"**: §10 vuole entrambi scanditi
dall'occhio e non dedotti aprendo qualcosa, e prima usciva solo lo spoiler — la stessa carta
mostrava un segno su due.

### I vicini

Da ogni carta, i propri scritti semanticamente più vicini a quello. È la funzione più
caratteristica della pagina e la più economica che abbia: **nessuna chiamata al fornitore**. La
ricerca deve prima far calcolare l'embedding della domanda, perché la domanda è appena stata
digitata; qui il vettore di partenza è già in tabella, scritto quando l'insight è stato salvato.
Resta solo il confronto vettoriale, locale al database.

Dipende comunque dal consenso, ma per una ragione da non confondere col costo: la revoca cancella
gli indici, quindi non resta niente da confrontare. Stessa soglia di distanza della ricerca, e
stessa ragione: senza un tetto ogni scritto avrebbe sempre i suoi N più vicini, per quanto lontani
siano in assoluto, e "vicino" smetterebbe di voler dire qualcosa.

### La ricerca

**Non cerca mentre si digita**, a differenza del filtro dello scaffale e della ricerca sui
cataloghi (§13). Ogni interrogazione costa una chiamata al fornitore, e una domanda in linguaggio
naturale si finisce di scrivere prima di volerla porre. Cambiare un filtro mentre una domanda è
attiva invece **rifà** la ricerca, ed è voluto: il filtro deve restringere il risultato, non
l'elenco già tagliato.

**I risultati passano un filtro di pertinenza minima**, non solo un limite di quantità:
`cerca_semantico` scarta chi è oltre una certa distanza dalla domanda, invece di riempire sempre
fino a un tetto fisso. Senza quel filtro, una libreria piccola restituirebbe sempre tutto ciò che
ha, semplicemente riordinato. La soglia è tarata sui dati e resta rivedibile in un punto solo
(commento sulla RPC, `supabase/migrations/`).

#### I tre stati che non vanno confusi

| Stato | Cosa si mostra |
|---|---|
| Nessuna corrispondenza | "Non hai ancora scritto nulla che somigli a questa domanda." |
| Consenso revocato | La riga che dichiara la funzione spenta, al posto del campo |
| Indici in ricostruzione | I risultati che ci sono, più una riga che dichiara che sono incompleti |

Un elenco vuoto direbbe la cosa falsa più credibile che esista — che non hai scritto nulla al
riguardo — quindi il caso "consenso revocato" va dichiarato esplicitamente. Lo stesso per gli
indici incompleti: la riga sta sopra i risultati, non sotto, perché chi legge un elenco corto
deve sapere perché è corto prima di concludere che è tutto.

Nessuno dei tre è un errore, e nessuno dei tre è un riquadro rosso: sono testo, come ogni altro
messaggio dell'app (§19).

### I filtri, gratuiti

Tipo (insight o recensioni), spoiler, anno, libro. **Stesso registro delle pastiglie di stato dello
scaffale** (§7), e non per simmetria estetica: dicono la stessa cosa — un modo in più di guardare la
stessa materia, senza chiamare nessuno. Vestiti identici, comprese le due classi di stato: una
pastiglia accesa è inchiostro al 9% senza bordo, mai un riempimento colorato.

**"Tutti" è uno stato dichiarato**, non dedotto, come sullo scaffale. Il tipo però è a **scelta
singola** e non additivo: insight e recensioni sono due sole voci, e "insight + recensioni" è già
"Tutti" — tre pastiglie che si sommano fino a ricomporre la prima sarebbero tre modi di dire due
cose.

**I menù di anno e libro offrono solo valori che hanno righe**, col loro conteggio: un menù d'anno
che elenca anni in cui non si è scritto niente promette elenchi vuoti. Non sono ristretti dalle
altre pastiglie di proposito — altrimenti restringere per tipo farebbe sparire anni dal menù e non
ci si potrebbe più tornare.

**Il conteggio compare solo quando risponde a un gesto** (§7, emendamento 25 agosto 2026): con un
filtro attivo, su una riga sua sotto le pastiglie. Senza filtri il totale sta nell'intestazione
della regione, dove è una didascalia dell'elenco e non un comando fra i comandi.

**Il filtro entra dentro la ricerca, non attorno.** `cerca_semantico` tiene i venti vettori più
vicini e poi si ferma: filtrare a valle darebbe zero risultati ogni volta che quei venti sono tutti
dell'anno sbagliato, e zero risultati qui si legge come "non hai scritto nulla al riguardo". La
funzione cerca quindi i venti più vicini **fra quelli che passano il filtro**.

**Una recensione non ha contrassegno spoiler** (è un attributo del solo Insight, PRD) né una data
propria — si usa la sua data di creazione. Il filtro "spoiler" restringe quindi ai soli insight, e
va detto invece di far sparire le recensioni in silenzio.

### I temi che tornano

**Erano carte, ora sono una lente.** Un tema era una carta con dentro nome, frase, libri e — dietro
"Mostra gli insight" — l'elenco degli scritti che l'avevano prodotto. Ora la pagina quegli scritti
li contiene: al tema basta dire **quali**, e il corpus sotto si restringe a quelli. Selezionandolo,
nome e frase diventano l'intestazione della regione; "Mostra gli insight" sparisce.

È anche il ponte che mancava fra le due regioni, che prima si alternavano soltanto: da un tema si
arriva ai suoi scritti senza passare dal campo, e da lì alla ricerca vera con un comando esplicito
— «cerca tutto ciò che somiglia a questo tema». Il risultato **non coincide** con i riferimenti del
tema, e la pagina lo dice invece di nasconderlo: la sintesi tiene i sostegni più forti, la ricerca
prende tutto ciò che è vicino. Sono due lenti diverse, non due versioni della stessa.

**Il nome del tema porta il carattere del display**, non quello dei comandi. Sopra c'è la riga
delle pastiglie di filtro in Inter Tight; con lo stesso vestito la pagina avrebbe due righe di
pastiglie che si somigliano e fanno cose diverse — una restringe per un attributo, l'altra apre
un'interpretazione. Un tema è un nome che il modello ha scritto, cioè materia della famiglia dei
titoli (§4).

**Il filtro va al server**, non applicato in pagina: i riferimenti di un tema possono essere più
vecchi della prima trentina di righe caricate, e filtrare ciò che è già a schermo li perderebbe
senza dirlo.

**Nessun tema debole.** Un tema sostenuto da un solo libro non è trasversale, e non compare — non
attenuato, non segnalato come incerto, assente. Se dopo il filtro non resta alcun tema, la
sintesi non si genera né sostituisce quella esistente: meglio nessuna carta che una carta vuota o
un pattern su un libro solo. Due testi distinti per i due modi in cui questo succede: non hai
ancora scritto nulla, oppure hai scritto ma nulla si collega ancora fra libri diversi.

**Senza sintesi la striscia è una riga sola**, non un blocco: a riposo la pagina deve mostrare ciò
che si è scritto, non un invito a generare qualcosa. Era il difetto della vecchia regione a riposo,
che nasceva con un pulsante e nient'altro.

**Sostituisce, non si accumula** — a differenza della preview (§9), che accumula apposta perché un
parere per ogni rilettura ha senso. Esiste al più una sintesi tematica per utente: generarne una
nuova cancella la precedente, mai prima di avere quella nuova pronta.

**Lo stesso avviso della preview**: il campo della risposta che dichiara la generazione — non una
frase dentro un testo — accanto al tema aperto, valido per l'intero risultato.

### A consenso revocato la pagina resta piena

Mancano **due cose**, non la pagina: il campo — dichiarato al posto suo, non tolto — e il conteggio
dei vicini sulle carte, perché gli indici sono stati cancellati. Restano il corpus, i filtri, la
scrittura, il pensiero che torna, e **i temi già generati**, che sono un artefatto dell'Utente (§22,
"resta leggibile e cancellabile dal proprietario") e il cui filtro non chiede niente a nessuno — è
un confronto fra identificatori. Sparisce solo "Genera di nuovo".

La dichiarazione occupa esattamente il posto della cosa che manca e l'azione primaria resta al suo:
non è uno stato vuoto e non è un riquadro d'allarme (§19), è testo.

---

## 23. Suggerimenti di lettura

**Seconda corsia di «Aggiungi un libro» (§13), non una pagina a sé.** Stavano su
`/suggerimenti`, una pagina che nasceva vuota e si raggiungeva solo dal disclosure chiuso della
Libreria. Il bisogno è identico a quello del catalogo che sta sopra — voglio un libro nuovo — solo
senza un titolo già in testa: a monte il catalogo, che sa già cosa cerchi, sotto il modello, che
prova a indovinarlo. Ci si arriva dall'unica azione primaria della Libreria, cioè dal pulsante più
visibile della pagina più visitata dell'app. Un filetto separa le due corsie; il consenso governa
solo la seconda.

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
opzioni" — un campo a riga sola sopra il pulsante. Non salvata, non un artefatto, non un insight:
vive nel corpo della singola richiesta e sparisce con lei. Il backend la tratta come una preferenza
da considerare insieme al profilo, mai come un'istruzione che sostituisce le regole di generazione
— un tentativo di cambiare argomento (rivelare le istruzioni del modello, farlo comportare
diversamente) viene ignorato in silenzio: i suggerimenti arrivano lo stesso, senza tenerne conto.

**Il profilo distingue tre gruppi con ruoli diversi**, non uno storico piatto: i libri amati
(voto alto, di qualsiasi età), le letture più recenti (qualsiasi voto), i libri non piaciuti o
abbandonati (per capire cosa evitare, mai per proporre "altri libri così"). Un libro già in
libreria, in qualunque stato — anche "da leggere" — non viene mai riproposto.

**Un'etichetta silenziosa per la scoperta.** Ogni proposta è "affine" (vicina a ciò che ami o
leggi ora) o "scoperta" (stesso territorio, un passo di lato). Solo "scoperta" si mostra in
pagina, in `t-meta`, accanto alla motivazione.

**Nessun badge "sintesi generata"**: a differenza della preview e della sintesi tematica, qui non
c'è un singolo testo in prosa la cui origine vada dichiarata — l'intestazione della corsia, con la
sua introduzione, dice già che si tratta di proposte del modello.

Due stati vuoti, entrambi testo e non un riquadro rosso: consenso revocato ("L'elaborazione
assistita è spenta", con rimando al Profilo) e profilo insufficiente (nessun libro amato, nessuna
lettura conclusa, nessun deluso).

---

## 24. Comandi, campi e bersagli

Sessione del 26 agosto 2026. Le sezioni precedenti dicono cosa fa ogni schermata; questa dice con
quali oggetti, e vale su tutte. Dove una schermata la contraddica, vince questa.

### Il problema che c'era

Non era brutto: era **plurale**. Sette grammatiche per due sole cose — premere e cercare.

| Cosa | Dove | Quante versioni |
|---|---|---|
| Comando testuale leggero | Quaderni, Annali, Suggerimenti | **3** (`tocco-esteso …`, `min-h-11 … sm:min-h-0`, `self-start …`) |
| Pastiglia | Scaffale, Quaderni, temi, Profilo, scrivi-pensiero | **5** (tre altezze, tre corpi, due modi di dire "accesa") |
| Campo di ricerca | 5 pagine | **5** (`py-3`/`py-2.5`/`py-2`/`pb-1`, tre corpi, quattro larghezze massime) |
| Campo data in riga | Segnalibro, transizioni | **2** riquadri scritti a mano, nessuno dei due con un'altezza |

Il difetto vero non è la ripetizione — è che le copie **divergevano**, e le differenze non
significavano niente. Due file di pastiglie sulla stessa pagina, alte una 30 e una 36. Un campo
che si sposta di quattro pixel cambiando pagina. Un `variant="link"` che usava l'accento come
testo — proprio ciò che §3 vieta — e che quindi nessuno usava, con la conseguenza che il comando
leggero è stato riscritto a mano otto volte.

### La scala dei comandi: cinque pesi, uno solo per gesto

Tutto passa da `ui/button.tsx`. Non esistono `<button>` vestiti a mano.

| Peso | Altezza | Quando |
|---|---|---|
| `default` (pieno) | 44 (`lg`) / 38 | **Una per zona.** L'azione che la zona esiste per compiere |
| `outline` | 38 / 32 (`sm`) | La seconda azione. Un oggetto posato sulla carta, non un buco nel bordo |
| `secondary` | 38 / 32 | Dichiara di essere **dentro una modalità** (il "Fine" di Modifica) |
| `ghost` | 38 / 32 / icona | Manutenzione, linguette di menù. Resta acceso finché il menù è aperto |
| `quiet` | nessuna | Il comando che non chiede spazio: filetto in `line-strong`, inchiostro tenue |

`quiet` + `size="testo"` **sostituisce le tre grammatiche testuali** di prima. Non ha riquadro,
quindi sta in fondo a un paragrafo senza aprirvi un buco alto 32px; porta `.bersaglio` da sé,
quindi ha 44px sotto il dito senza occuparli nel flusso; ed è un pulsante vero, quindi ha
`disabled`, il fuoco dell'app e il cedimento alla pressione — che i `<button>` scritti a mano non
avevano.

**Nessun accento come testo, in nessun peso.** L'accento è un riempimento (§3). Il vecchio
`variant="link"` era l'unica eccezione ed era un errore.

### Un comando non ha la faccia di un rimando

Nei Quaderni il libro da cui viene un pensiero portava lo stesso vestito di "Mostrane un altro",
sulla stessa carta, a due centimetri: `t-meta` sottolineato. Due promesse opposte — uno porta via
dalla pagina, l'altro cambia qualcosa qui — rese identiche.

La correzione non è dare al rimando un colore suo: due sottolineature di tinta diversa restano due
sottolineature. È **dargli la forma di quel che è**. Il libro non è un'azione, è la *provenienza*
del pensiero: un dato con dentro un rimando, e un dato con un contorno in quest'app è una
pastiglia (`ui/riferimento-libro.tsx`). Il titolo si tronca su `max-w`; gli autori escono dal
visibile e restano nel nome accessibile, dove servono davvero.

Resta sottolineato solo il rimando **dentro una frase**, che è l'unico posto dove non può avere
una forma propria.

### Le pastiglie: tre taglie, un solo modo di accendersi

`ui/pastiglia.tsx`. `filtro` 30px · `comando` 36px (gli interruttori) · `tema` 32px in Fraunces.

"Accesa" è **inchiostro pieno**, sempre. Era `bg-ink/9` nello scaffale e nei Quaderni — inchiostro
al 9%, che a distanza di un braccio non si distingue da spenta — e pieno nei temi, cioè due
risposte diverse alla stessa domanda sulla stessa pagina.

### I campi: `ui/campo-ricerca.tsx`, tre taglie

`insegna` (Fraunces 24, il campo *è* la pagina) · `piena` (Inter 16) · `riga` (Inter 16, 14 da
640px). Mai sotto i 16px dove c'è il dito: sotto quella soglia iOS ingrandisce la pagina al fuoco
e non la rimpicciolisce più.

Il campo porta **la lente e la croce**. La croce — svuotare — è il comando che serviva davvero e
che nessuna delle cinque copie aveva: si cancellava tenendo premuto il backspace.

**"Cerca" è sparito dalla Libreria.** Non faceva partire niente: il filtro è sempre attivo, a ogni
battuta. Restava per due argomenti, e nessuno regge — la simmetria con Quaderni era simmetria fra
due copie dello stesso errore, e la chiusura della tastiera su mobile si ottiene dal `<form
role="search">` che il campo ha già dentro. Il conto su 390px: campo + "Cerca" (72px) + "Aggiungi
un libro" (152px) + due gap lasciavano al campo **110px, cioè sei caratteri di titolo**. Il
bersaglio che non faceva nulla si prendeva più spazio del campo che faceva tutto.

**"Cerca" non c'è in nessun campo, nemmeno nei Quaderni** — dove la domanda esce verso il
fornitore e costa. La prima stesura di questa sezione lo teneva lì apposta, con l'argomento che un
gesto che costa va confermato deliberatamente. L'argomento è vero e la conclusione no: Invio *è*
un gesto deliberato quanto un clic, e `onInvia` esiste in `CampoRicerca` proprio per i campi che
devono far partire qualcosa — non serve un riquadro in più per renderlo intenzionale. Un pulsante
che ripete Invio un dito più in basso era l'unica eccezione alla regola che vale ovunque nel resto
dell'app.

### Il bersaglio non è il riquadro

Questa è la regola che cambia di più il mobile, ed è il modo in cui Apple risolve la stessa cosa
da sempre.

Prima `pointer: coarse` imponeva `min-height: 44px` a tutto, pastiglie comprese. Su un pulsante è
giusto — un pulsante *è* il suo riquadro. Su una pastiglia no: un'etichetta di 12px dentro una
capsula alta 44 ci galleggia in mezzo, e sei in fila sono la fascia più pesante della pagina per i
comandi più leggeri.

`.bersaglio` (tokens.css) tiene il riquadro alla misura che il disegno vuole e allarga l'area
sensibile a `--tap` con uno pseudo-elemento che non occupa flusso, **in entrambe le direzioni** —
serve per i bersagli quadrati: le iniziali del profilo (32px, e sotto i 640px sono l'unica porta
del profilo, per giunta in un angolo), il "?" di una chiosa, la croce di un campo.

Tre bersagli erano sotto soglia e **nessuna regola li copriva**, perché non avevano né `data-slot`
né una classe di raggio: gli anni degli Annali (28px), le loro frecce (28px), e le due metà di una
stella del voto (**14×28**). Il commento nel codice affermava che la regola `pointer: coarse` le
coprisse; non era mai stato vero, e `min-height` non avrebbe comunque toccato la larghezza, che è
la dimensione che lì manca.

**La stella è l'unico bersaglio che non può arrivare a 44**: mezza stella significa due bersagli
dentro la larghezza di uno, e 44 ciascuno darebbe una riga da 440px. Si allarga la stella —
`--stella`, 28px col mouse, 40 sotto il dito — e la precisione la recupera l'ingrandimento.

### Righe che non si schiacciano

Tre regole che valgono ovunque ci sia un nome accanto a un comando:

1. **`min-w-0` insieme a `truncate`.** Senza il primo il secondo non fa nulla: un figlio flex non
   scende sotto la larghezza del proprio contenuto se non glielo si concede. Era il motivo per cui
   nell'elenco dei Lettori un nome lungo spingeva il comando fuori dalla riga.
2. **L'azione è `shrink-0`, il dato è `flex-1`.** Il dato si tronca, il comando no.
3. **Le etichette lunghe si accorciano, la frase intera va nel nome accessibile.** "Chiedi il
   collegamento" era l'unica etichetta di tre parole in una colonna di verbi singoli — Accetta,
   Rifiuta, Ritira, Interrompi — e misurava 165px su una riga che a 390px ne ha 358 in tutto. Ora
   è "Chiedi", e `aria-label` dice anche **a chi**, cosa che il testo visibile non poteva fare.

### `flex-wrap` non è un'impaginazione mobile

`flex-wrap` fa decidere alla **lunghezza delle etichette** dove la riga si spezza. Il risultato
erano orfani sistematici: "Annulla" da solo su una terza riga, allineato a sinistra, nel punto più
simile a un'azione primaria; il campo data *sotto* il pulsante che quella data qualifica; "Salva"
in riga con un interruttore.

Sotto i 640px la struttura si **dichiara**: `flex-col`, gruppi che non si mescolano, azione
primaria a piena larghezza in fondo dove arriva il pollice, e `sm:flex-row` per tornare affiancati
sopra. Nel segnalibro l'ordine si inverte (`flex-col-reverse`): la data sta sopra, perché è un
dato dell'avanzamento e si guarda **prima** di confermarlo.

### Le etichette

- **L'etichetta di un interruttore nomina lo stato, non l'atto.** "Copri lo spoiler" è diventato
  **"Spoiler"**: l'interruttore accanto dice già "Condiviso" e "Solo tuo", cioè due nomi, e questo
  diceva un imperativo. Da premuto si leggeva come un fatto, da spento come una promessa. È anche
  la parola che la pastiglia di filtro dei Quaderni usa già, una riga sopra.
- **Cancellare un artefatto generato non ha il peso di rigenerarlo.** "Genera di nuovo" e
  "Cancella" erano due comandi identici a quattro pixel di distanza — e per giunta *dentro* il
  nastro che scorre in orizzontale, quindi fuori schermo su un telefono finché non si scorreva
  fino in fondo. Ora la manutenzione sta in un menù `⋯` ancorato fuori dal nastro, e la
  cancellazione chiede conferma. Vale per i temi dei Quaderni e per il parere della scheda.
- **Nessun glifo di testo come icona.** `‹ › ⋯ ▾` cambiano disegno e larghezza col carattere che
  il sistema sceglie per quel codepoint. Erano rimasti nel selettore d'anno, nelle due barre
  contestuali e in coda a "Cerca tutto ciò che somiglia a questo tema ›". Tutti tracciati, ora.

### Riferimento rapido

| Serve | Si usa |
|---|---|
| Un'azione | `<Button variant size>` — mai un `<button>` vestito a mano |
| Un comando leggero in coda a un testo | `<Button variant="quiet" size="testo">` |
| Un'azione che naviga | `<Button render={<Link href/>} nativeButton={false} …>` — non `buttonVariants` su un `<Link>`, e sempre con `nativeButton={false}`: Base UI presume un `<button>` vero dietro `render`, e un `<a>` non lo è (mancato in tutti e cinque i punti dell'app alla prima stesura) |
| Un filtro, un interruttore, un tema | `pastigliaVariants` + `attributiPastiglia` |
| Un campo che cerca o filtra | `<CampoRicerca taglia>` |
| Una data in riga con un pulsante | `<CampoData riquadro altezza>` |
| Il libro di uno scritto | `<RiferimentoLibro>` |
| Spoiler + visibilità | `<InterruttoriScritto>` |
| Un bersaglio più grande del suo riquadro | `.bersaglio` |
