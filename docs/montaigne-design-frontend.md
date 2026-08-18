# Montaigne — Design frontend

Documento di riferimento per la costruzione dell'interfaccia. Compagno del PRD, non lo
sostituisce: qui c'è il come, lì il cosa.

Ultima revisione: 18 agosto 2026.

---

## 1. Direzione

**La torre.** Legno, incisione, verticalità. Il riferimento è la biblioteca di Montaigne,
che fece incidere una sessantina di sentenze sulle travi del soffitto.

Il riferimento non si spiega mai all'utente: è una ragione di progetto, non un contenuto.
Nell'interfaccia gli insight si chiamano insight. Il nome "Montaigne" compare solo sulla
schermata d'accesso.

**Principio guida.** L'atmosfera vive ai bordi e nei passaggi. Il dato vive al centro e
resta sobrio.

**Regola di verifica.** L'app deve essere bella da ferma. Se una schermata ha bisogno del
movimento per sembrare bella, il movimento sta coprendo un problema di composizione.

---

## 2. Materia

L'unica immagine raster dell'app è la copertina. Tutto il resto è CSS e SVG generati.
Le copertine sono già la voce che consuma più spazio, su piano gratuito e senza backup.

| Materia | Come si fa |
|---|---|
| Legno | `feTurbulence` + `feDisplacementMap`, SVG da ~2 KB salvato come file e ripetuto. Non deve essere riconoscibile come legno, solo togliere la piattezza |
| Incisione | Tipografia, non texture. `text-shadow` 1px chiaro sotto, scuro sopra |
| Carta | Colore pieno più rumore SVG a opacità 0.03. Mai una foto di carta |
| Luce | Un solo `radial-gradient` a basso contrasto, fisso dietro il contenuto |

Due limiti dei filtri SVG, che sono il motivo per cui il legno va salvato come file e non
calcolato a ogni frame: si applicano alla versione bitmap della forma, quindi ogni
cambiamento di forma o posizione ricalcola l'intero filtro; e più di quattro primitive
concatenate affossano le prestazioni su mobile. Niente grana animata.

---

## 3. Luce

Quattro ancoraggi: alba, giorno, tramonto, notte. L'ora corrente sta sempre fra due e i
colori si interpolano. Automatica, con interruttore a tre stati nelle impostazioni
(giorno, notte, auto).

**Interpolazione in OKLCH.** I mezzitoni restano saturi e leggibili; in sRGB il passaggio
fra alba e giorno darebbe un mezzogiorno grigio e fangoso.

**Calcolo lato server.** Il PRD fissa il fuso CET uguale per tutti; calcolarlo nel browser
produrrebbe un mismatch di idratazione in Next.js. Alba e tramonto da tabella a latitudine
fissa, non dalla posizione dell'utente: due collegati devono vedere la stessa stanza alla
stessa ora.

Il valore si aggiorna al cambio pagina, mai con un timer. **Il passaggio automatico non
avviene mai mentre si sta scrivendo**: è rimandato alla navigazione successiva.

### Giorno e notte non sono l'uno l'inversione dell'altro

| | Giorno | Notte |
|---|---|---|
| Fondo | rovere chiaro, luce da finestra | noce scuro, luce da lampada |
| Superficie | carta avorio | carta ambrata smorzata |
| Testo | inchiostro bruno | avorio caldo |
| Incisione | ombra sotto | riflesso sopra |
| Copertine | naturali | leggermente desaturate |

Tre trappole: di notte una copertina bianca acceca, serve una velatura che si toglie al
passaggio del mouse; i colori dei dorsi vanno calcolati in due versioni; l'interruttore va
comunque offerto.

---

## 4. Navigazione

Quattro voci: **Libreria, Annali, Lettori, Torre.**
In inglese: Library, Annals, Readers, Tower.

| Voce | Contenuto |
|---|---|
| Libreria | Scaffale, elenco, ricerca |
| Annali | Metriche per anno |
| Lettori | Elenco membri |
| Torre | Collegamenti e impostazioni |

