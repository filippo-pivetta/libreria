# Nome dell'app: Montaigne

> ⚠️ STATUS: DRAFT / BOZZA EVOLUTIVA
> Linee guida di business, non prescrizioni tecniche. Usa questo documento
> per capire l'INTENTO; proponi architetture migliori dove le vedi.

## Obiettivo

Montaigne è una web app dove un gruppo di lettori registra i libri letti e da leggere, ne traccia l'avanzamento, ci deposita recensioni e insight, e ne ricava metriche annuali sulle proprie abitudini di lettura, con visione reciproca delle librerie tra utenti collegati.

## Attori e ruoli

**Utente (lettore registrato)**
- Può: gestire la propria libreria; cambiare stato di lettura; registrare avanzamenti, letture, riletture, pause e abbandoni; assegnare un voto in stelle e scrivere una recensione per libro; scrivere più insight per libro; scrivere note private di intenzione; decidere la visibilità dei contenuti scritti; correggere il numero di pagine sulla propria copia; consultare le proprie metriche; vedere libreria e metriche degli utenti collegati; consultare l'elenco dei membri e inviare richieste di collegamento; cancellare il proprio account dalle impostazioni.
- Non può: modificare o cancellare contenuti altrui; leggere contenuti privati altrui; vedere libreria, metriche o contenuti di un utente non collegato.

**Utente collegato**
- Relazione reciproca, nata da richiesta e accettazione. Tre stati: assente, in attesa, attiva.
- Concede visione di libreria, stati, avanzamenti, voti, metriche e contenuti condivisi. Nessuna interazione: niente commenti, reazioni, messaggi.
- Entrambe le parti possono interromperla in qualsiasi momento, senza alcuna notifica esplicita all'altro; l'effetto è simmetrico, e chi è stato rimosso se ne accorge non trovando più la libreria.

**Manutentore (fuori dal prodotto)**
- Non è un ruolo dell'app: tutti gli Utenti dentro Montaigne hanno gli stessi poteri.
- Fuori dall'app, sulla piattaforma dati: crea utenti, credenziali e nomi utente; corregge i generi; mantiene l'elenco chiuso; crea a mano le schede dei libri assenti da entrambi i cataloghi; fonde le schede duplicate. Nessuna di queste operazioni ha un'interfaccia nel prodotto.
- L'istanza resta chiusa: si entra solo se il Manutentore crea l'account. Modalità di ingresso diverse sono rinviate.
- È titolare del trattamento dei dati dei membri. Nel prodotto non esiste alcun account privilegiato; sulla piattaforma dati ha però accesso tecnico a tutto, note di intenzione comprese. La riservatezza delle note è garantita dall'app, non dall'infrastruttura, ed è una condizione che i membri devono conoscere.

**Accesso**
Si entra con le credenziali che il Manutentore ha creato sulla piattaforma di autenticazione e consegnato fuori dall'app. Al primo accesso l'Utente accetta l'informativa, e l'accettazione è registrata come dato dell'Utente insieme allo stato del consenso all'elaborazione assistita. La sessione è persistente e si rinnova da sola; quando scade durante la scrittura, la riautenticazione avviene nella stessa pagina, senza ricaricarla e senza perdere il testo. Il recupero delle credenziali passa dal Manutentore, fuori dall'app.

**Utente non autenticato**
- Nessun accesso oltre alla schermata di accesso.

## Entità del dominio

**Libro**
Una sola scheda per opera, mai per edizione. L'identità della scheda è l'identificativo dell'opera del catalogo canonico, risolto a partire dall'ISBN dell'edizione trovata o, in mancanza, da titolo e autore; quando nemmeno quello esiste, la scheda nasce con un identificativo proprio e resta segnalata come non canonicalizzata. Il riconoscimento di una scheda già esistente avviene su quell'identificativo, mai sul titolo. Due Utenti che aggiungono la stessa opera partendo da volumi diversi ricadono quindi sulla stessa scheda; se i due volumi risolvono su identificativi diversi, nascono due schede e il caso rientra nella deduplicazione. Porta autori, generi, lingua originale, anno di prima pubblicazione e un titolo canonico che serve a identificare l'opera, non a essere mostrato.
L'anno è quello della prima pubblicazione dell'opera, mai la data dell'edizione letta: per un classico ristampato l'anno dell'edizione sarebbe plausibile e sbagliato, e l'errore passerebbe inosservato. La lingua è quella in cui l'opera è stata scritta, che non coincide con la nazionalità dell'autore e non è la lingua dell'edizione. La nazionalità dell'autore non viene registrata.
Quando il catalogo non fornisce anno o lingua, il valore viene dedotto dal modello e conservato come dedotto, distinguibile da quello proveniente dalla fonte. Entrambi i campi sono conservati ma non alimentano alcuna metrica in questa versione. Dato condiviso tra tutti gli utenti.

**Copertina**
Immagine dell'opera, recuperata alla nascita della scheda preferendo la fonte con i termini d'uso più aperti e ricorrendo all'altra solo se la prima non ne ha, e conservata dal sistema in due formati, una miniatura per gli elenchi e una versione più grande per la scheda del libro. Le immagini sono compresse con perdita non percepibile, non bit per bit: sulle copertine la compressione senza perdita guadagna poco. Miniatura con lato lungo di 200 pixel, versione grande di 600, in un formato moderno a qualità alta.
Recuperata una volta, la copertina non dipende più dalla fonte: l'app la mostra anche se il catalogo cambia indirizzo o non risponde. Se la fonte non ne fornisce alcuna, compare un segnaposto con titolo e autore.
Sono immagini editoriali di terzi conservate sul sistema, L'esposizione è contenuta dal fatto che l'app non è accessibile senza autenticazione e non è indicizzabile, quindi le copertine non sono raggiungibili pubblicamente. È una zona grigia contrattuale assunta consapevolmente, con la conservazione preferita alla dipendenza da un servizio esterno.

**Variante di titolo**
Il titolo di un'opera in una lingua. Non esiste alcun campo fisso per lingua: ogni variante è una voce a sé che dichiara la propria lingua, e un'opera ne ha quante ne fornisce il catalogo, anche nessuna. È un dato che le fonti forniscono in modo parziale e disomogeneo: la maggior parte delle opere avrà una sola variante, e il ripiego sul titolo canonico sarà frequente. Aggiungere o togliere una lingua supportata non modifica la struttura, aggiunge o toglie varianti.
Il titolo mostrato si sceglie in quest'ordine: la variante nella lingua dell'interfaccia scelta da chi guarda; altrimenti il titolo canonico. Non esiste un livello intermedio legato all'edizione, perché l'edizione non è un'entità del modello. Si mostra un titolo solo, mai l'originale accanto alla traduzione.

