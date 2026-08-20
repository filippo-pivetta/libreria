# AGENTS.md

## Cosa è questo progetto
Montaigne: web app di tracciamento letture per un gruppo chiuso di utenti collegati, con visibilità privata/condivisa. Intento di prodotto (entità, regole invalicabili) in `docs/prd.md`; direzione visiva e ogni schermata in `docs/design-frontend.md`; decisioni tecniche vincolanti in `docs/adr/`. Leggi il documento pertinente prima di lavorare su dati/permessi (prd.md) o su interfaccia (design-frontend.md): sono la fonte di verità, il codice si allinea a loro.

## Dove sta cosa
- `frontend/` — Next.js (App Router, TS). `src/app/` pagine; `src/lib/supabase/{client,server,proxy}.ts` client browser/server/refresh-sessione; `src/proxy.ts` (Next 16: sostituisce `middleware.ts`); `src/lib/light.ts` calcola lato server la palette del momento — quattro ancoraggi (alba/giorno/tramonto/notte) interpolati in OKLCH sul fuso CET fisso, mai nel browser (docs/design-frontend.md §3); `src/styles/tokens.css` è l'unica sorgente di colori/ombre/raggi/tipografia, generata in parte da `pnpm tokens` (`tokens.anchors.css`, non si modifica a mano).
- `backend/` — FastAPI a strati: `app/routers` (HTTP) → `app/services` (orchestrazione) → `app/repositories` (accesso dati grezzo); `app/schemas` (contratti Pydantic); `app/models` (rappresentazione di dominio, vuoto: nessuna entità implementata); `app/core` (settings, client Supabase). `tests/` pytest. Oltre a `health`/`me`: `voci`/`letture`/`avanzamenti` (libreria personale e ciclo di lettura, issue #2) — nessuna ricerca sui cataloghi qui, `POST /voci` accetta solo un `libro_id` già seminato (`supabase/seed.sql`); la ricerca esterna è l'issue #4. `utenti`/`collegamenti` (elenco membri, richieste, visione reciproca, issue #3) — lo schema/RLS di `collegamento` e la funzione `is_collegato_attivo` esistevano già in `supabase/migrations/20260818115830_schema_montaigne.sql` prima di questa issue, che ha aggiunto solo lo strato applicativo; `GET /voci` e il dedup di `POST /voci` filtrano esplicitamente per `utente_id` (non solo RLS) da quando un collegato può leggere le stesse righe.
- `supabase/migrations/` — unica fonte di verità dello schema, un file per migrazione. Nessun ORM/Alembic. `supabase/seed.sql` — dati di sviluppo (oggi solo `libro` seminati), applicato in automatico da `supabase db reset --local`, mai in produzione. `supabase/tests/verifica_ciclo_di_lettura.sql` — verifica manuale (non CI) dei trigger/RPC del ciclo di lettura, vedi "Comandi" sotto.

## Comandi
Frontend (`cd frontend`): `npm run dev` · `npm run build` · `npm run lint` · `npm run type-check` · `npm run tokens` (rigenera `src/styles/tokens.anchors.css` da `src/lib/light.ts`, gira anche come `prebuild`) · `npm run check:contrast` (verifica AA su tutto l'anno, va in CI)

Backend (`cd backend`, venv attivo): `pip install -e ".[dev]"` · `uvicorn app.main:app --reload` · `pytest` · `ruff check . && ruff format --check .` · `mypy app`

Supabase locale: prima di `supabase start` serve una chiave di firma JWT (docs/adr/0012), altrimenti l'avvio fallisce — `supabase gen signing-key --algorithm ES256` scrive/aggiunge a `supabase/signing_keys.json` (mai committato). Poi `supabase status` per URL/chiavi da mettere in `.env`/`.env.local` (copiati da `.env.example`, mai valori reali committati). Migrazioni: `supabase migration new <nome>` · `supabase migration up --local` · `supabase db reset --local` (riapplica tutto da zero e riesegue `supabase/seed.sql`, utile per verificare che una migrazione nuova parta pulita). Creare un account di test: invito via Studio (`/project/default/auth/users`, pulsante "Invite user") o `client.auth.admin.invite_user_by_email(...)` — non esiste più creazione manuale della riga `utente` (docs/adr/0013).

Verifica dei trigger/RPC del ciclo di lettura (docs/adr/0015): nessun job CI li esercita (nessuna istanza Supabase in CI). Dopo ogni modifica a `supabase/migrations/20260820065144_ciclo_di_lettura.sql`, prima di aprire una PR: `supabase db reset --local && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_ciclo_di_lettura.sql` (`DATABASE_URL` da `supabase status`, `-v ON_ERROR_STOP=1` essenziale — senza, psql continua dopo un fallimento invece di fermarsi al primo).

CI: `.github/workflows/ci.yml`, 3 job — frontend (lint, type-check), backend (lint, type-check, test), Semgrep (`p/default`, diff-aware sulle PR).

Autenticazione: `app/core/security.py` espone `get_current_user`, la dependency che verifica il JWT di sessione (chiavi di firma asimmetriche via JWKS, docs/adr/0012) e va usata da ogni route che serve dati di un utente — vedi `app/routers/me.py` per il pattern di riferimento.

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