Il contatore rosso delle richieste ricevute sta accanto a Torre. È l'unico elemento
colorato della navigazione, perché è l'unica cosa che chiede un'azione in tutto il
prodotto: il PRD non ha notifiche, e senza contatore una richiesta resterebbe invisibile.

Il rimando letterario sta nell'insegna, non nella segnaletica interna: dentro le pagine i
titoli restano piani (collegamenti, impostazioni, cancella il tuo account, chi vede cosa).

---

## 5. Libreria

Scaffale di dorsi come vista predefinita, elenco come alternativa.

**Larghezza dei dorsi fissa, minimo 30px.** Farla variare per realismo rende i titoli
illeggibili e non porta nessun dato: l'informazione sta nell'altezza.

**Altezza proporzionale alle pagine adottate**, con minimo e massimo. Le voci senza pagine
adottate prendono altezza mediana e materia diversa: l'assenza di dato si vede invece di
essere finta.

**Colore del dorso calcolato lato server** alla nascita della scheda, insieme a miniatura e
versione grande, salvato come due esadecimali sul Libro (giorno e notte). Mai estratto nel
browser con canvas. Strumento: `sharp-vibrant`, fork di node-vibrant senza supporto
browser.

**Nastri per lo stato**, nella stessa posizione del segnalibro sulla scheda: in lettura
rosso, in pausa ambra, letto verde, abbandonato grigio, da leggere nessun nastro.

**Ordinamento alfabetico per autore, stabile.** Uno scaffale vero è stabile: impari dove sta
un libro e lo ritrovi con la coda dell'occhio. Ordinare per attività recente riordina la
fila a ogni avanzamento e impedisce alla memoria spaziale di formarsi. Aggiungere un libro
inserisce un dorso, non rimescola.

**Fascia delle letture in corso in cima**, su desktop e mobile. Sono due o tre libri e
risolvono l'obiezione all'ordinamento alfabetico.

### Sollevamento

Al passaggio del mouse il dorso sale e si allarga (32 → 44px), con un bordo di luce e
nessun testo aggiunto: l'allargamento completa i titoli troncati. I titoli molto lunghi
restano troncati, e si clicca.

- Solo `transform`. Mai larghezza o margine, che ricalcolerebbero il layout dell'intera
  fila a ogni movimento del mouse.
- L'area sensibile resta ferma mentre il dorso sale, altrimenti il puntatore ne esce e si
  ottiene un tremolio.
- Il nastro sale col dorso.
- Tutto dietro `prefers-reduced-motion`.

### Azioni dal dorso, senza aprire il libro

Il dorso sollevato ha spazio per i due gesti più frequenti: **registrare un avanzamento** e
**cambiare stato** fra le sole transizioni ammesse. Tocco lungo su mobile.

È il salto di qualità più importante dell'app e non è visivo. Il PRD stesso dice che il
tracciamento progressivo moltiplica per dieci le scritture: se registrare costa dieci
secondi, in un mese l'app diventa un obbligo e la gente smette.

### Come si salta dentro una libreria grande

- **Indice a lettere sul bordo**, che è anche l'unghiatura delle rubriche.
- **Filtro testuale** su titoli e autori, sempre disponibile, che non chiama nessun modello.
- **Ricerca semantica separata**, sui propri insight, dipendente dal consenso. Il PRD impone
  che a consenso revocato l'interfaccia dichiari che è spenta. **Non vanno fuse in un campo
  solo**: revocare il consenso lascerebbe l'utente senza il modo di trovare un libro.
- **Filtro per stato**, gratuito perché i nastri sono già un codice colore.

### Accessibilità

Il colore del nastro da solo non basta: rosso e verde sono indistinguibili per un
daltonico. La lunghezza del nastro porta la differenza, e il dorso in lettura ha anche una
linea chiara sul bordo.

---

## 6. Mobile

Mobile pari a desktop. Cambia il vincolo del PRD, che dichiara desktop primario.

**Scaffale a più mensole:** dorsi che vanno a capo su ripiani sovrapposti, trenta o quaranta
libri per schermata, scorrimento verticale, tocco che apre. Il sollevamento non serve: il
dito è già il puntatore.