**Genere**
Elenco chiuso definito dal Manutentore fuori dall'app, dell'ordine di venticinque-trenta voci, tutte sullo stesso piano. Ogni genere ha un'identità stabile che non è una parola: il Libro punta a quella, mai all'etichetta. Le parole che l'utente legge sono etichette separate, una per lingua, modificabili senza toccare alcun libro e senza invalidare le metriche degli anni passati. Non contiene formati (ebook, graphic novel) né il livello superiore narrativa/saggistica, che sporcherebbe la metrica facendo ricadere lo stesso libro in due voci sovrapposte. Le etichette vanno scelte vicine alle categorie di primo livello della fonte bibliografica, così la mappatura automatica ricorre al modello il meno possibile. Riferimenti del settore: 58 generi su StoryGraph mantenuti da bibliotecari, circa trenta in evidenza su Goodreads, categorie derivate dallo standard editoriale BISAC su Google Books. Il genere appartiene al Libro, è universale e uguale per tutti, e non è correggibile localmente. Un'opera ne porta da uno a tre: costringere "Sapiens" a scegliere tra storia e scienza produrrebbe una classificazione arbitraria. Nelle metriche il peso si ripartisce tra i generi assegnati, come per gli autori, così un libro vale sempre uno. Si assegnano una volta sola alla nascita della scheda, mappando i soggetti dei cataloghi esterni sull'elenco e ricorrendo al modello linguistico dove la mappatura non decide. Se nessuna delle due vie è sufficiente, l'opera resta "non classificato", visibile a tutti come tale. Nessun Utente può correggerlo, e nel prodotto non esiste alcuna via per segnalarlo: gli errori si comunicano fuori dall'app e si correggono sulla piattaforma dati.
L'elenco è fissato e non cambia nell'MVP: nessuna procedura di modifica o di riclassificazione in blocco fa parte di questa versione. Le correzioni puntuali su singole schede avvengono fuori banda e si riflettono immediatamente per tutti.

**Pagine adottate**
Il numero di pagine non appartiene al Libro ma alla Voce di libreria, perché varia legittimamente da edizione a edizione: due Utenti che leggono la stessa opera in edizioni diverse hanno totali diversi, ed è corretto. Arriva precompilato con un valore rappresentativo, cioè la mediana delle edizioni per cui il catalogo dichiara un conteggio pagine, senza chiedere all'Utente quale edizione abbia letto, e l'Utente può correggerlo sulla propria copia. La correzione è necessaria quando il dato ereditato è sbagliato, come negli audiolibri le cui ore finiscono nel campo delle pagine, oppure quando la sua edizione differisce sensibilmente da quella rappresentativa.
È l'unico campo bibliografico correggibile dal singolo Utente. Anno di prima pubblicazione, lingua originale, autori e generi appartengono all'opera e sono uguali per tutti: se ciascuno potesse correggerli per sé, due persone vedrebbero dati diversi sulla stessa opera senza alcun fondamento. Gli errori su questi campi si correggono una volta sola, fuori dall'app, per tutti.

**Autore**
Come il Genere, ha un'identità stabile che non è una stringa: i Libri puntano a quella, non al nome scritto. I cataloghi restituiscono nomi non normalizzati, e senza identità "J.R.R. Tolkien" e "John Ronald Reuel Tolkien" diventerebbero due autori, frammentando in silenzio la metrica degli autori più letti. La riconduzione di nomi diversi allo stesso autore è una delle funzioni assistite. Ogni riconduzione resta registrata e reversibile fuori banda: un errore fonde due autori distinti nelle metriche di tutti, e senza traccia non ci sarebbe modo di accorgersene né di disfarlo.

**Voce di libreria**
L'istanza personale di un Libro. Porta stato corrente, pagine adottate, voto, recensione, insight, nota di intenzione, storico delle Letture.
L'Utente può correggere e cancellare ogni contenuto proprio: avanzamenti sbagliati, Letture aperte per errore, insight, recensioni, note, e la Voce intera. Nessuna correzione è irreversibile, con l'unica eccezione della cancellazione dell'account.

**Lettura**
Un passaggio attraverso il Libro: data di inizio, data di fine, esito (conclusa o abbandonata), avanzamenti. Entrambe le date sono scelte dall'Utente, con il giorno corrente come predefinito: è ciò che permette di registrare letture concluse prima di usare l'app, senza le quali una libreria storica collasserebbe tutta sulla data di inserimento. La data di fine non può precedere quella di inizio né l'ultimo avanzamento. Più Letture per Voce: è così che si rappresenta una rilettura senza cancellare la precedente.

**Avanzamento**
Registrazione della pagina raggiunta dentro una Lettura, con data scelta dall'Utente. L'incremento di un avanzamento è la differenza con la pagina dell'avanzamento precedente della stessa Lettura, o con zero se è il primo: le pagine lette di un periodo sono la somma degli incrementi datati in quel periodo, mai la somma delle pagine raggiunte. Il predefinito è oggi; la data non può precedere l'avanzamento precedente né essere futura, e la pagina non può essere inferiore a quella già raggiunta: un avanzamento che torna indietro viene rifiutato, come una data fuori ordine. Se la Voce non ha pagine adottate, gli avanzamenti sono comunque ammessi e le loro pagine contano; manca soltanto la percentuale di avanzamento, e un incremento fuori scala produce un avviso, non un rifiuto. È l'unità su cui si contano le pagine lette.

**Stato di lettura**
Cinque stati, uno per Voce: da leggere, in lettura, in pausa, abbandonato, letto. Lo stato descrive dove l'Utente è adesso; lo storico delle Letture descrive cosa ha fatto. I due possono divergere, ed è corretto: una Voce già letta, riletta e poi abbandonata sta in "abbandonato" mentre la metrica continua a contare il libro come finito nell'anno della prima conclusione.
- "in lettura" e "in pausa": Lettura aperta. La pausa non ha effetti sulle metriche di questa versione, distingue soltanto una lettura ferma da una attiva.
- "abbandonato": Lettura chiusa con esito abbandono; valgono gli avanzamenti registrati.
- "letto": Lettura chiusa con esito conclusione. La chiusura genera automaticamente un avanzamento finale alle pagine adottate, datato al giorno di fine lettura, così che un libro finito conti tutte le sue pagine e non solo quelle registrate strada facendo; non lo genera se l'ultimo avanzamento è già a quel valore, né se la Voce non ha pagine adottate. L'avanzamento generato non è un dato inserito dall'Utente: si adegua da solo se le pagine adottate vengono corrette, in aumento come in diminuzione, e per questo non blocca la correzione del totale, che resta sempre possibile.

Transizioni ammesse:
- da leggere → in lettura: apre una Lettura.
- in lettura ↔ in pausa: nessun effetto sulla Lettura aperta.
- in lettura o in pausa → letto: chiude la Lettura con esito conclusione.
- in lettura o in pausa → abbandonato: chiude la Lettura con esito abbandono.
- letto o abbandonato → in lettura: apre una Lettura nuova; è la rilettura, e vale anche per riprendere un libro abbandonato tempo prima.
- letto o abbandonato → da leggere: ammesso, non chiude né apre nulla; serve solo a rimettere in coda un libro.
- in lettura o in pausa → da leggere: annulla la Lettura aperta e i suoi avanzamenti, ed è l'unico modo per disfare una Lettura aperta per errore.
- Da "da leggere" non si passa direttamente a letto o abbandonato: senza una Lettura aperta non c'è nulla da chiudere.
Le transizioni non elencate sono vietate. Cancellando una Lettura, la Voce assume lo stato che deriva dalle Letture rimaste: quello dell'ultima chiusa, oppure "da leggere" se non ne resta nessuna. Gli insight legati a una Lettura cancellata restano sulla Voce, senza più alcuna Lettura associata.

