# AGENTS.md

## Cosa è questo progetto
Montaigne: web app di tracciamento letture per un gruppo chiuso di utenti collegati, con visibilità privata/condivisa. Intento di prodotto in `docs/prd.md`, decisioni tecniche vincolanti in `docs/adr/`.

## Dove sta cosa
- `frontend/` — Next.js (App Router, TS). `src/app/` pagine; `src/lib/supabase/{client,server,proxy}.ts` client browser/server/refresh-sessione; `src/proxy.ts` (Next 16: sostituisce `middleware.ts`).
- `backend/` — FastAPI a strati: `app/routers` (HTTP) → `app/services` (orchestrazione) → `app/repositories` (accesso dati grezzo); `app/schemas` (contratti Pydantic); `app/models` (rappresentazione di dominio, vuoto: nessuna entità implementata); `app/core` (settings, client Supabase). `tests/` pytest.
- `supabase/migrations/` — unica fonte di verità dello schema, un file per migrazione. Nessun ORM/Alembic.

## Comandi
Frontend (`cd frontend`): `npm run dev` · `npm run build` · `npm run lint` · `npm run type-check`

Backend (`cd backend`, venv attivo): `pip install -e ".[dev]"` · `uvicorn app.main:app --reload` · `pytest` · `ruff check . && ruff format --check .` · `mypy app`

Supabase locale: prima di `supabase start` serve una chiave di firma JWT (docs/adr/0012), altrimenti l'avvio fallisce — `supabase gen signing-key --algorithm ES256` scrive/aggiunge a `supabase/signing_keys.json` (mai committato). Poi `supabase status` per URL/chiavi da mettere in `.env`/`.env.local` (copiati da `.env.example`, mai valori reali committati). Migrazioni: `supabase migration new <nome>` · `supabase migration up --local` · `supabase db reset --local` (riapplica tutto da zero, utile per verificare che una migrazione nuova parta pulita). Creare un account di test: invito via Studio (`/project/default/auth/users`, pulsante "Invite user") o `client.auth.admin.invite_user_by_email(...)` — non esiste più creazione manuale della riga `utente` (docs/adr/0013).

CI: `.github/workflows/ci.yml`, 3 job — frontend (lint, type-check), backend (lint, type-check, test), Semgrep (`p/default`, diff-aware sulle PR).

Autenticazione: `app/core/security.py` espone `get_current_user`, la dependency che verifica il JWT di sessione (chiavi di firma asimmetriche via JWKS, docs/adr/0012) e va usata da ogni route che serve dati di un utente — vedi `app/routers/me.py` per il pattern di riferimento.

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