**Striscia orizzontale con aggancio solo per le letture in corso.** Provata come vista
principale e scartata: dodici gesti per dodici libri, e perde il colpo d'occhio che è la
ragione stessa dello scaffale. Su due o tre libri funziona, col centro dello schermo che fa
da puntatore e la didascalia sotto che risolve la leggibilità dei titoli.

---

## 7. Scheda del libro

**Volume aperto, due pagine.** A sinistra l'opera, dato condiviso. A destra la tua copia.
La piega centrale è il confine di proprietà della tabella di ownership del PRD.

Nessuna copertina a tutta larghezza in cima: è la soluzione di tutte le altre app e
schiaccia il contenuto personale sotto la piega dello schermo.

### Pagina sinistra, l'opera

- Copertina, titolo nella variante della lingua dell'interfaccia, autori.
- Anno e lingua originale, con etichetta **"dedotto"** quando il valore viene dal modello e
  non dal catalogo.
- Generi come pastiglie **senza alcun affordance di modifica**: il PRD vieta la correzione a
  qualsiasi utente e non prevede nemmeno una segnalazione. L'assenza di comandi è il
  messaggio.
- Nessuna descrizione o trama: il Libro non ne ha.

### Pagina destra, la tua copia

- Nastro nella stessa posizione del dorso: il libro che si apre non perde il segnalibro.
- Stato, pagina raggiunta, data di inizio, barra di avanzamento.
- Voto in stelle, recensione.
- Nota di intenzione su carta diversa, angolo piegato, didascalia. Nessun lucchetto.
- Solo le transizioni ammesse dallo stato corrente, le frequenti in evidenza e le altre in
  un menù. **L'interfaccia non offre mai una transizione vietata**, invece di offrirla e poi
  rifiutarla.
- Se il libro è da leggere, **"me lo consigli?" prende il posto dei dati di lettura**.
  Vincoli del PRD: privata e mai condivisibile, sotto le ottanta parole, dichiarata come
  generata, e a consenso revocato l'interfaccia dice che è spenta invece di far finta che
  non esista.

### Sotto le due pagine

Insight incisi raggruppati per lettura, poi lo storico delle letture in un pannello che si
apre. Sui libri con una lettura sola, la maggioranza, non compare nulla.

### Su mobile

Le due pagine si impilano e si invertono: la tua copia sopra, l'opera sotto. Su uno schermo
alto la prima schermata va a ciò che cambia. Titolo, autore e copertina in cima in forma
compatta sul legno. La piega diventa una riga orizzontale.

### Rito di apertura

Il dorso è già sollevato dal passaggio del mouse, quindi il clic parte da lì. Il dorso ruota
mostrando la copertina, che cresce e va al suo posto nella pagina sinistra; la pagina destra
arriva un attimo dopo.

Sotto i 400 millisecondi, **una volta sola, mai al ritorno**. Al ritorno il volume non si
richiude: elegante la prima volta, insopportabile la ventesima.

---

## 8. Insight

Due trattamenti, scelti dal sistema in base alla lunghezza. Nessuna scelta chiesta
all'utente, nessuna etichetta.

| | Sentenza (sotto ~200 battute) | Appunto (oltre) |
|---|---|---|
| Corpo | serif grande, ~19px | serif di lettura, ~15px |
| Incisione | sì | no |
| Interlinea | larga | più fitta |
| Troncamento | nessuno | otto righe, poi "mostra tutto" |

In un libro con dodici insight, le due frasi buone risaltano da sole senza che nessuno le
abbia marcate.

Data piccola, in sans, spaziata, **sotto e non sopra**: la frase viene prima.

**Raggruppati per lettura**, come impone il PRD, che lega ogni insight alla lettura in cui è
nato. Le letture più vecchie hanno un legno più smorzato: la profondità nel tempo si vede
senza etichette.

Nessun bordo, nessuna ombra: una campitura appena diversa dal fondo.

**Solo dentro la scheda del libro.** La vista trasversale è rinviata. Ricerca semantica e
sintesi tematica producono comunque risultati che attraversano più libri, ma una pagina di
risultati non è una vista di navigazione: mostra l'insight con accanto il libro da cui
viene.