**Voto** Da 1 a 5 stelle intere, uno per Voce. Una rilettura non lo azzera: resta quello finché l'Utente non lo cambia. Segue la Voce: sempre visibile ai collegati, non ha visibilità propria.

**Recensione** Una per Voce. Una rilettura non la cancella: resta quella finché l'Utente non la riscrive, e in quel caso la precedente non viene conservata. Condivisa per default, cioè visibile ai soli Utenti collegati; l'Utente può renderla privata in qualsiasi momento. Nessun limite di lunghezza.

**Insight** Testo libero senza struttura, nessun limite di lunghezza. Più di uno per Voce, ciascuno con la propria data e legato alla Lettura aperta se ce n'è una, così che dopo una rilettura si sappia da quale passaggio proviene. Scrivibile in qualunque stato, anche prima di cominciare il libro. Condiviso per default con i soli Utenti collegati, con visibilità decisa uno per uno e reversibile. Contrassegno spoiler disponibile, spento di default.

**Nota di intenzione** Attributo della Voce di libreria, una per Voce: perché ho aggiunto il libro, chi me l'ha consigliato. Privata per costruzione, senza alcun interruttore di visibilità, perché contiene abitualmente nomi di persone che non sono nell'app ed è l'unico spazio del prodotto scritto senza pubblico.

**Metrica di lettura**
Aggregato su anno solare per singolo Utente: libri finiti, pagine lette, autori più letti, generi principali.
I libri finiti sono le Letture chiuse con esito conclusione nell'anno: due riletture concluse nello stesso anno contano due, coerentemente con il fatto che l'unità è la Lettura e non il Libro. Le pagine lette sono la somma degli incrementi datati nell'anno. Autori più letti e generi principali sono classifiche di libri finiti, non di pagine, con il peso di ciascun libro ripartito tra i suoi autori e tra i suoi generi; i libri senza genere restano fuori dalla classifica dei generi, quindi la somma dei pesi dei generi è inferiore al numero di libri finiti, e lo scarto è dichiarato accanto alla classifica.
Il giorno, l'anno e il concetto di "futuro" si valutano sul fuso orario dell'Europa centrale, uguale per tutti gli Utenti indipendentemente da dove si trovino.
Non è un dato conservato: si calcola dai dati di lettura ogni volta che viene richiesta. Non esiste alcuna fotografia di fine anno, quindi non esistono due verità che possono divergere quando una pagina viene corretta o un avanzamento aggiunto. L'unica istantanea prevista è la card del recap post MVP, che è un artefatto destinato a uscire dall'app e va fissato al momento in cui viene generato.

**Funzioni assistite da modello**
Otto funzioni distinte, con rischi diversi. Le prime tre lavorano su soli dati bibliografici, non toccano nulla di personale e restano sempre attive, fuori dal consenso; le altre cinque toccano contenuti dell'Utente e sono soggette al consenso.
- classificazione del genere dove la mappatura non decide, e deduzione di anno di prima pubblicazione e lingua originale quando il catalogo non li fornisce (agiscono su dato condiviso);
- riconduzione a un'identità unica dei nomi d'autore restituiti in forme diverse dai cataloghi (agisce su dato condiviso);
- deduplicazione e pulizia dei metadati, incluso il riconoscimento di opere identiche in edizioni diverse e delle pagine anomale (agisce su dato condiviso);
- suggerimenti di lettura a partire dal solo storico personale, mai da quello dei collegati: funzione a sé, che propone cosa leggere;
- preview personalizzata invocata da un pulsante sulla scheda del singolo libro, del tipo "me lo consigli?", che dà un parere su quel titolo a partire dallo storico e dagli insight di chi la chiede: privata per costruzione, non condivisibile, e distinta dai suggerimenti di lettura, che invece propongono titoli senza che tu ne indichi uno;
- ricerca semantica sulla propria libreria e sui propri insight, mai sui contenuti condivisi dai collegati: cercare dentro i testi altrui richiederebbe un consenso che nessuno ha prestato;
- sintesi tematica trasversale dei propri insight tra libri diversi;
- acquisizione di una citazione da foto della pagina, tramite modello visivo in un'unica passata invece di OCR seguito da ripulitura.

**Artefatto generato**
Preview personalizzata o sintesi tematica prodotta su richiesta esplicita dell'Utente e conservata nella sua libreria: la preview è legata alla Voce da cui è stata invocata, la sintesi sta a sé. Sono contenuti dell'Utente, sempre privati, mai condivisibili, cancellabili come gli altri e travolti dalla cancellazione dell'account.

**Foto della pagina**
Immagine caricata per estrarne una citazione. Viene inviata al fornitore, usata per produrre il testo e poi eliminata: il sistema non la conserva, quindi non pesa sullo spazio immagini e non compare in alcuna vista. Ciò che resta è l'insight che ne è nato.

**Avviso di visibilità**
Riga fissa nelle impostazioni: "I tuoi collegati vedono la tua libreria, gli stati di lettura, gli avanzamenti, i voti, le metriche e, salvo che tu li renda privati, le tue recensioni e i tuoi insight. Le note restano sempre e solo tue."

**Consenso all'elaborazione assistita**
Interruttore nel profilo dell'Utente, accompagnato da questo testo: "Consenti l'elaborazione assistita. I testi che scrivi, insight e recensioni compresi, e le foto che carichi vengono inviati a OpenAI per generare consigli, sintesi e ricerche. Non vengono usati per addestrare modelli e restano nei loro sistemi fino a trenta giorni. Disattivando, queste funzioni si spengono e gli indici di ricerca costruiti sui tuoi testi vengono cancellati." L'interruttore nasce acceso: accettare l'informativa al primo accesso è condizione per entrare, e da quel momento l'Utente può spegnerlo quando vuole. Copre le cinque funzioni che toccano dati personali: preview personalizzata, suggerimenti di lettura, ricerca semantica, sintesi tematica, acquisizione da foto. Non copre classificazione dei generi, deduplicazione dei metadati e riconduzione degli autori, che lavorano su soli dati bibliografici e restano sempre attive.
Le note di intenzione non vengono mai inviate al fornitore né indicizzate, in nessuno stato del consenso: contengono abitualmente nomi di persone che non sono nell'app e non hanno prestato alcun consenso.
Revocandolo, le cinque funzioni si spengono e gli indici semantici costruiti sui contenuti dell'Utente vengono cancellati; riattivandolo si ricostruiscono in blocco. Gli artefatti già generati, cioè preview personalizzate e sintesi tematiche salvate, restano nella libreria dell'Utente come contenuti suoi: non se ne producono di nuovi, ma quelli esistenti non vengono toccati. La revoca vale per il futuro; ciò che è già stato inviato al fornitore non è richiamabile, e la riga accanto all'interruttore si limita a dire che le funzioni si spengono.

**Collegamento tra utenti** Relazione reciproca, nata sempre da una richiesta accettata, revocabile da entrambi senza notifica esplicita: chi viene rimosso non riceve alcun avviso, ma se ne accorge non trovando più l'altro.
Le richieste hanno una superficie dedicata nel profilo, che mostra sia quelle ricevute, da accettare o rifiutare, sia quelle inviate, da revocare finché sono in attesa. È l'unico posto in cui compaiono, dato che l'app non ha notifiche; un contatore accanto alla voce di menu segnala quante ne sono in attesa, altrimenti una richiesta potrebbe restare invisibile per sempre. Un rifiuto riporta la relazione allo stato assente, senza traccia visibile a chi ha chiesto, e la richiesta può essere reinviata: non esiste blocco, coerentemente con un gruppo chiuso e a invito.

