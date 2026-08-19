# Montaigne · Design frontend

Il come dell'interfaccia. Compagno del PRD, che porta il cosa.

Revisione del 19 agosto 2026.

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
| **2, oggetto** | Ciò che è sollevato: dorso al passaggio del mouse, pannello aperto, copertina | Luminanza più alta ancora, ombra doppia, bordo di luce sul lato illuminato |

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
scelto a mano. Raggi: 4px sugli oggetti piccoli (pastiglie, dorsi, barre), 10px su campi e
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
| Dorsi | colore calcolato per la stanza chiara | seconda versione calcolata, più desaturata |

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
| Libreria | Scaffale, elenco, ricerca |
| Annali | Metriche per anno |
| Lettori | Elenco membri |
| Torre | Collegamenti e impostazioni |

La barra sta sul piano 0, non su una carta: non è contenuto, è la stanza. La voce attiva si
segnala con l'inchiostro pieno e un filetto, non con un riempimento.

Il contatore delle richieste ricevute sta accanto a Torre ed è l'unico elemento in `alert` di
tutta l'app: il PRD non ha notifiche, e senza contatore una richiesta resterebbe invisibile
per sempre.

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

Scaffale di dorsi come vista predefinita, elenco come alternativa.

**Larghezza dei dorsi fissa, minimo 30px.** Farla variare per realismo rende i titoli
illeggibili e non porta nessun dato: l'informazione sta nell'altezza.

**Altezza proporzionale alle pagine adottate**, con minimo e massimo. Le voci senza pagine
adottate prendono altezza mediana e un trattamento diverso, cioè nessuna venatura e un bordo
tratteggiato appena accennato: l'assenza di dato si vede invece di essere finta.

**Colore del dorso calcolato lato server** alla nascita della scheda, insieme a miniatura e
versione grande, salvato come due esadecimali sul Libro, uno per la stanza chiara e uno per
quella scura. Mai estratto nel browser con canvas. Strumento: `sharp-vibrant`, fork di
node-vibrant senza supporto browser.

**Il dorso è l'unico posto dell'app dove sopravvive la materia letterale.** Un gradiente a tre
stop lungo la larghezza che simula la piega della costa: bordo scuro a sinistra, campo pieno
al centro, ombra a destra. Nessuna texture bitmap. È tutto ciò che serve perché venti
rettangoli affiancati leggano come volumi.

**Nastri per lo stato**, nella stessa posizione del segnalibro sulla scheda: in lettura rosso,
in pausa ambra, letto verde, abbandonato grigio, da leggere nessun nastro. I colori dei nastri
sono un sistema a sé, indipendente dalla palette, perché codificano un dato e non
l'atmosfera: restano uguali nei quattro ancoraggi, con la sola luminanza adattata per non
sparire al buio.

**Ordinamento alfabetico per autore, stabile.** Uno scaffale vero è stabile: impari dove sta
un libro e lo ritrovi con la coda dell'occhio. Ordinare per attività recente riordina la fila
a ogni avanzamento e impedisce alla memoria spaziale di formarsi. Aggiungere un libro
inserisce un dorso, non rimescola.

**Fascia delle letture in corso in cima**, su desktop e mobile. Sono due o tre libri e
risolvono l'obiezione all'ordinamento alfabetico.

**La mensola.** Una barra di 10px sotto la fila, sul piano 1, con l'ombra doppia rivolta verso
il basso. È l'unico elemento dell'app che allude a un mobile, e basta: niente montanti,
niente cornice, niente parete.

### Sollevamento

Al passaggio del mouse il dorso sale al piano 2 e si allarga (32 → 44px), con un bordo di luce
sul lato illuminato e nessun testo aggiunto: l'allargamento completa i titoli troncati. I
titoli molto lunghi restano troncati, e si clicca.

- Solo `transform`. Mai larghezza o margine, che ricalcolerebbero il layout dell'intera fila
  a ogni movimento del mouse.
- L'ombra passa da quella del piano 1 a quella del piano 2, ed è ciò che rende leggibile il
  salto. `box-shadow` non è compositabile, quindi si usa uno pseudo-elemento con l'ombra
  superiore a cui si anima `opacity`.
- L'area sensibile resta ferma mentre il dorso sale, altrimenti il puntatore ne esce e si
  ottiene un tremolio.