---

## 9. Spoiler

**Pagina non tagliata.** Comando: "Taglia per leggere". Richiama le pagine intonse dei libri
antichi: irreversibile nella metafora, reversibile nel prodotto.

Non è una scelta estetica. La regola 10 del PRD impone che uno spoiler non sia mai
restituito in chiaro in elenchi o anteprime, e sfocare con CSS non basta perché il testo
resterebbe nel DOM. Quindi il server manda solo il fatto che esiste, il gesto di scoprire fa
una richiesta, e **l'animazione copre la latenza**.

Vale identico sugli insight di un collegato: il taglio non è un permesso, è un avviso.

---

## 10. Registrazione dell'avanzamento

**Principio: rendere impossibile lo stato invalido invece di rifiutarlo dopo.** Un rifiuto
che compare dopo che hai digitato è un fallimento del disegno.

**Pannello sulla pagina destra.** Nessuna finestra sovrapposta, nessuna sfocatura. Su mobile
si espande la sezione della tua copia. Senza strati sovrapposti, non c'è nulla che possa
chiudersi portandosi via il testo in scrittura, come impone la regola 25.

| Elemento | Regola |
|---|---|
| Numero grande, a fuoco all'apertura, tastiera numerica, invio salva | Il caso normale è: tocco, tre cifre, invio |
| "tra 215 e 320" sotto il campo | Dichiara i limiti prima dell'errore. Minimo dall'avanzamento precedente, massimo dalle pagine adottate |
| "42 pagine dal 14 agosto" | Il PRD conta le pagine come somma degli **incrementi**, mai delle pagine raggiunte. Mostrarlo mentre lo crei insegna il modello facendolo. È anche l'unico numero gratificante |
| Barra a due colori | Quello che avevi, quello che aggiungi adesso |
| "non prima del 14 agosto" accanto alla data | Regola 15: mai prima dell'avanzamento precedente, mai futura |
| "Correggi il totale" | Via d'uscita visibile nel momento del blocco. Rifiutata se il nuovo totale è inferiore a un avanzamento già inserito |

### Inserimento

Digitando il numero e trascinando il segnalibro. Il trascinamento rende il vincolo fisico:
la porzione già letta è un muro e il segnalibro non può tornare indietro. Il rifiuto del PRD
non arriva più come messaggio, il dito semplicemente non ci riesce.

Il trascinamento va sempre accoppiato al numero, che si aggiorna in tempo reale e resta
modificabile; su un libro da 1200 pagine su telefono un pixel vale quattro pagine, quindi si
trascina per avvicinarsi e si digita per precisare; serve l'equivalente da tastiera con le
frecce.

**Salvataggio ottimistico.** Il segnalibro si muove subito, la conferma arriva dopo. Se
fallisce, torna indietro con una riga chiara. È la differenza fra un'app che sembra viva e
una che sembra un modulo.

### Due varianti

**Voce senza pagine adottate:** spariscono totale, percentuale e massimo. Restano numero e
incremento. Un incremento fuori scala produce un **avviso, non un rifiuto**.

**Chiusura del libro:** "Ho finito" non passa da qui, chiede solo la data di fine. Il PRD
genera da solo l'avanzamento finale alle pagine adottate. Va detto in una riga, altrimenti
sembra che l'app abbia inventato un dato.

---

## 11. Ricerca e aggiunta

Un campo solo, con sotto "titolo o autore". Il PRD è netto: non esistono altre vie
d'ingresso, né codice digitato né scansione. Nessun selettore di modalità.

Risultati da schede esistenti e cataloghi esterni presentati insieme, senza distinzione,
come impone il PRD. Ma i libri già in libreria cambiano verbo:

| Situazione | Verbo | Riga sotto l'autore |
|---|---|---|
| Non in libreria | Aggiungi | nessuna |
| In libreria, letto o abbandonato | Rileggi | "Letto nel 2023, quattro stelle" |
| In libreria, altri stati | Vai al libro | "In lettura, pagina 88" |

**L'aggiunta non porta via dalla ricerca.** Il pulsante diventa "Vai al libro" sul posto e la
riga guadagna lo stato. Chi popola la libreria ne aggiunge cinque di fila senza perdere i
risultati.