**Elenco dei membri**
Elenco dei nomi utente visibile a tutti gli autenticati, unico strumento per trovare qualcuno e inviargli una richiesta. Accanto a ciascun nome compare lo stato della relazione con chi guarda, cioè assente, in attesa o attiva, perché altrimenti si invierebbero richieste alla cieca; non espone le relazioni tra terzi, né libri, metriche o contenuti.
Il nome utente è assegnato dal Manutentore alla creazione dell'account, è univoco, non modificabile dall'Utente, e deve essere riconoscibile dagli altri membri, altrimenti l'elenco non serve a trovare nessuno.

## Ownership dei dati

Visibilità a due livelli, senza eccezioni.
- **Condiviso**: visibile ai soli Utenti collegati con relazione attiva. È il default di recensioni e insight.
- **Privato**: visibile al solo proprietario. È lo stato che l'Utente sceglie quando vuole tenere qualcosa per sé, ed è l'unico stato possibile per le note di intenzione.

Non esiste alcun livello rivolto agli utenti registrati in quanto tali, né ora né dopo l'apertura della registrazione.

| Entità | Proprietario | Chi altro la vede |
|---|---|---|
| Voce di libreria e stato | L'Utente | I collegati, sempre, coda "da leggere" compresa: la libreria non ha visibilità propria |
| Lettura e avanzamenti | L'Utente | I collegati |
| Voto in stelle | L'Utente | I collegati, sempre |
| Recensione | L'Utente | I collegati per default, nessuno se resa privata |
| Insight | L'Utente | Come sopra, deciso per singolo insight |
| Nota di intenzione | L'Utente | Nessuno, mai |
| Metriche | L'Utente | I collegati |
| Pagine adottate | L'Utente | I collegati, come la Voce |
| Nome utente | L'Utente | Tutti gli autenticati, via elenco membri |
| Libro | Nessuno, dato condiviso di sistema | Tutti gli utenti |
| Collegamento | I due Utenti | I due Utenti |

## Comportamento

1. Il Manutentore crea a mano utente e credenziali sulla piattaforma dati e li consegna al membro. Al primo accesso il membro accetta l'informativa sull'invio dei propri contenuti al fornitore di modelli. Nessun collegamento nasce da questo passaggio: tutte le relazioni si creano da richiesta e accettazione.
2. L'Utente consulta l'elenco dei membri e invia richieste di collegamento. Finché la richiesta non è accettata, nessuno dei due vede nulla dell'altro.
3. L'Utente cerca l'opera per titolo o autore. La ricerca interroga prima le schede già esistenti nel sistema, comprese quelle create a mano fuori banda, e poi i cataloghi esterni; i risultati sono presentati insieme, senza distinzione. non esistono altre vie d'ingresso, né codice digitato né scansione. Nasce una Voce con stato "da leggere", con il numero di pagine precompilato a un valore rappresentativo che l'Utente può correggere. Se il Libro è già in libreria, l'app non lo duplica: se la Voce è in "letto" o "abbandonato" propone di aprire una nuova Lettura, altrimenti si limita a portare l'Utente sulla Voce esistente.
4. L'Utente può allegare una nota di intenzione privata.
5. Se il numero di pagine ereditato è sbagliato o assente, l'Utente lo corregge sulla propria copia.
6. All'inizio della lettura lo stato passa a "in lettura" e si apre una Lettura.
7. Durante la lettura l'Utente registra gli avanzamenti indicando la pagina raggiunta, e crea insight, visibili ai collegati dal momento del salvataggio salvo che li renda privati, con eventuale contrassegno spoiler.
8. Se la lettura si interrompe, l'Utente mette in pausa o dichiara l'abbandono. Gli avanzamenti registrati restano validi in entrambi i casi.
9. A libro concluso lo stato passa a "letto" e la Lettura si chiude.
10. L'Utente assegna il voto e scrive la recensione, entrambi visibili ai collegati salvo che renda privata la recensione.
11. Le metriche si aggiornano: le pagine nell'anno in cui sono state registrate, il libro finito nell'anno di chiusura.
12. L'Utente consulta le metriche scegliendo un anno tra il primo in cui ha dati e quello corrente, estremi inclusi; gli anni futuri non sono selezionabili, e un anno intermedio senza letture mostra zeri, non un errore.
13. L'Utente apre la libreria di un collegato e ne vede libri, stati, avanzamenti, voti, metriche e contenuti condivisi.
14. Per rileggere, riporta la Voce a "in lettura": nasce una seconda Lettura e lo storico resta. Voto e recensione restano quelli della lettura precedente finché l'Utente non li cambia.
15. In qualsiasi momento l'Utente può cancellare il proprio account dalle impostazioni. La conferma consiste nel digitare il proprio nome utente; la cancellazione è immediata, definitiva, senza periodo di grazia e senza esportazione offerta. Travolge in cascata libreria, letture, avanzamenti, voti, recensioni, insight, note, preview personalizzate, indici semantici derivati e collegamenti.

**Post MVP**
- Modalità di ingresso diverse dalla creazione manuale: da decidere in versioni successive.
- Raccomandazioni basate sullo storico, con rifiuto permanente di titoli e autori e affinità calcolata su chi valuta gli stessi libri allo stesso modo.
- Recap periodico in card condivisibile: nessun contenuto privato può finirci dentro, e la condivisione esce dal perimetro chiuso, quindi è pubblicazione consapevole e irreversibile. Richiederà periodi diversi dall'anno solare.

## Regole invalicabili

1. Un contenuto privato non è mai restituito a nessuno oltre al proprietario, collegati inclusi.
 *Test:* A crea recensione, insight e nota privati; B collegato interroga ogni vista; nessuno compare.
2. Recensioni e insight nascono condivisi con i soli collegati, mai oltre; le note di intenzione nascono private e restano tali.
 *Test:* creare i tre contenuti senza indicare la visibilità; i primi due risultano visibili ai collegati e a nessun altro, la nota a nessuno.
3. Una nota di intenzione non ha alcuna operazione che possa renderla visibile.
 *Test:* tentare ogni scrittura sulla sua visibilità; tutte rifiutate.
4. A un Utente non collegato non è mai visibile alcun dato di lettura altrui: né libreria, né stati, né avanzamenti, né voti, né contenuti, né metriche. Restano visibili a tutti soltanto i dati condivisi del catalogo e i nomi utente dell'elenco membri.
 *Test:* A condivide voto, recensione e insight; C non collegato interroga ogni vista e ogni identificatore noto di quei dati; rifiuto. La scheda del Libro resta invece accessibile a C.
5. Nessun Utente può creare, modificare o cancellare contenuti altrui: nel prodotto non esiste alcun account con privilegi superiori. I lavori in secondo piano operano con un'identità tecnica che non serve mai richieste di Utenti e può soltanto produrre dati derivati, mai leggere o alterare contenuti per conto di qualcuno.
 *Test:* B tenta ogni scrittura sui dati di A; rifiuto, dati invariati. Nessun ruolo applicativo consente di aggirarlo.
