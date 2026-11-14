# Manutenzione

## Nessuna sezione amministrativa dentro Montaigne

[ADR 0007](adr/0007-amministrazione-fuori-dal-prodotto.md) regge su un argomento solo, ma basta da
solo: non esiste alcuna infrastruttura di ruoli. `app/core/security.py` non li conosce, `utente`
non ha una colonna ruolo, non c'è claim custom. Un `/admin` in-app richiederebbe policy RLS con un
ramo «a meno che non sia admin» su ogni tabella, e un backend che per quelle rotte usi
`service_role` invece dell'identità dell'Utente — la deroga che ADR 0006 e ADR 0016 tengono
stretta.

Il costo non è la pagina. È quel ramo, moltiplicato per ogni tabella, per sempre.

La manutenzione si fa quindi in Supabase Studio: invito dei membri, correzione delle schede,
fusione dei duplicati. Le operazioni ricorrenti sul catalogo sono descritte più sotto, in
«Manutenzione del catalogo», con le query pronte in `supabase/manutenzione/catalogo/ricette.sql`.

## Cosa NON fare

- **Metriche utenti.** Studio dà già i conteggi. E `GET /utenti` non calcola apposta il totale
  membri: è una scelta di prodotto, non una dimenticanza da colmare.
- **Credere che correggere le pagine sul Libro ripari le Voci.** Il conteggio autorevole è
  `voce_di_libreria.pagine_adottate`, per Utente ([ADR 0003](adr/0003-conteggio-pagine-su-voce-di-libreria.md)).
  Sul Libro c'è solo `pagine_mediane_catalogo`, che precompila le Voci **alla nascita** e non entra
  in nessuna metrica. Correggerlo serve a chi aggiungerà il libro dopo; le Voci già esistenti e
  vuote vanno riempite a parte (ricetta 7b).
- **Creare un Libro con un `INSERT`.** Né `libro` né `autore` né `libro_riferimento_esterno` si
  scrivono a mano per far nascere una scheda: da SQL non si raggiungono i cataloghi, la scheda nasce
  senza identificativi e il recupero copertina non parte mai. Si semina (ricetta 4a).
- **Riscrivere descrizioni a mano.** Le producono i lavori `standardizzazione_descrizione` e
  `traduzione_descrizione`. Il rimedio è riaccodare, non editare.

## Due voci senza tetto, da guardare a mano

Non le sorveglia nessuno e nessun degrado automatico le protegge:

- **Spazio immagini** (Storage → bucket `copertine`). Cresce col catalogo condiviso, non col numero
  di utenti. Stima: ~100 KB per libro.
- **Spesa dei modelli.** È la sola voce che può crescere senza preavviso.

I progetti Supabase gratuiti vengono inoltre sospesi dopo una settimana di scarsa attività.

## Manutenzione del catalogo

Le operazioni che servono di tanto in tanto per tenere il catalogo condiviso in ordine. Le query
stanno in `supabase/manutenzione/catalogo/ricette.sql`, numerate come le sezioni qui sotto; qui
c'è il perché e ciò che è facile sbagliare.

### Prima di tutto: il worker deve essere sveglio

La macchina Fly si sospende quando nessuno usa l'app (`min_machines_running = 0`), e il worker dei
lavori gira dentro lo stesso processo: **una coda accodata a macchina ferma non avanza**. Prima di
aspettare dei risultati, svegliarla con una richiesta qualsiasi (`curl https://montaigne.fly.dev/health`).
Se dopo il risveglio i lavori pronti restano `in_attesa` per più di un minuto, il worker è appeso:
`fly machine restart <id>`.

Il ritmo si governa con `esegui_dopo`, non nel codice. Ogni lavoro ha **3 tentativi**
(`worker.MAX_TENTATIVI`) con attese di 30 s, 2 min e 10 min: una fonte che risponde a raffica 429 o
503 li brucia in un quarto d'ora. Per richiamarla piano si azzerano i tentativi e si distanziano i
lavori (ricetta 2b).

### 1. Il controllo di salute

La ricetta 1 è una sola query che restituisce una riga di contatori; sono tutti 0 quando il
catalogo è in ordine. Va lanciata prima e dopo ogni intervento.

### 3. Copertine

Il lavoro `copertina` prova le fonti in quest'ordine e si ferma alla prima immagine che passa i
controlli (non è il segnaposto grigio di Google, ha le proporzioni di una copertina):