**Nessuna preview prima dell'aggiunta.** Senza descrizione conterrebbe gli stessi sei dati
della riga dei risultati. Elimina anche l'attrito col PRD: "me lo consigli?" resta sulla
scheda di un libro già in libreria, quindi l'artefatto ha sempre una Voce a cui legarsi.

**Velocità percepita.** Risultati che compaiono mentre si digita, con le schede già nel
sistema mostrate per prime perché non richiedono una chiamata esterna.

**Copertina assente:** segnaposto con titolo e autore. Il recupero è un lavoro in secondo
piano, quindi un libro appena aggiunto può comparire sullo scaffale con un dorso tipografico
e riempirsi dopo. **Il dorso non deve saltare quando arriva l'immagine**: nasce già della
dimensione definitiva.

**Nessun risultato è un vicolo cieco e lo dice.** Il PRD vieta la creazione manuale di
schede: il libro va chiesto a chi mantiene l'istanza. Nessun pulsante "crea comunque",
perché non esiste e offrirlo sarebbe una bugia. La richiesta va resa un gesto facile, non
una frase di scuse: una riga da copiare con titolo e autore già dentro.

**Fonti irraggiungibili è un altro stato**, distinto da "non esiste", altrimenti chi cerca
pensa che il libro non ci sia mentre è solo il catalogo che non risponde.

---

## 12. Annali

Stessa materia e stessa luce dello scaffale, in tono minore. I numeri restano in sans,
allineati, **non incisi**: l'incisione è riservata agli insight.

**Ogni numero porta accanto il suo limite, in una riga piccola, sempre**, non solo quando c'è
un'anomalia. Se compare solo nei casi anomali diventa un allarme; se c'è sempre diventa il
modo in cui il numero si legge.

Le righe sono requisiti del PRD:

- i libri senza pagine adottate contano solo le pagine registrate a mano, e la somma non va
  mai presentata come completa;
- il peso di un libro si ripartisce fra autori e generi, così un libro vale sempre uno. I
  decimali (1,5 accanto a un autore) vanno tenuti, con la frase che li spiega sotto: senza,
  sembrano un errore di calcolo;
- i libri senza genere restano fuori dalla classifica dei generi e lo scarto è dichiarato
  accanto;
- "di cui 2 riletture" chiarisce che l'unità è la Lettura e non il Libro.

Selettore ad anno a frecce, con l'intervallo dichiarato dal primo anno con dati a oggi. Anni
futuri non selezionabili; un anno intermedio senza letture mostra zeri, non un errore.

Classifiche a cinque voci, con "mostra tutte".

La spiegazione della divergenza a cavallo d'anno compare **solo quando serve**, cioè quando
in quell'anno esiste almeno una lettura che attraversa il capodanno: il libro conta nell'anno
di chiusura mentre le pagine restano divise fra i due anni secondo quando sono state segnate.

---

## 13. Libreria di un collegato

**La stessa stanza, con la lampada di un altro.** Legno più freddo, carta più grigia, nastro
e stelle più smorzati. Confrontandola con la propria si sente, da sola no. Nome utente
sempre presente in alto.

**L'assenza è muta.** Nessun lucchetto dove starebbe la nota di intenzione, nessun "questo
insight è privato", nessun posto vuoto che riveli che qualcosa esiste e non ti è dato. Un
lucchetto è metadato: rivela che una nota c'è, e il PRD dice che non è visibile a nessuno
mai, e quel "mai" comprende sapere che esiste. Vale identico per insight e recensioni resi
privati.

**Nessuna superficie di scrittura e nessuna traccia di dove sarebbero.** Niente "segna
avanzamento", niente stelle cliccabili, niente campo nota. Il PRD esclude ogni interazione:
né commenti, né reazioni, né messaggi. La pagina destra non ha un solo pulsante.

**Anche la coda dei libri da leggere è visibile**, come impone il PRD: non esistono libri
nascosti né parti di libreria riservate. Vale la pena che l'avviso di visibilità lo dica
chiaro.

