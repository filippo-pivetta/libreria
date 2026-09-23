# AGENTS.md

## Cosa è questo progetto
Montaigne: web app dove un gruppo di lettori registra i libri letti e da leggere, ne traccia
l'avanzamento, ci deposita recensioni e insight, e ne ricava metriche annuali, con visione
reciproca delle librerie fra utenti collegati.

**Scala e ingresso.** Istanza a invito del Manutentore (ADR 0013), cerchia ristretta, decine di
persone. Nessuno può crearsi un account. Dove la scala entra nel codice entra come tetto
esplicito, mai come assunzione che la tabella resterà piccola.

**Attori.** *Utente*: gestisce la propria libreria e i propri contenuti, non tocca né legge quelli
altrui se non condivisi. *Collegamento*: relazione reciproca, nata da richiesta accettata,
interrompibile da entrambi senza notifica; dà visione di libreria, stati, avanzamenti, voti,
metriche e contenuti condivisi, e nient'altro — nessun commento, reazione, messaggio, feed o
notifica. *Manutentore*: opera interamente fuori dal prodotto (ADR 0007), non esiste alcuna
funzione amministrativa né account privilegiato in-app.

**Visibilità, due soli livelli.** *Condiviso* (i soli collegati con relazione attiva, default di
recensioni e insight) e *privato* (solo il proprietario, unico stato possibile per le note di
intenzione). Nessun livello rivolto agli autenticati in quanto tali. Nessun accesso senza
autenticazione, nessuna indicizzazione, nessuna identità pubblica.

**Entità portanti.** *Libro* — una scheda per opera, mai per edizione, dato condiviso da tutti,
con autori, generi (elenco chiuso), lingua originale e anno di **prima pubblicazione**, mai
dell'edizione. *Voce di libreria* — l'istanza personale di un Libro: stato, pagine adottate (il
solo campo bibliografico correggibile dal singolo Utente), voto, recensione, insight, nota di
intenzione, storico. *Lettura* — un passaggio attraverso il libro, più d'uno per Voce (rilettura);
è **chiusa quando ha un esito**, e la chiusura può non avere data. *Avanzamento* — la pagina
raggiunta a una data: le pagine di un periodo sono la somma degli **incrementi** datati in quel
periodo, mai delle pagine raggiunte. *Metrica* — aggregato per anno solare, calcolato a ogni
richiesta e mai conservato (ADR 0004).

**Funzioni assistite.** Quelle su soli dati bibliografici (classificazione generi, riconduzione
autori, deduplicazione) sono sempre attive. Quelle che toccano contenuti dell'Utente stanno dietro
un consenso revocabile, la cui revoca spegne le funzioni e cancella gli indici semantici (ADR
0008). Le note di intenzione non escono mai, in nessuno stato del consenso.

**Fonti.** Google Books primaria, Open Library ripiego e record canonico, Wikidata arricchimento.
Interrogate sempre dal backend, mai dal browser: i risultati di Google dipendono dall'IP del
server e la scheda nasce una volta per tutti (ADR 0001).

Documentazione di riferimento: `docs/design-frontend.md` per la direzione visiva e ogni schermata,
`docs/adr/` per il razionale delle scelte tecniche. Sono guide, non vincoli assoluti: se vedi una
soluzione migliore, proponila invece di seguire la lettera del documento. Una decisione in
`docs/adr/` porta però un perché documentato: per ribaltarla, motivalo esplicitamente.

## Dove sta cosa

### `frontend/` — Next.js 16 (App Router, TS)
- `src/app/` pagine · `src/lib/supabase/{client,server,proxy}.ts` client browser/server/sessione ·
  `src/proxy.ts` (Next 16 sostituisce `middleware.ts`).
- `src/lib/light.ts` — palette del momento, calcolata **lato server** interpolando quattro
  ancoraggi in OKLCH sul fuso CET (design-frontend.md §3). Mai nel browser.