1. `url_immagine`, se presente: un indirizzo https scelto a mano;
2. il volume Google principale;
3. gli ISBN, il principale e poi `isbn13_alternativi` (fino a 6);
4. `open_library_work_ids`: la prima copertina dell'opera (`OL…W`) o di un'edizione (`OL…M`).

`assente` è un esito e non un errore: tutte le fonti hanno risposto senza immagine. Per riprovare
con tutti gli identificativi della scheda, ricetta 3b.

Quando nessuna fonte automatica ha la copertina:

- **Un'edizione italiana su Open Library** (ricetta 3d): `/works/<OL…W>/editions.json` elenca le
  edizioni con lingua e `covers`; se ce n'è una italiana con copertina, si passa il suo `OL…M`.
  Si usa anche quando la copertina automatica è di un'edizione straniera.
- **Un indirizzo scelto a mano** (ricetta 3c). Il server si presenta col proprio `User-Agent`
  (`app/cataloghi/agente.py`) e non lo maschera mai: le fonti che rifiutano i client automatici non
  vanno aggirate. Misurato: IBS e laFeltrinelli rispondono 429 a qualunque client che non sia un
  browser; `https://img.illibraio.it/images/<isbn13>_0_536_0_75.jpg`, il CDN dei librai del gruppo
  GeMS, risponde e copre anche editori fuori dal gruppo. Prima di accodare, aprire l'immagine e
  guardarla: deve essere quella dell'edizione giusta.

### 4. Aggiungere opere al catalogo

L'unica via è la catena di risoluzione, raggiunta dall'API (`POST /libri`, anche tramite
`backend/scripts/importa_libreria.py` per le librerie degli Utenti) o dal lavoro `semina_libro`
(ricetta 4a) per le schede senza Voce. La semina riesce anche quando non trova nulla: dopo, la
ricetta 4b dice se la scheda è nata e com'è.

Cosa aumenta le corrispondenze:

- **Il titolo dell'edizione che si vuole**, non una traduzione d'epoca: «Il grande amico Meaulnes»
  porta a un volume degli anni Cinquanta senza ISBN, «Il grande Meaulnes» all'edizione corrente.
- **Più grafie dell'autore nello stesso elenco** («Lev Tolstoj», «Lev Tolstoy»): il confronto è sul
  cognome, e i cataloghi traslitterano in modi diversi.
- **Il titolo originale** quando quello italiano non trova nulla («The Power of Now» per «Il potere
  di adesso»): la variante italiana arriva comunque da Wikidata.

Ciò che la semina non trova si aggiunge dall'app, scegliendo l'edizione fra i risultati.

Dopo ogni semina guardare la scheda nata (ricetta 6a). Gli errori tipici sono un'edizione in
un'altra lingua per i titoli uguali ovunque, e un anno di edizione al posto di quello di prima
pubblicazione.

### 5. Doppioni

`fondi_libro(sopravvissuta, duplicata)` sposta riferimenti esterni e Voci, con letture,
avanzamenti, recensioni, insight e note, sulla sopravvissuta, e cancella la duplicata. Se lo stesso
Utente ha una Voce su entrambe le consolida, tenendo voto e recensione più recenti; si ferma senza
scrivere nulla se tutte e due hanno una lettura aperta. La ricetta 5c lo dice prima.

Le proposte di `proposta_fusione_libro` vengono dalla deduplicazione assistita e vanno lette con
sospetto: il modello accoppia volentieri due opere diverse dello stesso autore con trame simili.
Si fonde con 5d, si scarta con 5b.

Una scheda sbagliata **senza Voci** si corregge o si fonde; una scheda sbagliata **con Voci** si
fonde sempre nella scheda giusta, mai cancellata.

### 6. Correggere una scheda

- **Anno.** È quello di prima pubblicazione dell'opera, mai dell'edizione. I record poveri di Open
  Library e le ristampe moderne portano l'anno dell'edizione: un classico «del 2021» è quasi sempre
  questo. Ricetta 6b.
- **Autore.** Prima di rinominare si guarda se esiste già con il nome giusto (6c). Il nome variante
  è unico in tutto il catalogo: se la grafia giusta è già variante di un altro autore, quello è un
  doppione.
- **Riferimenti esterni** (6e). Si aggiungono solo dopo aver verificato che l'opera Open Library e
  l'elemento Wikidata siano quelli giusti e non siano già su un'altra scheda: la coppia
  `(fonte, identificativo)` è unica. Wikidata a volte punta a un identificativo Open Library che è
  un rinvio (`/type/redirect`): conta l'opera di destinazione. Un riferimento sbagliato è peggio di
  uno mancante, perché fa riconoscere come «già nota» un'opera diversa alla prossima aggiunta.