- Il nastro sale col dorso.
- Tutto dietro `prefers-reduced-motion`, dove il salto di piano resta e il moto sparisce.

### Azioni dal dorso, senza aprire il libro

Il dorso sollevato ha spazio per i due gesti più frequenti: **registrare un avanzamento** e
**cambiare stato** fra le sole transizioni ammesse. Tocco lungo su mobile.

È il salto di qualità più importante dell'app e non è visivo. Il PRD dice che il tracciamento
progressivo moltiplica per dieci le scritture: se registrare costa dieci secondi, in un mese
l'app diventa un obbligo e la gente smette.

### Come si salta dentro una libreria grande

- **Indice a lettere sul bordo**, che è anche l'unghiatura delle rubriche.
- **Filtro testuale** su titoli e autori, sempre disponibile, che non chiama nessun modello.
- **Ricerca semantica separata**, sui propri insight, dipendente dal consenso. Il PRD impone
  che a consenso revocato l'interfaccia dichiari che è spenta. **Non vanno fuse in un campo
  solo**: revocare il consenso lascerebbe l'utente senza il modo di trovare un libro.
- **Filtro per stato**, gratuito perché i nastri sono già un codice colore.

### Accessibilità

Il colore del nastro da solo non basta: rosso e verde sono indistinguibili per un daltonico.
La lunghezza del nastro porta la differenza, e il dorso in lettura ha anche una linea chiara
sul bordo.

---

## 8. Mobile

Mobile pari a desktop, con il mobile come riferimento nei casi di dubbio. Ogni schermata si
progetta e si verifica mobile-first, mai il contrario.

**Scaffale a più mensole:** dorsi che vanno a capo su ripiani sovrapposti, trenta o quaranta
libri per schermata, scorrimento verticale, tocco che apre. Il sollevamento non serve: il dito
è già il puntatore. Ogni ripiano porta la sua mensola e la sua ombra, ed è la ripetizione
delle ombre a dare la profondità che su desktop dà il sollevamento.

**Striscia orizzontale con aggancio solo per le letture in corso.** Provata come vista
principale e scartata: dodici gesti per dodici libri, e perde il colpo d'occhio che è la
ragione stessa dello scaffale. Su due o tre libri funziona, col centro dello schermo che fa da
puntatore e la didascalia sotto che risolve la leggibilità dei titoli.

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
- Anno e lingua originale, con etichetta **"dedotto"** quando il valore viene dal modello e
  non dal catalogo.
- Generi come pastiglie **senza alcun affordance di modifica**: il PRD vieta la correzione a
  qualsiasi utente e non prevede nemmeno una segnalazione. L'assenza di comandi è il
  messaggio. Bordo 1px, nessun riempimento.
- Nessuna descrizione o trama: il Libro non ne ha.

### Pagina destra, la tua copia

- Nastro nella stessa posizione del dorso: il libro che si apre non perde il segnalibro.
- Stato, pagina raggiunta, data di inizio, barra di avanzamento in `accent`.
- Voto in stelle in `accent-strong`, recensione.
- Nota di intenzione su una carta leggermente più calda, angolo piegato, didascalia. Nessun
  lucchetto.
- Solo le transizioni ammesse dallo stato corrente, le frequenti in evidenza e le altre in un
  menù. **L'interfaccia non offre mai una transizione vietata**, invece di offrirla e poi
  rifiutarla.
- Se il libro è da leggere, **"me lo consigli?" prende il posto dei dati di lettura**. Vincoli
  del PRD: privata e mai condivisibile, sotto le ottanta parole, dichiarata come generata, e a
  consenso revocato l'interfaccia dice che è spenta invece di far finta che non esista.

### Sotto le due pagine

Insight raggruppati per lettura, poi lo storico delle letture in un pannello che si apre. Sui
libri con una lettura sola, la maggioranza, non compare nulla.

### Su mobile

Le due pagine si impilano e si invertono: la tua copia sopra, l'opera sotto. Su uno schermo
alto la prima schermata va a ciò che cambia. Titolo, autore e copertina in cima in forma
compatta sul piano 0. La piega diventa il vuoto fra due carte impilate.

### Rito di apertura