- `src/styles/tokens.css` — unica sorgente di colori/ombre/raggi/tipografia.
  `tokens.anchors.css` è generato da `npm run tokens`, non si modifica a mano.
- `public/sw.js` — service worker: serve `/senza-rete` quando la rete manca, non mette MAI in
  cache dati di lettura (ADR 0019). `public/icone/` generate da `scripts/build-icone.mts`.
- `vercel.json` esiste per una riga sola, `regions: ["fra1"]`: il backend sta ad Amsterdam
  (`backend/fly.toml`, `primary_region = "ams"`) e ogni pagina protetta lo chiama due o tre volte
  in fila. La regione va tenuta uguale anche in Project Settings → Functions su Vercel, che in caso
  di divergenza vince. `preferredRegion` non è la via: in Next 16 è deprecato.
- **`frontend/AGENTS.md` e `frontend/CLAUDE.md` non sono documentazione di progetto**: li scrive
  `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`) e li ricrea se
  cancellati. Contengono solo l'avviso di Next: questa versione ha rotture rispetto ai modelli
  addestrati, quindi prima di scrivere codice Next consulta `node_modules/next/dist/docs/`.

### `backend/` — FastAPI a strati
`app/routers` (HTTP) → `app/services` (orchestrazione) → `app/repositories` (accesso dati).
`app/schemas` contratti Pydantic · `app/models` vuoto · `app/core` settings, client Supabase,
spazio copertine, rate limit.

- `app/cataloghi/` — client di sola lettura verso Google Books / Open Library / Wikidata /
  Wikipedia, ciascuno usato dove è la fonte migliore (vedi i docstring dei moduli).
  `trasporto.py` tiene un client HTTP per fonte aperto per tutta la vita del processo, mai dentro
  un `async with`. `agente.py` è l'unica sorgente del `User-Agent`: presentarsi è una condizione
  d'uso, non cortesia — Wikimedia blocca senza preavviso chi non dà un contatto, Open Library dà
  3 req/s a chi si identifica e 1 a chi resta anonimo.
- Fornitore di modelli in tre moduli: `openai_client.py` trasporto, `llm.py` funzioni
  bibliografiche (mai contenuti di un Utente), `llm_personale.py` funzioni che inviano contenuti
  del solo richiedente. La separazione rende verificabile a colpo d'occhio la regola 19 del PRD
  (ADR 0018): non toglierla.
- `app/lavori/` — coda su tabella Postgres, `FOR UPDATE SKIP LOCKED` (ADR 0016). Un tipo nuovo
  richiede **sia** una migrazione che estenda `chk_lavoro_tipo` **sia** una voce in
  `registro.GESTORI`; un lavoro accodato senza gestore fallisce subito e non ritenta.
- `tests/` pytest.

### `supabase/`
- `migrations/` — unica fonte di verità dello schema, un file per migrazione. Nessun ORM.
- `seed.sql` — dati di sviluppo, applicato da `supabase db reset --local`, mai in produzione.
- `tests/verifica_*.sql` — sei script transazionali (`ROLLBACK` finale) con fixture proprie,
  eseguiti in CI: `verifica_ciclo_di_lettura`, `verifica_catalogo_e_copertine`,
  `verifica_recensioni_insight`, `verifica_consenso_e_indici`, `verifica_quaderni`,
  `verifica_superficie_data_api`.
- `tests/dati_*.sql` — seminano dati di prova per schermate specifiche, non girano in CI.
- `manutenzione/semina/` — popolamento del catalogo, con il suo runbook (`COME_PROCEDERE.md`).

## Gotcha non ovvi
Regole che non si deducono dal codice guardandolo da vicino, e che si violano per distrazione.

**«Aperta» non è «senza data di fine».** Una Lettura registrata a posteriori può essere CONCLUSA
con `data_fine` nulla. L'unico predicato valido per «aperta» è `esito is null`, in SQL come in
Python come in TypeScript. L'anno di chiusura è sempre
`coalesce(anno_fine, extract(year from data_fine))`; `data_inizio` è nullo per queste Letture, e
le metriche di durata le saltano invece di dedurre un inizio. Le loro pagine entrano nel totale
dell'anno leggendo `pagine_adottate` in `metriche_service`, MAI scrivendo un avanzamento con una
data inventata.