6. Nessun dato di lettura e nessun file conservato dal sistema, copertine comprese, è accessibile senza autenticazione, e nessuna pagina dell'app è indicizzabile.
 *Test:* richiesta anonima a qualunque indirizzo di contenuto e a qualunque indirizzo di immagine; rifiuto in entrambi i casi. Verifica delle direttive di esclusione dei crawler.
7. Una richiesta di collegamento in attesa non concede alcuna visibilità.
 *Test:* A invia richiesta a B; nessuno dei due vede nulla dell'altro finché B non accetta.
8. Interrotto il collegamento, ogni visibilità cessa in entrambe le direzioni dalla richiesta successiva.
 *Test:* B vede la libreria di A; A interrompe; B ripete e riceve rifiuto, e lo stesso vale per A verso B.
9. Un cambio di visibilità ha effetto immediato.
 *Test:* B legge un insight condiviso di A; A lo rende privato; alla richiesta successiva non lo trova.
10. Un insight contrassegnato spoiler non è mai restituito in chiaro in elenchi o anteprime.
 *Test:* B apre ogni vista che elenchi insight di A; il testo appare solo dopo azione esplicita.
11. Un Libro genera al massimo una Voce per libreria; la rilettura produce una nuova Lettura, non una seconda Voce.
 *Test:* aggiungere due volte la stessa opera; una sola Voce esiste.
12. I libri finiti di un anno corrispondono alle Letture chiuse con esito conclusione in quell'anno.
 *Test:* chiudere due Letture della stessa Voce in anni diversi; ciascun anno ne conta una.
13. Un abbandono non incrementa mai il conteggio dei libri finiti, ma non annulla le pagine registrate.
 *Test:* chiudere una Lettura con esito abbandono; conteggio libri invariato, pagine invariate.
14. Dentro una Lettura la somma degli incrementi non supera mai le pagine adottate per la Voce, quando queste esistono; se la Voce non ha pagine adottate non si applica alcun tetto. Letture diverse sulla stessa Voce hanno conteggi indipendenti, quindi una rilettura conta di nuovo le stesse pagine.
 *Test:* registrare avanzamenti fino al totale e tentarne uno oltre: rifiutato. Aprire una seconda Lettura e verificare che il conteggio riparta da zero. Su una Voce senza pagine adottate, verificare che nessun avanzamento venga rifiutato per superamento.
15. Un avanzamento non può essere datato prima dell'avanzamento precedente della stessa Lettura, né a una data futura.
 *Test:* tentare l'inserimento con data anteriore al precedente e con data futura; entrambi rifiutati.
16. La correzione locale dei metadati non altera i dati visti da altri Utenti.
 *Test:* A corregge le pagine; metriche e vista di B restano invariate.
17. Le metriche di un Utente sono calcolate solo sui suoi dati.
 *Test:* variare i dati di B; le metriche di A non cambiano.
18. Un libro con più autori distribuisce il proprio peso tra loro: la somma dei contributi resta pari a un libro.
 *Test:* registrare un libro a tre autori; la somma dei pesi in "autori più letti" vale uno, non tre.
19. Nessun contenuto appartenente a un Utente diverso da chi ha richiesto l'operazione viene mai inviato a un fornitore esterno di modelli.
 *Test:* eseguire ogni funzione assistita di A e ispezionare il contenuto inviato; nessun testo, voto o dato di lettura di B vi compare.
20. Una preview generata non supera le ottanta parole, non contiene testo tra virgolette e riporta l'indicazione di essere una sintesi generata.
 *Test:* generare preview su un campione di libri e verificare le tre condizioni, che sono misurabili senza possedere l'originale.
21. Il genere non è modificabile da alcun Utente attraverso l'app: è dato condiviso, corretto solo fuori banda.
 *Test:* ogni tentativo di scrittura sul genere da parte di qualsiasi Utente viene rifiutato.
22. Una correzione di genere effettuata fuori banda è visibile a tutti gli Utenti dalla richiesta successiva, e nessuna esecuzione automatica la sovrascrive.
 *Test:* correggere un genere sulla piattaforma dati, verificarne la comparsa per ogni Utente, aggiungere altri libri e verificare che il valore corretto resti.
22bis. Un nome d'autore ricondotto a un'identità esistente non crea un secondo autore nella metrica.
 *Test:* aggiungere due libri con il nome dello stesso autore scritto in forme diverse; in "autori più letti" compare una voce sola.
23. Una preview personalizzata non è mai condivisibile né visibile ad altri, perché deriva da contenuti privati.
 *Test:* generare una preview personalizzata di A; nessuna vista di B la contiene e nessuna operazione può renderla condivisa.
24. Gli indici della ricerca semantica sono soggetti alle stesse regole di accesso dei contenuti da cui derivano.
 *Test:* interrogare la ricerca semantica come B su contenuti privati di A; nessun risultato, nemmeno parziale o in forma di estratto.
25. Finché la scheda del browser resta aperta, un testo in corso di scrittura sopravvive alla scadenza della sessione e a un errore di rete.
 *Test:* far scadere la sessione e interrompere la rete durante la scrittura di un insight lungo; il testo è ancora lì e si salva dopo la riautenticazione. Fuori da questo ambito, cioè scheda chiusa o macchina riavviata, non è garantito nulla.
26. La cancellazione dell'account rimuove ogni dato appartenente all'Utente, senza residui interrogabili da alcun attore.
 *Test:* cancellare l'account di A; verificare che nessuna vista di B e nessuna interrogazione della ricerca semantica restituisca contenuti, metriche o tracce di A.
27. La cancellazione non tocca i dati condivisi che non appartengono all'Utente: schede dei Libri e generi restano.
 *Test:* cancellare l'account di A, che aveva creato la scheda di un libro; la scheda esiste ancora nella libreria di B.
28. La cancellazione dell'account non è mai eseguita senza che l'Utente abbia digitato il proprio nome utente nella stessa sessione.
 *Test:* invocare la cancellazione senza conferma, e con una stringa di conferma errata; in nessuno dei due casi viene rimosso alcun dato.
29. La cancellazione ha effetto immediato dentro il perimetro del sistema: nessun dato dell'Utente vi sopravvive in attesa di una scadenza. Resta fuori dal perimetro ciò che è già stato inviato al fornitore di modelli, soggetto alla sua ritenzione.
 *Test:* cancellare l'account e interrogare subito ogni vista, ogni indice e lo spazio file; nessuna traccia.
30. Con il consenso revocato, nessuna delle cinque funzioni che toccano dati personali viene eseguita, e nessun indice semantico costruito su quei contenuti sopravvive.
 *Test:* revocare il consenso di A; invocare ciascuna delle cinque funzioni e verificare che non partano; interrogare gli indici e non trovare vettori derivati da contenuti di A.
31. La classificazione dei generi e la deduplicazione dei metadati non inviano mai contenuti dell'Utente, e restano attive anche a consenso revocato.
 *Test:* revocare il consenso, aggiungere un libro, ispezionare il contenuto inviato: soli dati bibliografici.
32. La revoca del consenso non cancella né altera contenuti già presenti nella libreria dell'Utente, artefatti generati inclusi.
 *Test:* generare una preview personalizzata e una sintesi tematica, revocare il consenso, verificare che siano ancora leggibili dal proprietario e che non se ne possano creare di nuove.