**Collegamento interrotto:** la schermata non dice "sei stato rimosso" e non dice "errore".
Dice che quella libreria non è più accessibile e riporta all'elenco. Una stanza chiusa, non
un guasto.

---

## 14. Lettori

L'elenco mostra nomi e i tre stati della relazione, e nient'altro: non relazioni fra terzi,
non libri, non metriche, nessun conteggio di collegamenti, nessuna anteprima. È un registro
di nomi.

Le richieste compaiono solo nella Torre, come dice il PRD. Nell'elenco una richiesta in
attesa è testo, non un pulsante.

**Il rifiuto non lascia traccia.** Chi ha chiesto vede la relazione tornare ad assente,
indistinguibile da chi non ha mai chiesto. Nessun blocco, richiesta reinviabile.

Qui il legno resta ma lo scaffale no: sono persone, non volumi. Carta, nomi, iniziali.

---

## 15. Torre

Una superficie sola, due sezioni. Sopra i collegamenti (richieste ricevute, inviate, attivi
con interruzione), sotto le impostazioni.

**Interrompere un collegamento: azione immediata, senza dialogo di conferma, con un annulla
che resta per qualche secondo.** Interrompere non è simmetricamente reversibile: tu
interrompi da solo, ma per tornare indietro serve che l'altro accetti una nuova richiesta, e
nel frattempo entrambi avete perso l'accesso senza che l'altro sappia perché.

**I due testi lunghi sono quelli del PRD, parola per parola.** L'avviso di visibilità è
definito come riga fissa, e il testo del consenso è dettato per intero perché è la base di un
consenso informato. Non vanno riscritti in forma più breve o più simpatica.

Sotto il consenso, una riga sulle note di intenzione: non escono mai, in nessuno stato del
consenso. È l'informazione più rassicurante della schermata.

L'interruttore nasce acceso. Spegnendolo va detto cosa succede subito e cosa no: le cinque
funzioni si spengono e gli indici si cancellano, ma gli artefatti già generati restano come
contenuti dell'utente.

### Cancellazione dell'account

Non è un pulsante rosso. È in fondo, in tono piano. La difficoltà sta dove deve stare:
bisogna scrivere il proprio nome utente, e il pulsante resta spento finché non coincide.

Il rosso e i toni allarmati sono evitati di proposito: un'azione che richiede di digitare il
proprio nome è già difficile da compiere per errore, e l'allarme grafico su un gesto
legittimo è paternalistico.

Schermata finale: due righe che dicono che l'account non c'è più e che per rientrare serve
parlare con chi mantiene l'istanza.

---

## 16. Stati vuoti e riautenticazione

Uno stato vuoto è un invito ad agire, tranne quando non c'è niente da fare, e in quel caso lo
dice.

**Scaffale vuoto:** una mensola disegnata, non un rettangolo tratteggiato. Coglie l'occasione
per dire una cosa che il PRD rende possibile ma che nessuno indovinerebbe: puoi datare una
lettura a quando è successa, e quindi caricare la libreria storica senza schiacciarla sulla
data di inserimento.

**Nessun collegamento:** spiega la reciprocità, cioè che finché nessuno accetta, nessuno vede
nulla in nessuna delle due direzioni.

**Ricerca senza risultati:** l'unico vicolo cieco del prodotto, e non finge il contrario.

**Riautenticazione:** mai una schermata. Una fascia in cima al pannello in cui si sta
scrivendo, con la password. Il testo resta visibile e salvando riparte l'operazione fallita.

**Primo accesso:** schermata a sé, non un pannello sovrapposto. Accettare l'informativa è
condizione per entrare, quindi non è un avviso da scacciare, è una porta.

---

## 17. Scrittura

Mai "con successo", mai "per favore", nessun punto esclamativo, nessun "ops". Gli errori
dicono cosa è successo e cosa fare. Verbo prima nei comandi. Un comando mantiene lo stesso
nome per tutto il flusso.

Nessun modale, nessun avviso che si sovrappone: solo pannelli in pagina.

---

## 18. Stack e strumenti