**Metriche.** `metriche_repository.list_avanzamenti` legge SEMPRE l'intera storia degli
Avanzamenti, mai filtrata per l'anno richiesto: l'incremento di un Avanzamento dipende dalla
pagina del precedente, che può essere dell'anno prima. Filtrare per anno sbaglia il conteggio a
ogni lettura a cavallo di capodanno.

**Proprietà delle righe.** `GET /voci` e il dedup di `POST /voci` filtrano esplicitamente per
`utente_id`, non solo RLS: un collegato può leggere le stesse righe.

**Spoiler.** Il gating (regola 10 del PRD) vive nel service layer (`insight_service._senza_spoiler`),
non nella RLS — per questo è testato da pytest, non dagli script SQL. Protegge da uno spoiler
*altrui*: `GET /voci/{id}` lo applica solo quando chi guarda non è il proprietario, e
`GET /ricerca/semantica` non lo applica mai, perché lì ogni risultato è già del richiedente.

**Consenso.** Si legge in un punto solo (`app/services/consenso.py::esigi_consenso`); risposta
409 `consenso_revocato`, mai 403 — è una funzione spenta, non un permesso mancante.
Eccezione: `GET /scritti` e `GET /scritti/che-torna` non rispondono mai 409, perché i propri
scritti esistono comunque e solo il modo di interrogarli si spegne; lo stato arriva nel corpo
(`indici_spenti`). A indici spenti il conteggio dei vicini è `null` e **non `0`**.

**Scheda di un libro che non si ha in libreria** (`GET /schede/{fonte}/{id}`): guardare non fa
nascere una scheda. Il ramo `google` legge il volume e si ferma lì; la catena di risoluzione resta
dietro l'aggiunta (ADR 0002). Due conseguenze: `google_books.per_identificativo` DEVE continuare a
riempire la cache `_per_volume`, altrimenti si guarda un libro e poi non lo si può aggiungere; e
l'anno che esce da quel ramo è quello dell'edizione (`anno_di_edizione: true`), mai passato al
modello come anno di prima pubblicazione. Il parere su quella carta non si salva: manca la Voce a
cui legarlo.

**Ricerca locale** (`public.cerca_libri`). Corrisponde per PAROLE, non per sottostringa unica: un
libro passa se le contiene tutte, indifferentemente da titolo canonico, variante o autore — è ciò
che fa funzionare «eco nome della rosa». Il confronto avviene su `libro.testo_ricerca`, colonna
denormalizzata con indice GIN trigram, mantenuta da cinque trigger (`libro`, `variante_titolo`,
`libro_autore`, `autore`, `autore_nome_variante`). Un trigger che manca non rompe nulla di
visibile: rende solo irraggiungibile un libro per una parola che dovrebbe trovarlo.

**Google Books dà `503 backendFailed` a raffiche**, non isolati (misurato: finestre con 40-65% di
fallimenti per una decina di secondi). Da qui il retry di `google_books._get` e quello del
frontend sopra. Due cose da non semplificare: gli alternativi di `opera_per_identificativi` si
raccolgono con `return_exceptions=True` e si lasciano cadere — aggiungono identificativi al
riconoscimento, non lo decidono, e propagarli faceva fallire l'INTERA aggiunta; e
`lib/api/ricerca.ts` ritenta i 503 anche sull'aggiunta, che chiama Google più della ricerca.

