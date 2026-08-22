# AGENTS.md

## Cosa è questo progetto
Montaigne: web app di tracciamento letture per un gruppo chiuso di utenti collegati, con visibilità privata/condivisa. Intento di prodotto (entità, regole invalicabili) in `docs/prd.md`; direzione visiva e ogni schermata in `docs/design-frontend.md`; decisioni tecniche vincolanti in `docs/adr/`. Leggi il documento pertinente prima di lavorare su dati/permessi (prd.md) o su interfaccia (design-frontend.md): sono la fonte di verità, il codice si allinea a loro.

## Dove sta cosa
- `frontend/` — Next.js (App Router, TS). `src/app/` pagine; `src/lib/supabase/{client,server,proxy}.ts` client browser/server/refresh-sessione; `src/proxy.ts` (Next 16: sostituisce `middleware.ts`); `src/lib/light.ts` calcola lato server la palette del momento — quattro ancoraggi (alba/giorno/tramonto/notte) interpolati in OKLCH sul fuso CET fisso, mai nel browser (docs/design-frontend.md §3); `src/styles/tokens.css` è l'unica sorgente di colori/ombre/raggi/tipografia, generata in parte da `pnpm tokens` (`tokens.anchors.css`, non si modifica a mano).
- `backend/` — FastAPI a strati: `app/routers` (HTTP) → `app/services` (orchestrazione) → `app/repositories` (accesso dati grezzo); `app/schemas` (contratti Pydantic); `app/models` (vuoto, nessuna entità implementata); `app/core` (settings, client Supabase, spazio file copertine, rate limit); `app/cataloghi` (client di sola lettura verso Google Books/Open Library/Wikidata/Wikipedia, ciascuno usato solo dove è la fonte migliore — vedi i docstring dei singoli moduli; più il fornitore di modelli, diviso in tre: `openai_client.py` il trasporto, `llm.py` le funzioni bibliografiche che non inviano mai contenuto di un Utente, `llm_personale.py` quelle che inviano contenuti del solo richiedente — la separazione rende verificabile a colpo d'occhio la regola 19 del PRD, docs/adr/0018, non toglierla); `app/lavori` (coda dei lavori in secondo piano su tabella Postgres, `FOR UPDATE SKIP LOCKED`, docs/adr/0016 — un tipo nuovo richiede sia una migrazione che estenda `chk_lavoro_tipo` sia una voce in `registro.GESTORI`). `tests/` pytest.

  Gotcha non ovvi da conoscere prima di toccare quest'area:
  - Nessuna cancellazione della Voce intera, pur richiesta dal PRD ("l'Utente può... cancellare... la Voce intera") — gap noto, nessuna issue lo copre.
  - Cancellazione dell'account (issue #8): `me_service.elimina_account` cancella prima `public.utente` con l'identità dell'utente (RLS, la cascata dello schema travolge tutti i dati applicativi), poi chiama l'Auth Admin API (`get_service_client().auth.admin.delete_user`) per rimuovere la riga in `auth.users`. Se il secondo passo fallisce dopo che il primo è già riuscito, i dati applicativi sono comunque spariti (regole 26/27 del PRD soddisfatte) ma resta un residuo in `auth.users` senza alcun retry automatico: richiede pulizia manuale del Manutentore (ADR 0007). Scelta di semplicità per una scala di poche persone, non un bug nascosto.
  - `GET /voci` e il dedup di `POST /voci` filtrano esplicitamente per `utente_id`, non solo RLS: necessario da quando un collegato può leggere le stesse righe.
  - Il gating dello spoiler (regola 10 del PRD) vive nel service layer (`insight_service._senza_spoiler`), non nella RLS — per questo è testato da pytest, non dagli script SQL. La regola protegge da uno spoiler *altrui*, non da un proprio testo: `GET /voci/{id}` lo applica solo quando chi guarda non è il proprietario (`voci_service.dettaglio` confronta `richiedente_id` con `voce.utente_id`), e `GET /ricerca/semantica` non lo applica mai, perché lì ogni risultato è già garantito del richiedente.
  - Il consenso all'elaborazione assistita si legge in un punto solo (`app/services/consenso.py::esigi_consenso`); risposta 409 `consenso_revocato`, mai 403 — è una funzione spenta, non un permesso mancante.
  - `cerca_semantico` filtra anche per distanza coseno (`p_soglia_massima`, default 0.65): senza soglia un corpus piccolo restituirebbe sempre tutti i vettori indicizzati. Valore empirico, non definitivo — se in uso reale taglia risultati veri o ne lascia passare troppi, si rivede nel commento della RPC.
  - Delle cinque funzioni assistite personali del PRD ne sono costruite quattro (ricerca semantica, preview, suggerimenti di lettura, sintesi tematica); resta l'acquisizione da foto, descritta in `docs/rimandato-funzioni-assistite-personali.md`.
  - Le metriche di lettura (issue #7, `app/services/metriche_service.py`) non hanno una migrazione propria: nessuna tabella nuova, sola aggregazione in Python su letture già leggibili via RLS. `metriche_repository.list_avanzamenti` legge SEMPRE l'intera storia degli Avanzamenti di un utente, mai filtrata per l'anno richiesto: l'incremento di un Avanzamento datato nell'anno dipende dalla pagina di quello precedente, che può essere dell'anno prima (PRD, entità Avanzamento) — filtrare la query per anno produrrebbe un conteggio pagine sbagliato a ogni Lettura a cavallo di capodanno.
- `supabase/migrations/` — unica fonte di verità dello schema, un file per migrazione. Nessun ORM/Alembic. `supabase/seed.sql` — dati di sviluppo (libri seminati con riferimenti esterni reali, generi/etichette dell'elenco chiuso), applicato in automatico da `supabase db reset --local`, mai in produzione. `supabase/tests/*.sql` — quattro script di verifica manuale (non CI): `verifica_ciclo_di_lettura`, `verifica_catalogo_e_copertine`, `verifica_recensioni_insight`, `verifica_consenso_e_indici`. Vedi "Comandi" sotto.

## Comandi
Frontend (`cd frontend`): `npm run dev` · `npm run build` · `npm run lint` · `npm run type-check` · `npm run tokens` (rigenera `src/styles/tokens.anchors.css` da `src/lib/light.ts`, gira anche come `prebuild`) · `npm run check:contrast` (verifica AA su tutto l'anno, va in CI)

Backend (`cd backend`, venv attivo): `pip install -e ".[dev]"` · `uvicorn app.main:app --reload` · `pytest` · `ruff check . && ruff format --check .` · `mypy app`

Supabase locale: prima di `supabase start` serve una chiave di firma JWT (docs/adr/0012), altrimenti l'avvio fallisce — `supabase gen signing-key --algorithm ES256` scrive/aggiunge a `supabase/signing_keys.json` (mai committato). Poi `supabase status` per URL/chiavi da mettere in `.env`/`.env.local` (copiati da `.env.example`, mai valori reali committati). Migrazioni: `supabase migration new <nome>` · `supabase migration up --local` · `supabase db reset --local` (riapplica tutto da zero e riesegue `supabase/seed.sql`, utile per verificare che una migrazione nuova parta pulita, ma cancella anche ogni account/dato di test creato a mano — vedi "Account di test locali" sotto).

Verifiche SQL manuali: nessun job CI le esercita (nessuna istanza Supabase in CI). Dopo ogni modifica a una migrazione o a una policy, prima di aprire una PR, `supabase db reset --local` e poi tutti e quattro gli script, ciascuno con `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<nome>.sql` (`DATABASE_URL` da `supabase status`; `-v ON_ERROR_STOP=1` è essenziale — senza, psql continua dopo un fallimento invece di fermarsi al primo). Vanno eseguiti tutti e quattro anche quando la modifica ne riguarda uno: una migrazione in un'area può invalidare in silenzio le fixture di uno script su un'altra, e senza rieseguirli tutti l'incoerenza resta invisibile fino alla prossima PR.

CI: `.github/workflows/ci.yml`, 3 job — frontend (lint, type-check), backend (lint, type-check, test), Semgrep (`p/default`, diff-aware sulle PR).

Autenticazione: `app/core/security.py` espone `get_current_user`, la dependency che verifica il JWT di sessione (chiavi di firma asimmetriche via JWKS, docs/adr/0012) e va usata da ogni route che serve dati di un utente — vedi `app/routers/me.py` per il pattern di riferimento.

## Account di test locali
Due account già completati sull'istanza Supabase locale, riusabili per qualunque verifica manuale — non crearne di nuovi salvo che serva più di un utente contemporaneamente (in quel caso, aggiungerli qui con le loro credenziali). Un `supabase db reset --local` li cancella: vanno ricreati (invito via Admin API o Studio, docs/adr/0013) prima di riusarli.

| | Email | Password | Nome utente |
|---|---|---|---|
| Account 1 | `prova@montaigne.test` | `provaprova123` | `prova` |
| Account 2 | `prova2@montaigne.test` | `provaprova123` | `prova2` |

## Sistema di design (frontend)
`src/styles/tokens.css` è l'unico posto in cui esistono colori, ombre, raggi e scale tipografiche: nessun componente scrive mai un colore a mano. Le tre regole che si violano più facilmente per distrazione (dettaglio completo in `docs/design-frontend.md`):
- Tre piani soli — `surface-0` (stanza, mai testo), `surface-1` (carta), `surface-2` (oggetto sollevato). Non esiste un piano 3.
- Un solo accento (`accent`, solo riempimento; `accent-strong` per testo/icone) e un solo rosso (`alert`, un solo uso in tutta l'app: il contatore delle richieste accanto a Torre — mai su errori o cancellazione account).
- Si anima solo `transform`/`opacity`; `box-shadow` non si anima mai (usa `.liftable`). Tutto dietro `prefers-reduced-motion`.

Niente tema chiaro/scuro e nessun interruttore: `src/lib/light.ts` interpola quattro ancoraggi (alba/giorno/tramonto/notte) lato server, solo al cambio pagina. Primitivi di interfaccia: `@base-ui/react` (ADR-0014, non Radix nonostante la lettera del design doc), generati come codice proprio in `src/components/ui/` dalla CLI `shadcn`, mai l'estetica di shadcn/ui presa così com'è.

Scrittura: mai "con successo"/"per favore"/punti esclamativi/"ops"; gli errori sono testo (mai un riquadro rosso), verbo prima nei comandi, nessun modale. Mobile e desktop pari importanza, mobile come riferimento nei casi di dubbio. Interfaccia bilingue IT/EN prevista dal PRD ma non ancora implementata: le stringhe sono oggi in linea nel componente, in italiano — debito noto, da risolvere introducendo un framework di i18n (`next-intl` o equivalente), non riscrivendo pagina per pagina in silenzio.

## Vincoli non negoziabili
- L'identità utente arriva SEMPRE da una dipendenza che verifica il token, MAI dal body o dalla query string.
- Nessun modello di input contiene id, user_id, owner_id o campi di ruolo: li assegna il server.
- Ogni tabella con dati di utenti ha RLS attiva con policy esplicite per SELECT/INSERT/UPDATE/DELETE basate su `auth.uid()`. Dove non è applicabile (dato di sistema condiviso, scrittura solo da `service_role`) va dichiarato in un commento SQL accanto alla tabella, mai omesso in silenzio — vedi `supabase/migrations/` per i precedenti.
- `utente_id` denormalizzata su una tabella figlia non basta da sola come garanzia di proprietà: se la riga discende da un'altra riga già di proprietà di un utente (una Lettura da una Voce, un Avanzamento da una Lettura, ...), il vincolo è una chiave esterna composita verso `(id, utente_id)` del genitore — non una FK singola sull'id più un controllo RLS indipendente sulla colonna denormalizzata.
- Nessun segreto nel codice: sempre variabili d'ambiente (`.env.example` documenta le chiavi, mai i valori).
- Validazione lato server sempre, anche se il client valida già.
- Le asserzioni dei test sono corrette: se un test fallisce, correggi l'implementazione, non il test. Se ritieni un'asserzione sbagliata, chiedi.
- Non ribaltare una decisione presente in `docs/adr/` senza chiedere.
- Giorno/anno/"futuro" si valutano nel fuso `Europe/Rome`, mai nel fuso di sessione del server (Supabase/Postgres di default: UTC).
- Nessun comando git che cambia lo stato del repository (`commit`, `push`, `branch`, `checkout -b`, merge, rebase, ecc.) senza il consenso esplicito dell'utente prima di eseguirlo, anche a lavoro finito e verificato.
- A fine implementazione, se per verificare il lavoro sono stati avviati processi locali (`uvicorn`, `next dev`, `supabase start`, ecc.), vanno spenti prima di chiudere il task — non lasciarli in background.