> Verificato il 18 agosto 2026. Le voci di supporto browser vanno ricontrollate prima di
> iniziare a costruire: si muovono, e alcune fonti già oggi si contraddicono, in particolare
> su Safari e le transizioni fra pagine diverse.

Next.js App Router su Vercel, come impone il PRD.

### Base

- **Tailwind v4 su token propri.** Colore, materia e luce come variabili CSS: l'ora del
  giorno è un cambio di variabili, non di componenti.
- **Radix primitives** invece di shadcn/ui preso così com'è, che porta un'estetica già decisa
  da disfare quasi ovunque.
- **i18n con stringhe fuori dal codice fin dall'inizio.** Date e numeri sulla lingua del
  browser.
- **Nessuna libreria 3D. Nessuna libreria di smooth scroll.**

### Movimento

| Strumento | A cosa serve | Stato ad agosto 2026 |
|---|---|---|
| **Motion** (`motion/react`) | Sollevamento, fisarmonica, taglio della pagina | v12 anima direttamente valori oklch e oklab; scroll accelerato in hardware; `animateView()` gratuito nel core da giugno 2026 |
| **GSAP** | Rotazione del dorso in copertina, se Motion non basta | Gratuito dal 30 aprile 2025, plugin del Club compresi (MorphSVG, DrawSVG), licenza estesa all'uso commerciale |
| **View Transitions** | Rito di apertura | Dentro la stessa pagina ormai disponibile ovunque. Fra pagine diverse ancora in movimento. **Miglioramento progressivo, mai fondamenta** |
| **Animazioni CSS guidate dallo scroll** | Fisarmonica, striscia agganciata | ~82,6% di supporto; Firefox 152 ancora dietro un flag; priorità Interop 2026. Girano sul compositore, **solo se si animano transform e opacity** |
| **`sibling-index()`** | Scaglionare la fisarmonica senza JavaScript | Chrome e Safari stabili |
| **Query `scroll-state`** | Sollevare il dorso agganciato al centro su mobile | Chrome e Safari stabili |

### Tipografia

- **Literata** come serif: commissionata da Google per Play Books, licenza SIL Open Font,
  versione variabile. Il suo asse di dimensione ottica regola contrasto e proporzioni fra
  corpo testo e corpo display: **è l'asse che permette a sentenza (19px) e appunto (15px) di
  essere lo stesso carattere.**
- **`text-wrap: balance`** sui titoli. È costoso e non ha effetto oltre le sei righe su
  Chrome e dieci su Firefox, quindi va solo lì.
- **`text-wrap: pretty`** sui paragrafi lunghi, contro la parola orfana in ultima riga.

---

## 19. Priorità dello sforzo

### Il diamante: lo scaffale

È l'unico posto dell'app dove **il dato diventa materia**: l'altezza è le pagine, il colore è
la copertina, il nastro è lo stato. Tre dimensioni di informazione dentro un oggetto che
sembra un libro e non un grafico. Prima cosa che si vede a ogni sessione, identità visiva, e
la cosa che nessuna app concorrente fa.

Tutto lo sforzo di raffinatezza va lì: venatura, ombra sotto la mensola, fisarmonica, bordo
di luce, autori accostati. **Se lo scaffale è perfetto e il resto è solo pulito, l'app è
splendida. Se lo scaffale è mediocre, nessun'altra animazione lo salva.**

### Le ciliegine, in ordine

1. **Gli insight incisi.** Cuore emotivo invece che identità visiva, e il posto dove l'asse
   ottico di Literata ripaga davvero.
2. **Il segnalibro trascinabile.** L'unico caso in cui una regola di validazione diventa
   fisica. Piccolo, ripetuto, trasforma la schermata più noiosa nella più soddisfacente.
3. **La luce continua.** Non si nota mai, ed è il suo pregio.
4. **Il rito di apertura.** La ciliegina meno preziosa, perché con le View Transitions lo
   avranno tutti. Farlo bene senza spenderci settimane.
5. **Il taglio della pagina.** Raro nell'uso, ma è l'unico gesto che qualcuno racconterà a
   voce a un amico.

### I falsi diamanti