**Elenco membri** (`GET /utenti`). Tre gruppi (`richieste_ricevute`, `collegati`, `altri`) e
**nessun conteggio totale dei membri**: non viene calcolato, non aggiungerlo. Solo `altri` ha un
tetto (`utenti_service.LIMITE_ELENCO`, 200) e la fetta arriva da `cerca_membri`, che esclude chi ha
già una relazione **prima** del `LIMIT`. I due gruppi che nascono da una relazione restano sempre
completi: una richiesta nascosta da un tetto non si potrebbe più accettare, un collegamento
nascosto renderebbe irraggiungibile una libreria. `LIMITE_ELENCO` deve restare **sotto** il tetto
di `cerca_membri` (500): un tetto SQL più basso non limita, falsifica — il servizio leggerebbe
«meno del tetto» come «ci sono tutti». `elenco_completo` dice se la ricerca per nome può restare
nel browser; nasce chiedendo una riga in più del tetto e scartandola.

**Ricerca per nome utente** (`cerca_membri`): sottostringa più somiglianza trigram, soglia 0.3
passata come parametro (non letta dalla GUC: una soglia che dipende dalla sessione non è
riproducibile in un test). Ordine: esatto, prefisso, sottostringa, e solo per ultima la
somiglianza — il nome utente è un identificatore, non una frase. Sotto `MIN_QUERY` (2)
l'anagrafica non viene interrogata affatto. Il filtro sui gruppi propri
(`utenti_service._corrisponde`) è sola sottostringa, deliberatamente.

**Ricerca semantica.** `cerca_semantico` filtra per distanza coseno (`p_soglia_massima`, default
0.65): senza soglia un corpus piccolo restituirebbe sempre tutti i vettori. I filtri di
tipo/spoiler/anno/Voce/contenuti entrano **dentro** la RPC, mai a valle: la funzione tiene i venti
più vicini e poi si ferma, quindi filtrare dopo darebbe zero risultati ogni volta che quei venti
sono dell'anno sbagliato.

**Quaderni** (`/scritti`): vista `public.scritto` (`security_invoker`) più `elenco_scritti`,
`sfaccettature_scritti`, `pensiero_che_torna`, `vicini_a`. `vicini_a` non chiama il fornitore — il
vettore è già in `indice_semantico` — ma esige il consenso lo stesso, perché la revoca cancella gli
indici. `pensiero_che_torna` non conserva stato: la scelta è deterministica sul giorno (hash di
`auth.uid()` più la data CET), quindi resta ferma 24h senza una riga da mantenere e da cancellare
con l'account.

**Cancellazioni.** `voci_service.cancella` è una singola `DELETE` sulla riga `voce_di_libreria`:
ogni tabella figlia ha già `ON DELETE CASCADE` verso `(id, utente_id)`, transitiva fino a
`indice_semantico`. `me_service.elimina_account` cancella prima `public.utente` con l'identità
dell'utente (la cascata travolge i dati applicativi), poi chiama l'Auth Admin API per `auth.users`.
Se il secondo passo fallisce resta un residuo in `auth.users` senza retry: pulizia manuale del
Manutentore (ADR 0007). Scelta di semplicità, non un bug.

**Worker.** `worker._lotto` è 3 e il lotto si svolge con `asyncio.gather`, non con un `for`: serve
alla latenza di un singolo gesto (aggiungere un libro accoda sette-otto lavori quasi tutti di
attesa di rete). `return_exceptions=True` non è pigrizia — un `gather` che propaga subito non ferma
le coroutine fratelle, e il ciclo chiuderebbe la connessione mentre una la sta usando. Non alzarlo
senza alzare la memoria in `fly.toml`: la conversione di una copertina tiene l'immagine
decompressa in RAM, e ce ne sono 512MB.

**`GET /health` non tocca il database.** Il controllo di Fly non guarda quel campo e
`database.ping` apre una connessione nuova ogni volta. Per la raggiungibilità di Postgres:
`GET /health?database=1`, a mano.

**Funzioni assistite personali.** Delle cinque del PRD ne sono costruite quattro (ricerca
semantica, preview, suggerimenti di lettura, sintesi tematica); resta l'acquisizione da foto —
vedi `docs/lavoro-rimandato.md`.

## Comandi