## Casi limite

**Accesso a dati altrui**
- Richiesta diretta di un contenuto privato altrui di cui si conosce l'identificatore: rifiuto indistinguibile da quello di un contenuto inesistente.
- Collegamento interrotto: cadono insieme libreria, avanzamenti, voti, metriche e contenuti condivisi.
- Richiesta di collegamento reinviata dopo un'interruzione: ammessa. Nessun blocco previsto.
- Modalità di ingresso diverse dalla creazione manuale: rinviate, e con esse ogni valutazione sull'elenco membri e sulla crescita del gruppo.

**Operazioni ripetute o concorrenti**
- Stessa opera aggiunta due volte: l'app riconosce la Voce esistente. Propone una nuova Lettura solo se la Voce è chiusa, cioè in "letto" o "abbandonato"; se è in "da leggere", "in lettura" o "in pausa" non c'è nulla da aprire e l'Utente viene portato sulla Voce.
- Due Letture aperte contemporaneamente sulla stessa Voce: impedito.
- Due sessioni registrano avanzamenti in contemporanea: le scritture vengono serializzate e prevale la pagina più alta; la seconda non crea un secondo avanzamento con la stessa data e lo stesso valore.
- Insight reso privato e poi di nuovo condiviso in rapida successione: stato finale deterministico, nessun lettore riceve un contenuto tornato privato.
- Insight salvato durante la lettura: raggiunge i collegati immediatamente, spoiler compresi se il contrassegno non è stato acceso. È la conseguenza diretta dei due default aperti.
- Richiesta di collegamento inviata due volte, o inviata da entrambi in contemporanea: nasce una sola relazione.

**Fallimenti parziali**
- Fonte primaria irraggiungibile o senza risultati: si interroga la fonte di ripiego. Se l'opera non esiste in nessuna delle due, non si aggiunge: l'Utente non può creare schede a mano, e il libro va inserito fuori dall'app. Nessun campo viene riempito con valori inventati.
- Opera trovata sulla fonte primaria ma senza corrispondenza sul record canonico: la scheda nasce comunque, con il titolo disponibile come canonico.
- Anno o lingua assenti dal catalogo: il modello li deduce e il valore resta marcato come dedotto, mai confuso con un dato di fonte.
- Anno disponibile solo come data dell'edizione: non viene usato come anno di prima pubblicazione.
- Traduzione che il catalogo non collega all'originale: nascono due schede distinte per la stessa opera. Le metriche di ciascun utente restano corrette, ma nel confronto tra librerie la stessa lettura appare come due libri diversi. È il caso che la deduplicazione assistita deve intercettare alla nascita della scheda.
- Duplicati scoperti quando entrambe le schede hanno già Voci e Letture: la fusione avviene fuori banda. Se due Voci dello stesso Utente ricadono sulla scheda superstite, diventano una sola che conserva tutte le Letture, gli avanzamenti, gli insight e le note; voto e recensione più recenti prevalgono, gli altri si perdono.
- Nessuna variante di titolo nella lingua dell'interfaccia: si mostra il titolo canonico. Non esiste il caso di un titolo vuoto.
- Soggetti esterni senza corrispondenza nell'elenco chiuso: l'opera resta senza genere, esce dalla metrica dei generi, resta in tutte le altre.
- Voci prive di pagine adottate: contano le sole pagine che l'Utente ha registrato a mano, e il numero di libri senza totale è dichiarato accanto alla somma, che non viene mai presentata come completa.
- Correzione delle pagine o aggiunta di un avanzamento dopo aver consultato le metriche: alla consultazione successiva i numeri cambiano, perché riflettono sempre lo stato attuale dei dati. È il comportamento voluto.
- Salvataggio di un insight fallito o sessione scaduta durante la scrittura: bozza locale continua, testo mantenuto sullo schermo, riautenticazione senza ricaricare la pagina.

**Permessi mancanti**
- Credenziali smarrite: il recupero avviene fuori dall'app, sulla piattaforma dati.
- Nuovo membro appena entrato: non è collegato a nessuno, quindi non vede nulla e nessuno vede lui, finché non parte una richiesta.
- Utente collegato che tenta una scrittura su contenuti altrui: rifiuto senza modifica.
- Utente rimosso fuori banda: libreria, letture, contenuti e metriche sono cancellati, senza esportazione preventiva. Le schede dei Libri e le correzioni di genere restano, perché sono dato condiviso e non gli appartengono.
- Rimozione per errore o ripensamento: nessun recupero possibile. Non esiste periodo di grazia.
- Cancellazione autonoma dell'account: stessa cascata della rimozione fuori banda. L'Utente perde tutto, insight compresi, senza esportazione. È il comportamento voluto.
- Cancellazione mentre un collegato sta guardando la libreria: le viste in corso smettono di restituire dati alla richiesta successiva. L'app non dichiara che l'account è stato cancellato, ma non pretende di nascondere l'evento: la scomparsa dall'elenco membri lo rende evidente.
- Cancellazione dell'account personale di chi mantiene l'istanza: rimuove solo la sua libreria, non la sua capacità di manutenzione, che vive fuori dall'app. Nessun privilegio applicativo va perduto.
- Cancellazione con operazioni assistite in corso: le richieste pendenti al fornitore di modelli non devono poter scrivere dati su un account che non esiste più.

**Valori al confine**
- Avanzamento a una pagina inferiore alla precedente: rifiutato. Chi ha digitato un valore sbagliato corregge o cancella l'avanzamento invece di compensarlo con un altro.
- Avanzamento oltre il totale della Voce: rifiutato finché il totale non viene corretto. Se il totale non esiste, nessun tetto si applica e l'unico presidio è l'avviso sugli incrementi fuori scala.
- Correzione del numero di pagine con avanzamenti già registrati: il totale è un tetto, non un moltiplicatore. Gli avanzamenti già registrati restano intatti e continuano a contare, il nuovo valore vale come tetto per gli avanzamenti successivi, e la correzione è rifiutata se il nuovo totale è inferiore a un avanzamento già inserito.
- Libro senza pagine adottate: entra nel conteggio dei libri finiti; nelle pagine conta solo ciò che l'Utente ha registrato a mano.
- Primo avanzamento di una Lettura: parte da pagina zero, anche in una rilettura, perché ogni Lettura ha il proprio conteggio indipendente.
- Pagine ereditate palesemente errate, tipicamente ore di audiolibro trascritte come pagine: l'Utente le corregge sulla propria copia.
- Lettura a cavallo di due anni: libro attribuito all'anno di chiusura, pagine attribuite per data di registrazione. I due numeri divergono, ed è voluto.
- Lettura conclusa a fine dicembre e registrata a gennaio: l'Utente data l'avanzamento al giorno reale e le pagine restano nell'anno vecchio. Se non lo fa, cadono nell'anno nuovo mentre il libro resta nel vecchio.
- Avanzamento retrodatato che modifica il totale di un anno già consultato: ammesso, entro il vincolo di monotonia. I numeri passati non sono immutabili.
- Genere errato: resta quello finché non viene corretto fuori banda; nessuna correzione provvisoria locale, nessuna segnalazione in-app.
- Modello non disponibile o in errore: l'aggiunta del libro procede, il genere resta "non classificato" e la funzione assistita fallisce senza bloccare il flusso.
- Copertina assente alla nascita della scheda: segnaposto con titolo e autore, senza ulteriori tentativi automatici.
- Fonte non raggiungibile al momento dell'aggiunta: la scheda nasce senza copertina; il recupero non blocca l'inserimento del libro.
- Spazio immagini in esaurimento: è la voce che consuma più spazio dell'intero sistema e cresce con il catalogo condiviso, non con il numero di utenti. Non esiste alcun degrado automatico: il controllo è manuale e fuori banda, come per la spesa dei modelli.
- Foto della pagina illeggibile: nessun testo inventato, errore esplicito.
- Ricerca semantica invocata a consenso revocato: l'interfaccia dichiara che la funzione è disattivata, invece di restituire zero risultati come se non ci fosse nulla da trovare.
- Consenso riattivato dopo una revoca: gli indici si ricostruiscono in blocco, e finché non sono pronti la ricerca semantica è incompleta e lo dichiara.
- Citazione acquisita da foto prima della revoca: è diventata un insight dell'Utente, quindi resta come qualunque altro suo testo.
- Artefatti generati e poi consenso revocato: restano visibili al solo proprietario, non escono più e non se ne generano altri.
- Anno senza letture concluse ma con avanzamenti: libri finiti a zero, pagine diverse da zero.
- Insight o recensione di dimensione fuori scala: nessun limite imposto, quindi nessun rifiuto previsto.
- Utente senza collegamenti: vista amici vuota, non un errore.