- **Descrizioni.** Non si scrivono a mano: si cancellano quelle sbagliate e si riaccoda il lavoro
  `descrizione` con i titoli delle pagine Wikipedia (6e).
- **Lingua originale.** Codice ISO 639-1 (`grc` per il greco antico), mai il nome: lo impone un
  CHECK.

### 7. Pagine

Il trigger `trg_voce_precompila_pagine` riempie `pagine_adottate` solo all'inserimento della Voce.
Una Voce nata su una scheda senza pagine, o spostata da `fondi_libro`, resta vuota anche dopo che
la scheda le ha avute. La ricetta 7b scrive la scheda e le sole Voci vuote.

Due effetti da sapere:

- su una Voce `letto` con una lettura datata, scrivere le pagine genera l'avanzamento finale
  automatico alla data di fine, e quelle pagine entrano nelle metriche dell'anno: è voluto;
- abbassare le pagine sotto un avanzamento già registrato è rifiutato. Se l'avanzamento è
  automatico (`generato_automaticamente`), si abbassa prima quello.

Le pagine sbagliate più comuni vengono da Google: `1` per alcune edizioni digitali, e la lunghezza
di una guida didattica quando una scheda ne ha assorbito l'ISBN. La ricetta 7c le trova.

## Popolamento del catalogo

La semina fa nascere schede che nessun Utente ha ancora chiesto, così che il catalogo locale non
parta vuoto. **Percorre la stessa catena delle aggiunte, non una parallela**: il gestore
`app/lavori/semina.py` trova l'opera su Google e la passa a `ricerca_service.assicura_scheda`, la
stessa funzione che serve `POST /libri`. Una scheda seminata è indistinguibile da una aggiunta da
un Utente e nessuna colonna le separa — se lo facesse, ADR 0002 avrebbe due identità invece di una.
L'unica cosa che la semina non fa è creare una Voce.

| dove | cosa |
|---|---|
| `backend/dati/semina/raccogli_da_open_library.py` | raccoglie i candidati da Open Library |
| `backend/dati/semina/opere.json` | la lista, 1815 opere |
| `backend/dati/semina/genera_accodamento.py` | produce l'SQL, con il ritmo come parametro |
| `supabase/manutenzione/semina/accoda_opere.sql` | l'istruzione da incollare in SQL editor |
| `supabase/manutenzione/semina/stato_semina.sql` | avanzamento, fallimenti, riaccodamento |
| `backend/app/lavori/semina.py` | il gestore |

Procedura passo per passo: `supabase/manutenzione/semina/COME_PROCEDERE.md`.

**Il ritmo sta nel dato, non nel codice.** L'`insert` scagliona `esegui_dopo`, perché il vincolo
non è la coda — che ne smaltirebbe una al secondo — ma la quota giornaliera di Google Books,
condivisa con le ricerche degli Utenti. Una semina che la esaurisce non rallenta se stessa: fa
fallire la ricerca a chi sta usando l'app.

Tre cose imparate costruendola, che varrebbe la pena non riscoprire:

1. **La lista di Open Library non è un canone.** `sort=readinglog` dà la classifica del suo
   pubblico, che è self-help anglofono; `sort=editions` da solo fa entrare atlanti, agende e libri
   da colorare. Servono due rami e una soglia di lettori sul secondo.
2. **Il confronto sul titolo si normalizza sul più LUNGO dei due.** Misurato: cercando "Nineteen
   Eighty-Four" di Orwell, Google restituisce un'antologia intitolata "George Orwell: 1984 /
   Nineteen Eighty-Four", che contiene tutte le parole attese. Normalizzando sul più corto
   prendeva punteggio pieno, e la scheda nasceva con l'anno dell'antologia (1980) al posto di
   quello dell'opera (1949) — un errore plausibile, quindi invisibile.
3. **I titoli in una terza lingua non si agganciano.** La lista porta il titolo canonico di Open
   Library, che per "L'alchimista" è "O Alquimista"; Google interrogato con `country=IT` non li
   collega e l'opera non viene seminata. È un esito, non un errore: la query 6 di
   `stato_semina.sql` le fa riemergere, e si riseminano a mano.

Nota di perimetro: «nessuna importazione da servizi terzi» riguarda la **libreria di un Utente**
da Goodreads e simili, non la semina del catalogo condiviso. `libri_popolari` non è toccata: legge
`voce_di_libreria`, non `libro`.