**Frontend** (`cd frontend`): `npm run dev` · `build` · `lint` · `type-check` ·
`tokens` (rigenera `tokens.anchors.css`, gira anche come `prebuild`) · `check:contrast` (AA su
tutto l'anno) · `check:messaggi` (catalogo e codice allineati, IT/EN in parità) ·
`icone` (vuole Chrome in locale, non gira in CI, i PNG sono versionati).

**Backend** (`cd backend`, venv attivo): `pip install -e ".[dev]"` · `uvicorn app.main:app --reload` ·
`pytest` · `ruff check . && ruff format --check .` · `mypy app`.

**Supabase locale.** Prima di `supabase start` serve una chiave di firma JWT (ADR 0012):
`supabase gen signing-key --algorithm ES256` scrive in `supabase/signing_keys.json` (mai
committato). Poi `supabase status` per URL e chiavi da mettere in `.env`/`.env.local` (copiati da
`.env.example`). Migrazioni: `supabase migration new <nome>` · `migration up --local` ·
`db reset --local` (riapplica tutto e riesegue `seed.sql`; cancella ogni account di test creato a
mano).

**Verifiche SQL a mano**, durante lo sviluppo di una migrazione:
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<nome>.sql` per tutti e sei gli script,
anche quando la modifica ne riguarda uno solo: una migrazione in un'area può invalidare in
silenzio le fixture di un'altra. `-v ON_ERROR_STOP=1` è essenziale, senza psql prosegue dopo un
fallimento.

**CI** (`.github/workflows/ci.yml`), 4 job: frontend (lint, type-check, tokens, contrast,
messaggi), backend (lint, type-check, test), supabase (le sei verifiche contro un'istanza avviata
nel job), semgrep (`p/default`, diff-aware sulle PR).

**Deploy.** Le migrazioni le applica da sola l'integrazione GitHub di Supabase a ogni merge su
`main`. Il backend **no**: `cd backend && fly deploy`, a mano.

**Autenticazione.** `app/core/security.py` espone `get_current_user`, che verifica il JWT via JWKS
(ADR 0012) e va usata da ogni route che serve dati di un utente — pattern di riferimento in
`app/routers/me.py`.

## Account di test locali
Due account sull'istanza Supabase locale, riusabili per qualunque verifica manuale. Un
`supabase db reset --local` li cancella: vanno ricreati (invito via Admin API o Studio, ADR 0013).

| | Email | Password | Nome utente |
|---|---|---|---|
| Account 1 | `prova@montaigne.test` | `Provaprova123` | `prova` |
| Account 2 | `prova2@montaigne.test` | `provaprova123` | `marta` |

Le due password differiscono perché `config.toml` chiede `lower_upper_letters_digits` e GoTrue non
rivalida le password già impostate: l'Account 2 entra ancora con la vecchia finché nessuno gliela
cambia, l'Account 1 è stato reimpostato e ha dovuto prendere una maiuscola. Se un reset tocca
anche l'Account 2, aggiornare questa riga.

I due sono **collegati con relazione attiva** e `marta` ha una libreria popolata per guardare gli
Annali di un collegato con numeri veri (quindici letture concluse, due abbandoni, una a cavallo
del capodanno, libri senza genere e senza pagine, sei opere in comune con `prova`). Script:
`supabase/tests/dati_collegato.sql`, da riapplicare dopo un reset e dopo aver ricreato i due
account.

Per «I titoli che tornano» (design-frontend.md §13, `public.libri_popolari`) c'è
`supabase/tests/dati_popolari.sql`: dieci lettori che **non sono account utilizzabili** (nessuna
password) e possiedono solo `voce_di_libreria`, che è tutto ciò che quella funzione legge. Crea da
sé i suoi utenti, non richiede nulla prima.

## Sistema di design (frontend)
Dettaglio completo in `docs/design-frontend.md`. `src/styles/tokens.css` è l'unico posto in cui
esistono colori, ombre, raggi e scale tipografiche: nessun componente scrive mai un colore a mano.
Le regole che si violano più facilmente:

- **Tre piani soli**: `surface-0` (stanza, mai testo), `surface-1` (carta), `surface-2` (oggetto
  sollevato). Non esiste un piano 3.
- **Un solo accento** (`accent` per il riempimento, `accent-strong` per testo e icone) e **un solo
  rosso** (`alert`), con due usi in tutta l'app e non uno di più: il contatore delle richieste
  accanto a Lettori e il bordo della zona di cancellazione dell'account (`.zona-pericolo`). Mai
  sugli errori, che sono testo; mai sui nastri, che hanno un rosso proprio; mai su un pulsante; e
  mai come testo, perché su `surface-1` tiene 4.57:1. Verificato da `npm run check:contrast`.
- **Cascata.** `.zona-pericolo` e `.plane-1` stanno in `tokens.css` fuori da ogni `@layer`, e il
  CSS senza layer vince sulle utility di Tailwind: un `border-alert` scritto in linea perderebbe
  in silenzio. Per lo stesso motivo le classi tipografiche `.t-*` stanno in `@layer components`,
  altrimenti batterebbero `text-ink`.
- **Mai animare il layout, mai `box-shadow`**: il salto di piano passa da uno pseudo-elemento a cui
  si anima `opacity` (`.liftable`, composta da `.volume`). `transition-colors` è ammessa. Le durate
  vengono dai token `--dur-*`. Tutto dietro `prefers-reduced-motion`.
- **Il tocco** si risolve con una regola in `tokens.css` dietro `@media (pointer: coarse)` che
  porta ogni bersaglio a `--tap` (44px), non componente per componente.
- **Testate di pagina, due scale e non tre**, col corpo dentro la classe: `.t-page` (44/56) per una
  parola fissa dell'interfaccia, `.t-contenuto` (34/46) per una stringa di lunghezza ignota. Per un
  titolo che è un numero si usa `.t-page-num` e **mai** `.t-num`, che porta con sé
  `font-family: var(--font-ui)`.
- **Sotto i 640px** ogni pagina con un titolo monta `TestataPagina`, che aggiunge `.barra-titolo`:
  la barra che raccoglie la parola quando il titolo grande esce dallo schermo. Una rotta nuova con
  un titolo passa da lì, non da un `<h1>` scritto a mano.
- **Primitivi**: `@base-ui/react` (ADR 0014, non Radix nonostante la lettera del design doc),
  generati come codice proprio in `src/components/ui/` dalla CLI `shadcn`, mai l'estetica di
  shadcn/ui presa così com'è.

**La luce** ha un comando a tre stati nel Profilo — «Segui l'ora» (predefinito) / «Giorno» /
«Notte» — in un cookie `httpOnly` letto dal layout radice. I due valori fissi coincidono col nome
dell'ancoraggio che fissano (`PreferenzaLuce` è un sottoinsieme di `Anchor`). Il calcolo resta lato
server e solo al cambio pagina. Mai `localStorage`, mai uno script anti-lampeggio.

### Scrittura e messaggi
Mai «con successo» / «per favore» / punti esclamativi / «ops»; gli errori sono testo, mai un
riquadro rosso; verbo prima nei comandi; nessun modale. **Un errore ha per soggetto la cosa**, non
un «non è stato possibile» senza soggetto, **e dice il passo successivo** («La recensione non è
stata salvata. Il testo è ancora qui.»). Mai vocabolario da idraulica a schermo: nessun «backend»,
nessuno stato HTTP, nessun nome di variabile d'ambiente. L'apostrofo è sempre quello tipografico
(`’`).

**Tre canali e non di più**: `ui/messaggio.tsx` in linea accanto al comando (il caso normale), il
toast per le scritture il cui bersaglio può essere già scorso via, `ErrorState`/`EmptyState` per
una regione intera. Il toast porta «Riprova» quando riprovare può funzionare (`riprovabile()`). Mai
un quarto canale: un `<p>` scritto a mano non ha regione `aria-live`, ed è così che l'errore
diventa invisibile a chi non guarda lo schermo.

**Nessuna frase d'errore vive nel codice.** `lib/api` classifica e non scrive: ogni esito non-ok
porta un `ErroreApi` (`lib/api/errore.ts`) con un *genere* — `rete`, `server`, `configurazione`,
`sessione`, `limite`, `assenza`, `regola` — e, dove serve, il `codice` che nomina il caso. La frase
la compone `spiega()`/`useAvvisa()` (`lib/messaggi-errore.ts`) unendo due clausole del catalogo:
`errori.<dominio>` dice cosa non è successo e la sa il chiamante, `rimedi.<genere>` dice il passo
successivo e lo sa il trasporto. Dove esiste una `rassicurazioni.<dominio>` prende il posto del
rimedio. Assenze e regole saltano la composizione e usano la propria frase intera.
`npm run check:messaggi` (in CI) impedisce che catalogo e codice divergano.

**Bilingue IT/EN.** `next-intl` risolve la lingua da `Accept-Language` a ogni richiesta — nessun
selettore, nessun cookie (`src/lib/lingua.ts`, `src/i18n/request.ts`). I cataloghi
`frontend/messages/{it,en}.json` coprono tutto il perimetro dei messaggi: `errori`,
`rassicurazioni`, `rimedi`, `regole`, `assenze`, `accesso`, `sessione`, `titoli`, `avvisi`,
`conferme`, `attesa`. Il backend manda `detail.message`, ma il frontend **non lo mostra mai**:
legge `error_code`, che è il contratto stabile, e sceglie la frase dal catalogo. Il backend usa la
stessa intestazione per scegliere fra le varianti già salvate nelle due lingue
(`backend/app/core/lingua.py`), mai una preferenza indipendente. Comandi, etichette e intestazioni
restano inline in italiano: perimetro deliberato, vedi `docs/lavoro-rimandato.md`.

Mobile e desktop hanno pari importanza, con il mobile come riferimento nei casi di dubbio.

## Vincoli non negoziabili
- L'identità utente arriva SEMPRE da una dipendenza che verifica il token, MAI dal body o dalla
  query string.
- Nessun modello di input contiene id, user_id, owner_id o campi di ruolo: li assegna il server.
- Ogni tabella con dati di utenti ha RLS attiva con policy esplicite per SELECT/INSERT/UPDATE/DELETE
  basate su `auth.uid()`. Dove non è applicabile (dato di sistema condiviso, scrittura solo da
  `service_role`) va dichiarato in un commento SQL accanto alla tabella, mai omesso in silenzio.
- La RLS è la seconda difesa, non la prima: una tabella nuova di `public` nasce **senza alcun
  privilegio** (migrazione `20260827090000`), quindi ogni migrazione che ne crea una deve concedere
  esplicitamente ad `authenticated` ciò che le serve. `anon` e `service_role` non vanno riaperti:
  nulla di `public` è raggiungibile senza autenticazione (ADR 0006) e il backend scrive come
  `postgres` su connessione diretta (ADR 0016).
- `utente_id` denormalizzata su una tabella figlia non basta come garanzia di proprietà: se la riga
  discende da un'altra già di proprietà di un utente, il vincolo è una chiave esterna **composita**
  verso `(id, utente_id)` del genitore.
- Nessun segreto nel codice: sempre variabili d'ambiente (`.env.example` documenta le chiavi, mai
  i valori).
- Validazione lato server sempre, anche se il client valida già.
- Le asserzioni dei test sono corrette: se un test fallisce, correggi l'implementazione, non il
  test. Se ritieni un'asserzione sbagliata, chiedi.
- Giorno, anno e «futuro» si valutano nel fuso `Europe/Rome`, mai nel fuso di sessione del server
  (Postgres di default: UTC).
- Nessun comando git che cambia lo stato del repository (`commit`, `push`, `branch`, `checkout -b`,
  merge, rebase) senza il consenso esplicito dell'utente, anche a lavoro finito e verificato.
- A fine implementazione, i processi locali avviati per verificare (`uvicorn`, `next dev`,
  `supabase start`) vanno spenti prima di chiudere il task.