## Scala attesa

- Utenti: unità o decine, con account creati a mano fuori dall'app. La crescita è limitata dal fatto stesso che ogni ingresso è un'operazione manuale.
- Volumi: decine di Voci per Utente all'anno, decine di avanzamenti per libro, insight nell'ordine delle unità o decine per libro. Il tracciamento progressivo moltiplica per circa dieci le scritture rispetto al conteggio a fine lettura.
- Carico: interattivo e sporadico, con letture delle metriche molto più frequenti delle scritture.
- Nessun requisito di latenza o disponibilità dichiarato. Nessuna scadenza di rilascio.

## Vincoli esterni

- Stack imposto: Next.js, FastAPI, Supabase. Il front end sta su Vercel; il back end, che è l'unico a interrogare i cataloghi, sta su un ambiente con indirizzo di uscita stabile in Europa, quindi non serverless.
- Fonte bibliografica primaria: Google Books, per copertura del catalogo italiano e qualità della ricerca. Richiede chiave API. Google dichiara di avere in licenza gran parte dei dati che alimentano il servizio e di non essere libera di ridistribuirli; i termini impongono la rimozione su richiesta dei contenuti lesivi di diritti di terzi e un contatto per i titolari; i risultati variano in base all'IP del server, perché rispettano le restrizioni legali del paese. La conservazione permanente di una copia locale è terreno grigio contrattuale.
- Fonte di ripiego e record canonico: Open Library. Gratuita, senza chiave, con separazione nativa tra opera ed edizione, dati riutilizzabili senza vincoli. Non supporta CORS, va interrogata dal back end. Limite di cortesia osservato attorno a 100 richieste ogni 5 minuti per IP.
- Attrito noto e accettato: Google Books non ha il concetto di opera, ogni volume è un'edizione. La regola di una scheda per opera richiede quindi una deduplicazione a carico del sistema.
- Amministrazione interamente fuori dal prodotto: creazione degli account e dei nomi utente, credenziali, correzione dei generi, elenco chiuso, creazione manuale delle schede assenti dai cataloghi e fusione dei duplicati avvengono sulla piattaforma dati. L'app non contiene alcuna funzione amministrativa né alcun account privilegiato.
- Interfaccia bilingue italiano e inglese dal primo giorno, limitata al minimo essenziale nell'MVP; il perimetro esatto della traduzione si definisce in fase di costruzione. Le email non esistono nel prodotto, perché credenziali e recupero passano fuori dall'app; errori, conferme e stati vuoti seguono la lingua dell'interfaccia. I contenuti scritti dagli utenti non vengono tradotti; i generi appartengono all'elenco chiuso, non alla lingua della fonte. Le stringhe vanno tenute fuori dal codice fin dall'inizio; date e numeri seguono la lingua del browser.
- Mobile e desktop hanno pari importanza, con il mobile a fare da riferimento principale nei casi di dubbio: gli usi rapidi e sul momento (registrare un avanzamento, controllare la libreria di un collegato, scrivere un insight in coda) sono più probabili da telefono, quindi ogni schermata va progettata e verificata mobile-first e poi estesa al desktop, non il contrario.
- Fornitore di modelli linguistici e visivi: OpenAI. Sull'API i dati inviati non vengono usati per l'addestramento, e i log per il monitoraggio degli abusi sono conservati fino a trenta giorni salvo obblighi di legge. La ritenzione zero richiede approvazione preventiva su contratto dedicato e non si applica agli account standard: la condizione di riferimento resta quindi trenta giorni. Nessun tetto di spesa impostato nel sistema: il controllo è manuale, fuori dal prodotto.
- Gli Utenti hanno acconsentito all'invio dei propri contenuti, comprese recensioni e insight lasciati privati. Restano fuori dal consenso, e quindi non escono mai, le note di intenzione e ogni contenuto appartenente ad altri Utenti.
- Gli indici della ricerca semantica risiedono nello stesso sistema dei dati, sotto le stesse regole di accesso, senza copie dei contenuti privati presso servizi terzi.
- Alcune operazioni non stanno dentro il tempo di una richiesta e presuppongono lavori in secondo piano con uno stato osservabile: ricostruzione degli indici semantici, recupero e conversione delle copertine, riconduzione degli autori, deduplicazione. Quando un lavoro è in corso, le funzioni che ne dipendono lo dichiarano invece di restituire risultati parziali senza spiegazione.
- Le regole su chi vede cosa vivono nel database, come regole di riga applicate a ogni interrogazione, e il back end opera con l'identità dell'Utente e non con una chiave di servizio che le scavalcherebbe. È l'unico modo perché valgano anche sugli indici semantici, come impone la regola 24, e perché una nuova vista non possa dimenticarle. La chiave di servizio resta riservata ai lavori in secondo piano, che non rispondono a richieste degli Utenti.
- Le chiamate ai cataloghi partono dal back end ospitato con indirizzo di uscita stabile in Europa. Un ambiente serverless con indirizzi variabili renderebbe i risultati di Google Books dipendenti dal paese del nodo, e siccome la scheda si crea una volta e vale per tutti, congelerebbe nella libreria di tutti ciò che ha risposto a quel particolare nodo.
- Ogni interrogazione dei cataloghi avviene dal lato server, per entrambe le fonti: una parte delle chiamate fatta dal client renderebbe le schede condivise dipendenti dalla geografia di chi le ha create.
- La cancellazione a cascata deve raggiungere anche ciò che non vive nel database, cioè copertine, immagini e indici, e vale anche quando un utente viene rimosso direttamente sulla piattaforma dati senza passare dal prodotto.
- Infrastruttura: solo piani gratuiti finché sono sufficienti. Gli indici semantici non hanno un costo proprio, perché la ricerca vettoriale è inclusa nel database; consumano spazio, che sul piano gratuito è limitato. Due limiti pesano più dello spazio: i progetti gratuiti vengono sospesi dopo una settimana di scarsa attività, e non prevedono backup. Quest'ultimo si somma alla scelta di non offrire esportazione e di rendere la cancellazione immediata: sotto i dati non c'è alcuna rete. Le chiamate ai modelli restano l'unica voce di costo variabile e non hanno tetto: è la sola spesa che può crescere senza preavviso.
- Dati personali di terzi su territorio UE: chi mantiene l'istanza è titolare del trattamento. La cancellazione è coperta da una funzione del prodotto. La portabilità non ha alcuna via, né in prodotto né come procedura manuale: è una lacuna nota e accettata per questa versione, non una svista.
- Nessuna scadenza di rilascio.