Il dorso è già sollevato dal passaggio del mouse, quindi il clic parte da lì. Il dorso ruota
mostrando la copertina, che cresce e va al suo posto nella pagina sinistra; la pagina destra
arriva un attimo dopo.

Sotto i 400 millisecondi, **una volta sola, mai al ritorno**. Al ritorno il volume non si
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
strappata. Vale identico sugli insight di un collegato: il taglio non è un permesso, è un
avviso.

---

## 12. Registrazione dell'avanzamento

**Principio: rendere impossibile lo stato invalido invece di rifiutarlo dopo.** Un rifiuto che
compare dopo che hai digitato è un fallimento del disegno.

**Pannello sulla pagina destra.** Nessuna finestra sovrapposta, nessuna sfocatura. Su mobile
si espande la sezione della tua copia. Senza strati sovrapposti non c'è nulla che possa
chiudersi portandosi via il testo in scrittura, come impone la regola 25.

Il pannello sale al piano 2 mentre si apre e la carta sotto resta al piano 1: è il salto di
ombra a dire che l'attenzione è lì, senza oscurare il resto.

| Elemento | Regola |
|---|---|
| Numero grande, a fuoco all'apertura, tastiera numerica, invio salva | Il caso normale è: tocco, tre cifre, invio |
| "tra 215 e 320" sotto il campo | Dichiara i limiti prima dell'errore. Minimo dall'avanzamento precedente, massimo dalle pagine adottate |
| "42 pagine dal 14 agosto" | Il PRD conta le pagine come somma degli **incrementi**, mai delle pagine raggiunte. Mostrarlo mentre lo crei insegna il modello facendolo. È anche l'unico numero gratificante |
| Barra a due colori | Quello che avevi in `ink-soft`, quello che aggiungi adesso in `accent` |
| "non prima del 14 agosto" accanto alla data | Regola 15: mai prima dell'avanzamento precedente, mai futura |
| "Correggi il totale" | Via d'uscita visibile nel momento del blocco. Rifiutata se il nuovo totale è inferiore a un avanzamento già inserito |

### Inserimento

Digitando il numero e trascinando il segnalibro. Il trascinamento rende il vincolo fisico: la
porzione già letta è un muro e il segnalibro non può tornare indietro. Il rifiuto del PRD non
arriva più come messaggio, il dito semplicemente non ci riesce.

Il segnalibro è un oggetto del piano 2 su una barra del piano 1, quindi ha ombra propria e si
vede che è afferrabile. È l'unico caso dell'app in cui la profondità dichiara un affordance,
ed è esattamente il lavoro per cui la profondità esiste.

Il trascinamento va sempre accoppiato al numero, che si aggiorna in tempo reale e resta
modificabile: su un libro da 1200 pagine su telefono un pixel vale quattro pagine, quindi si
trascina per avvicinarsi e si digita per precisare. Serve l'equivalente da tastiera con le
frecce.

**Salvataggio ottimistico.** Il segnalibro si muove subito, la conferma arriva dopo. Se
fallisce, torna indietro con una riga chiara. È la differenza fra un'app che sembra viva e una
che sembra un modulo.

### Due varianti

**Voce senza pagine adottate:** spariscono totale, percentuale e massimo. Restano numero e
incremento. Un incremento fuori scala produce un **avviso, non un rifiuto**.

**Chiusura del libro:** "Ho finito" non passa da qui, chiede solo la data di fine. Il PRD
genera da solo l'avanzamento finale alle pagine adottate. Va detto in una riga, altrimenti
sembra che l'app abbia inventato un dato.

---

## 13. Ricerca e aggiunta

Un campo solo, con sotto "titolo o autore". Il PRD è netto: non esistono altre vie d'ingresso,
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

**Nessuna preview prima dell'aggiunta.** Senza descrizione conterrebbe gli stessi sei dati
della riga dei risultati. Elimina anche l'attrito col PRD: "me lo consigli?" resta sulla scheda
di un libro già in libreria, quindi l'artefatto ha sempre una Voce a cui legarsi.

**Velocità percepita.** Risultati che compaiono mentre si digita, con le schede già nel sistema
mostrate per prime perché non richiedono una chiamata esterna.

**Copertina assente:** segnaposto con titolo e autore, composto in Fraunces sul colore del
dorso. Il recupero è un lavoro in secondo piano, quindi un libro appena aggiunto può comparire
sullo scaffale con un dorso tipografico e riempirsi dopo. **Il dorso non deve saltare quando
arriva l'immagine**: nasce già della dimensione definitiva.

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