3D vero. Suono. Parallasse e scroll rallentato, che tolgono il controllo all'utente e in tre
giorni diventano fastidiosi su un'app d'uso quotidiano. Grana animata. Transizioni di pagina
ovunque: se ogni navigazione ha la sua animazione, il rito di apertura non è più un rito, è
la norma.

---

## 20. Le lamentele del settore

Sintesi delle recensioni a una e due stelle delle cinque app più installate (Goodreads,
StoryGraph, Fable, Hardcover, Bookly), maggio 2026.

### Già risolte per costruzione

| Lamentela | Perché non ti riguarda |
|---|---|
| Interfaccia ferma al 2013, ricerca lenta, molti tocchi per cambiare scaffale | App nuova, e le azioni stanno sul dorso |
| Paywall sulle statistiche di base | Istanza privata |
| Feed, club e consigli di influencer che intralciano chi legge da solo | Il PRD esclude feed, notifiche, commenti |
| Ludicizzazione paternalistica, sfida annuale demotivante | Il PRD esclude obiettivi, sfide, serie. **Tenerle fuori anche post MVP** |
| App mobile che arranca dietro al web | Parità decisa |

### Dove Montaigne è peggio di tutta la categoria

**L'esportazione.** Le altre app perdono note e date migrando; Montaigne non ha esportazione,
non ha backup sul piano gratuito, e la cancellazione è immediata. Il PRD lo dichiara come
lacuna nota. È l'unica dimensione in cui sei sotto a tutti, e riguarda anni di insight
scritti a mano.

**Il catalogo.** Edizione sbagliata o libro assente sono la lamentela più diffusa del
settore, e tu hai l'aggravante che il libro non trovato non si può aggiungere affatto. Il
design non risolve la deduplicazione, ma può distinguere sempre "non esiste" da "il catalogo
non risponde", e rendere facile la richiesta al manutentore.

### Il rischio specifico del modello

Il tracciamento pagina per pagina sposta l'attenzione dalla lettura alla registrazione, e se
il tracciamento sembra un compito a casa si smette di farlo. Il PRD moltiplica per dieci le
scritture rispetto al conteggio a fine lettura: **hai costruito il modello che rende il
fenomeno più probabile.**

Contromisure, già nel documento: azioni dal dorso, salvataggio ottimistico, tastiera
numerica, invio che salva.

### La regola contro la monotonia

**La varietà deve venire dai dati, non dalla decorazione.** Un'app diventa monotona quando
ogni schermata ha la stessa forma indipendentemente da cosa contiene.

Montaigne ha quattro sorgenti di varietà che non costano nulla e non stancano, perché sono
conseguenze del contenuto e non animazioni: lo scaffale cambia man mano che la libreria
cresce, e non c'è una libreria uguale a un'altra; la luce cambia con l'ora, quindi l'app
delle nove di sera non è quella delle otto del mattino; gli insight cambiano forma secondo la
lunghezza, quindi la stessa schermata legge diversa su libri diversi; gli Annali cambiano di
anno in anno.

**La fine di un libro merita un momento, l'avanzamento no.** È la regola che tiene lontana la
monotonia senza scadere nella ludicizzazione: chiudere una lettura è l'unico evento dell'anno
che vale una piccola cerimonia. Se festeggi tutto, non hai festeggiato niente.

---

## 21. Da verificare

Quattro punti che si risolvono provandoli con contenuti veri, non discutendone.

1. **Lo scaffale a mensole su mobile**, mai provato. È l'unica scelta del documento presa
   senza verifica, e la striscia orizzontale ha già insegnato che provare cambia il verdetto.
2. **La soglia fra sentenza e appunto**, indicata a ~200 battute.
3. **Il serif grande su un insight lungo:** regge le frasi brevi, va provato su un paragrafo
   di appunti pratici.
4. **Il perimetro della traduzione**, che il PRD stesso rinvia alla fase di costruzione.

## Lacuna segnalata sul PRD

**Il Libro non ha descrizione.** Deciso di lasciarlo così. Conseguenza accettata: per sapere
di cosa parla un libro l'utente esce dall'app. Google Books la fornirebbe quasi sempre,
quindi la porta resta aperta post MVP.