## Fuori scope

- Qualsiasi interazione sociale oltre la visione reciproca: niente commenti, reazioni, messaggi, feed, notifiche di attività, classifiche.
- Nessun grafo asimmetrico: niente follow, niente liste di seguaci, nessun conteggio di relazioni esposto.
- Nessuna notifica di interruzione di un collegamento, nessun blocco.
- Nessun livello di visibilità rivolto agli utenti registrati in quanto tali.
- Nessun libro nascosto e nessuna parte di libreria riservata: anche la coda dei libri da leggere è visibile ai collegati. Chi non vuole mostrare un titolo lo aggiunge quando lo comincia.
- Nessun accesso senza autenticazione, nessuna indicizzazione, nessuna identità pubblica.
- Nessuna pubblicità, profilazione commerciale o cessione di dati.
- Nessuna importazione da servizi terzi.
- Nessuna funzione amministrativa nel prodotto: niente gestione utenti, niente correzione generi, niente segnalazioni.
- Nessuna creazione manuale di schede da parte degli Utenti, nessun inserimento per ISBN digitato, nessuna scansione del codice a barre: l'unica via d'ingresso è la ricerca per titolo o autore.
- Nessuna scelta dell'edizione: il numero di pagine è precompilato e correggibile, non selezionato da un elenco.
- Nessuna esportazione dei dati nell'MVP. La cancellazione autonoma dell'account invece c'è.
- Nessun avanzamento retrodatato oltre il precedente, né datato nel futuro.
- Nessuna gestione di edizioni, formati, audiolibri, ebook.
- Nessuna struttura sugli insight: niente numero di pagina, niente citazione separata, niente tag personali.
- Nessuna bozza di recensione conservata dal sistema: il salvataggio locale del testo che si sta scrivendo, che vive nel browser e serve solo a non perderlo, non è una bozza e resta ammesso.
- Nessuno storico di voti e recensioni: riscrivendoli si perde la versione precedente, e una rilettura non li azzera.
- Periodi diversi dall'anno solare.
- Raccomandazioni e recap condivisibile: post MVP.
- App native, funzionamento offline, obiettivi di lettura, sfide, scaffali multipli.

## Punti da tenere sotto controllo in costruzione

Non sono requisiti, sono i tre punti in cui il modello può incrinarsi senza dare segnali.

**Deduplicazione delle edizioni.** La fonte primaria non ha il concetto di opera e la regola impone una scheda per opera: il difetto più diffuso del settore, edizioni duplicate che gonfiano le statistiche, rientra da qui se la deduplicazione sbaglia. Ed essendo dato condiviso, un errore si propaga a tutte le librerie.

**Pagine e libri che divergono a cavallo d'anno.** Le pagine seguono la data dell'avanzamento, i libri finiti l'anno di chiusura. È corretto e sembra un errore: va spiegato nell'interfaccia, non corretto nel calcolo.

**Peso delle funzioni assistite.** Otto funzioni di modello dentro un MVP per il resto deliberatamente povero, di cui tre agiscono su dati condivisi da tutti. Se in corso d'opera servisse tagliare, le tre che risolvono problemi già presenti nel modello sono classificazione, deduplicazione e riconduzione degli autori; le altre cinque aggiungono capacità nuove.

## Appendice: elenco dei generi

Ventotto voci, tutte sullo stesso piano. Ogni voce ha un'identità stabile a cui puntano i libri, e due etichette che l'utente legge. Le etichette si possono riscrivere in qualsiasi momento senza toccare alcun libro; le identità no, perché reggono le metriche degli anni passati.

L'elenco è costruito guardando come si comportano le fonti e le app del settore: BISAC, lo standard editoriale che alimenta anche le categorie di Google Books, conta 53 categorie di primo livello e oltre 5700 intestazioni complessive nell'edizione 2025, quindi è una gerarchia da cui attingere, non da copiare, anche perché il suo uso completo dentro sistemi aziendali richiede una licenza a pagamento. StoryGraph ne espone 58, mantenute da bibliotecari volontari; Goodreads circa trenta in evidenza. Ventotto sta nella fascia in cui la mappatura automatica sbaglia poco e i generi principali restano leggibili.

| identità | italiano | inglese |
|---|---|---|
| literary_fiction | Narrativa contemporanea | Literary Fiction |
| classics | Classici | Classics |
| historical_fiction | Romanzo storico | Historical Fiction |
| crime_thriller | Giallo e thriller | Crime & Thriller |
| fantasy | Fantasy | Fantasy |
| science_fiction | Fantascienza | Science Fiction |
| horror | Horror | Horror |
| romance | Rosa | Romance |
| poetry | Poesia | Poetry |
| biography_memoir | Biografie e memorie | Biography & Memoir |
| history | Storia | History |
| philosophy | Filosofia | Philosophy |
| politics_society | Politica e società | Politics & Society |
| economics_business | Economia e impresa | Economics & Business |
| science | Scienze | Science |
| technology | Tecnologia | Technology |
| psychology | Psicologia | Psychology |
| self_improvement | Crescita personale | Self-Improvement |
| health_fitness | Salute e benessere | Health & Fitness |
| religion_spirituality | Religione e spiritualità | Religion & Spirituality |
| art_photography | Arte e fotografia | Art & Photography |
| performing_arts | Musica e spettacolo | Music & Performing Arts |
| travel | Viaggi | Travel |
| nature_environment | Natura e ambiente | Nature & Environment |
| food_cooking | Cucina | Food & Cooking |
| sport | Sport | Sport |
| essays_reportage | Saggi e reportage | Essays & Reportage |
| true_crime | Cronaca nera | True Crime |

**Criteri seguiti.** Nessun formato: ebook, audiolibro, graphic novel e fumetto descrivono come si legge un'opera, non di cosa parla, e mescolarli ai generi sporcherebbe le metriche. Nessun livello superiore: narrativa e saggistica non compaiono come voci, perché ogni libro finirebbe in due caselle sovrapposte e i conteggi si gonfierebbero. Nessuna fascia d'età: ragazzi e young adult indicano il destinatario, non il contenuto. Etichette vicine alle categorie di primo livello delle fonti, così la mappatura automatica ricorre al modello il meno possibile.

**Voci da valutare in seguito.** Teatro, fumetto e graphic novel, letteratura per ragazzi: sono le tre aree che qualcuno potrebbe chiedere per prime. L'elenco però resta fissato per l'MVP, e ogni modifica, con il ripasso delle schede che comporterebbe, è rinviata al momento in cui servirà davvero.

**Non classificato** non è un genere di questo elenco: è l'assenza di genere, e vive come stato della scheda.