Nome utente sempre presente in alto, in Fraunces, dove nella propria libreria non c'è nulla. È
il secondo segnale, e regge anche per chi non distingue i due bianchi.

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
lo portano i dorsi e senza dorsi non ce n'è. Quindi qui, e solo qui, si concede un disegno: **una
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

Nessun modale, nessun avviso che si sovrappone: solo pannelli in pagina.

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
- **Radix primitives** invece di shadcn/ui preso così com'è, che porta un'estetica già decisa da
  disfare quasi ovunque.
- **`next/font/local`** per le tre famiglie variabili, subset latino.
- **Nessuna libreria 3D, nessuna libreria di smooth scroll, nessuna libreria di illustrazioni.**
  Gli unici SVG dell'app sono la mensola vuota, la grana e le icone, disegnati a mano e inline.

### Movimento

| Strumento | A cosa serve |
|---|---|
| **Motion** (`motion/react`) | Sollevamento, fisarmonica, taglio della pagina. Anima direttamente valori oklch, il che rende gratuita l'interpolazione della luce |
| **GSAP** | Rotazione del dorso in copertina, se Motion non basta. Gratuito, plugin del Club compresi |
| **View Transitions** | Rito di apertura. Dentro la stessa pagina disponibile ovunque; fra pagine diverse ancora in movimento. **Miglioramento progressivo, mai fondamenta** |
| **Animazioni CSS guidate dallo scroll** | Fisarmonica, striscia agganciata. Girano sul compositore **solo se si animano transform e opacity** |
| **`sibling-index()`** | Scaglionare la fisarmonica senza JavaScript |
| **Query `scroll-state`** | Sollevare il dorso agganciato al centro su mobile |
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

È l'unico posto dell'app dove **il dato diventa materia**: l'altezza è le pagine, il colore è la
copertina, il nastro è lo stato. Tre dimensioni di informazione dentro un oggetto che sembra un
libro e non un grafico. Prima cosa che si vede a ogni sessione, identità visiva, e la cosa che
nessuna app concorrente fa.

Tutto lo sforzo di raffinatezza va lì: gradiente della costa, ombra sotto la mensola,
fisarmonica, bordo di luce, autori accostati. **Se lo scaffale è perfetto e il resto è solo
pulito, l'app è splendida. Se lo scaffale è mediocre, nessun'altra animazione lo salva.**

### Le ciliegine, in ordine

1. **Il sistema di piani applicato con disciplina.** Non si nota mai e regge tutto. È anche la
   cosa più facile da sbagliare: basta una carta di troppo sul piano 2 per perdere la gerarchia.
2. **Gli insight in Literata a due voci ottiche.** Cuore emotivo invece che identità visiva.
3. **Il segnalibro trascinabile.** L'unico caso in cui una regola di validazione diventa fisica.
   Piccolo, ripetuto, trasforma la schermata più noiosa nella più soddisfacente.
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
| Interfaccia ferma al 2013, ricerca lenta, molti tocchi per cambiare scaffale | App nuova, e le azioni stanno sul dorso |
| Paywall sulle statistiche di base | Istanza privata |
| Feed, club e consigli di influencer che intralciano chi legge da solo | Il PRD esclude feed, notifiche, commenti |
| Ludicizzazione paternalistica, sfida annuale demotivante | Il PRD esclude obiettivi, sfide, serie. **Tenerle fuori anche post MVP** |
| App mobile che arranca dietro al web | Parità decisa |
| Copertine sgranate o deformate, lamentela ricorrente su almeno quattro app | Le copertine sono conservate a due misure fisse e i dorsi hanno un colore proprio calcolato, quindi una copertina mancante o brutta non rovina mai lo scaffale |

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
probabile.** Contromisure già nel documento: azioni dal dorso, salvataggio ottimistico, tastiera
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

## 24. Lacuna segnalata sul PRD

**Il Libro non ha descrizione.** Deciso di lasciarlo così. Conseguenza accettata: per sapere di
cosa parla un libro l'utente esce dall'app. Google Books la fornirebbe quasi sempre, quindi la
porta resta aperta post MVP.
