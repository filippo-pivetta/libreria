-- Montaigne — schema applicativo
--
-- Migrazione unica: crea tutte le tabelle di dominio concordate nella
-- proposta di schema, gli indici sulle colonne di filtro (proprietà e
-- chiavi esterne) e le regole di riga (RLS), coerenti con gli ADR:
-- 0001 (RLS su tutte le tabelle, negazione per default, auth.uid()),
-- 0002 (scheda per opera), 0003 (pagine sulla voce), 0005 (identità
-- stabili per genere/autore/titolo), 0006 (due soli livelli di
-- visibilità, nessun accesso non autenticato), 0007 (amministrazione
-- fuori dal prodotto), 0009 (indici semantici sotto le stesse regole
-- della loro origine), 0011 (nessun soft delete, cancellazione a cascata
-- immediata).
--
-- Convenzioni:
-- - I campi "enum" applicativi sono `text` + `check (... in (...))`
--   invece di `create type ... as enum`: cambiare i valori ammessi resta
--   un `alter table`, non le limitazioni di `alter type` sugli enum
--   nativi di Postgres.
-- - Le tabelle di catalogo bibliografico (autore, genere, libro e
--   tabelle collegate) non hanno proprietario: sono dato condiviso di
--   sistema. Sono leggibili da ogni utente autenticato e scrivibili solo
--   fuori banda con la chiave di servizio (ADR 0007), che aggira la RLS
--   per definizione su Supabase. Per queste tabelle non esistono policy
--   INSERT/UPDATE/DELETE basate su auth.uid(): la RLS "non applicabile"
--   in quella forma è dichiarata esplicitamente in un commento accanto a
--   ciascuna, non omessa in silenzio, ed è rinforzata anche a livello di
--   GRANT (al ruolo `authenticated` non viene concesso il privilegio SQL
--   per quei comandi, oltre a non esistere la policy).
-- - Nessuna tabella concede alcun privilegio al ruolo `anon`: nessun dato
--   è raggiungibile senza autenticazione (ADR 0006), anche a livello di
--   GRANT e non solo di policy.
-- - `service_role` bypassa la RLS per definizione della piattaforma
--   Supabase e non compare in nessuna policy di questo file.
-- - Le colonne utente_id denormalizzate su lettura/avanzamento/insight/
--   recensione/artefatto_generato/indice_semantico non sono solo
--   verificate a scrittura (auth.uid() = utente_id): dove la riga
--   discende da un'altra riga di proprietà (una Lettura da una Voce, un
--   Avanzamento da una Lettura, ecc.), il vincolo è una chiave esterna
--   composita verso (id, utente_id) del genitore, non una singola FK su
--   id più un controllo RLS indipendente su utente_id. Altrimenti nulla
--   impedirebbe di scrivere una riga con il proprio utente_id ma un
--   riferimento (lettura_id, voce_id, ...) che appartiene a un altro
--   utente: la RLS in scrittura la lascerebbe passare, perché controlla
--   solo la colonna utente_id dichiarata, non la coerenza con la riga
--   referenziata.
-- - Nessun dato di esempio è inserito da questa migrazione.

-- ============================================================================
-- Estensioni e privilegi di base
-- ============================================================================

create extension if not exists vector with schema extensions;

grant usage on schema public to authenticated;

-- ============================================================================
-- utente / utente_privato
-- ============================================================================
-- Profilo applicativo, 1:1 con auth.users. Il Manutentore crea nome_utente
-- fuori banda (ADR 0007); l'app non espone alcuna scrittura su quella
-- colonna, ma non essendo un vincolo di dominio non è imposto da questo
-- schema.
--
-- La tabella è divisa in due per rendere possibile l'elenco dei membri
-- del PRD (nome utente visibile a tutti gli autenticati) senza alcuna
-- eccezione alla RLS a livello di riga: `utente` porta solo id e
-- nome_utente, leggibili da chiunque sia autenticato; i dati privati di
-- consenso GDPR (elaborazione assistita, accettazione dell'informativa)
-- vivono in `utente_privato`, chiusa al solo proprietario. Nessuna vista
-- né funzione security definer necessaria.

create table public.utente (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_utente text not null,
  creato_at timestamptz not null default now(),
  constraint uq_utente_nome_utente unique (nome_utente)
);

comment on table public.utente is
  'Profilo pubblico dei membri (id + nome_utente), 1:1 con auth.users. Leggibile da tutti gli autenticati per l''elenco membri del PRD. Righe create/rimosse fuori banda dal Manutentore (ADR 0007); la cancellazione dell''account (self-service) elimina questa riga e innesca la cascata su tutti i dati dell''utente (ADR 0011).';

alter table public.utente enable row level security;

-- SELECT aperta a tutti gli autenticati: la riga contiene solo id e
-- nome_utente, nessun dato sensibile (quello vive in utente_privato).
-- È esattamente ciò che serve all'elenco membri del PRD.
create policy utente_select_autenticati
  on public.utente
  for select
  to authenticated
  using (true);

create policy utente_insert_owner
  on public.utente
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy utente_update_owner
  on public.utente
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- DELETE: è il meccanismo della cancellazione self-service dell'account
-- (PRD, regola 15/28) e per ADR 0001 va eseguita con l'identità
-- dell'utente, non con la chiave di servizio. Cancella questa riga e, a
-- cascata, tutti i dati applicativi dell'utente; NON rimuove la riga in
-- auth.users (un ruolo `authenticated` non ha privilegi sullo schema
-- auth), che resta da eliminare con l'Auth Admin API lato backend.
create policy utente_delete_owner
  on public.utente
  for delete
  to authenticated
  using (auth.uid() = id);

grant select, insert, update, delete on table public.utente to authenticated;

create table public.utente_privato (
  utente_id uuid primary key references public.utente (id) on delete cascade,
  consenso_elaborazione_assistita boolean not null default true,
  consenso_aggiornato_at timestamptz not null default now(),
  informativa_accettata_at timestamptz
);

comment on table public.utente_privato is
  'Dati privati di consenso del profilo (elaborazione assistita, accettazione informativa): 1:1 con utente, ma RLS chiusa al solo proprietario, a differenza di utente che è leggibile da tutti gli autenticati. Una nuova riga in utente ne richiede una corrispondente qui, create insieme fuori banda dal Manutentore.';

alter table public.utente_privato enable row level security;

create policy utente_privato_select_owner
  on public.utente_privato
  for select
  to authenticated
  using (auth.uid() = utente_id);

create policy utente_privato_insert_owner
  on public.utente_privato
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy utente_privato_update_owner
  on public.utente_privato
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy utente_privato_delete_owner
  on public.utente_privato
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.utente_privato to authenticated;

-- ============================================================================
-- collegamento
-- ============================================================================
-- Relazione simmetrica utente↔utente. L'assenza di relazione non è una
-- riga: lo stato "assente" del PRD corrisponde a nessuna riga per quella
-- coppia (un rifiuto o un'interruzione cancellano la riga, non la
-- aggiornano a uno stato "chiuso").

create table public.collegamento (
  id uuid primary key default gen_random_uuid(),
  utente_a_id uuid not null references public.utente (id) on delete cascade,
  utente_b_id uuid not null references public.utente (id) on delete cascade,
  richiesto_da_id uuid not null references public.utente (id) on delete cascade,
  stato text not null default 'in_attesa',
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  constraint chk_collegamento_stato check (stato in ('in_attesa', 'attiva')),
  constraint chk_collegamento_ordine check (utente_a_id < utente_b_id),
  constraint chk_collegamento_richiedente
    check (richiesto_da_id = utente_a_id or richiesto_da_id = utente_b_id),
  constraint uq_collegamento_coppia unique (utente_a_id, utente_b_id)
);

comment on table public.collegamento is
  'Relazione simmetrica tra due utenti. Applicazione responsabile di normalizzare la coppia (utente_a_id < utente_b_id) prima dell''insert.';

create index idx_collegamento_utente_b on public.collegamento (utente_b_id);
create index idx_collegamento_richiesto_da on public.collegamento (richiesto_da_id);

alter table public.collegamento enable row level security;

create policy collegamento_select_partecipante
  on public.collegamento
  for select
  to authenticated
  using (auth.uid() = utente_a_id or auth.uid() = utente_b_id);

create policy collegamento_insert_richiedente
  on public.collegamento
  for insert
  to authenticated
  with check (
    auth.uid() = richiesto_da_id
    and (auth.uid() = utente_a_id or auth.uid() = utente_b_id)
  );

-- UPDATE: usata solo per accettare una richiesta (in_attesa -> attiva).
-- Chi ha inviato la richiesta (richiesto_da_id) è escluso esplicitamente:
-- richiesto_da_id è una colonna della riga stessa, quindi il vincolo
-- "solo l'altro partecipante può accettare" è esprimibile in RLS, non va
-- lasciato alla logica applicativa. Senza questa condizione chi invia una
-- richiesta potrebbe auto-accettarsela e ottenere accesso immediato alla
-- libreria dell'altro senza che l'altro abbia mai acconsentito.
create policy collegamento_update_partecipante_non_richiedente
  on public.collegamento
  for update
  to authenticated
  using (
    (auth.uid() = utente_a_id or auth.uid() = utente_b_id)
    and auth.uid() <> richiesto_da_id
  )
  with check (
    (auth.uid() = utente_a_id or auth.uid() = utente_b_id)
    and auth.uid() <> richiesto_da_id
  );

-- DELETE: sia il rifiuto sia l'interruzione di un collegamento attivo
-- sono una DELETE, eseguibile da uno qualsiasi dei due partecipanti in
-- ogni momento (PRD) — a differenza dell'accettazione, qui non c'è alcuna
-- ragione di escludere il richiedente: può ritirare la propria richiesta
-- prima che sia accettata, o interrompere una relazione attiva come
-- l'altra parte.
create policy collegamento_delete_partecipante
  on public.collegamento
  for delete
  to authenticated
  using (auth.uid() = utente_a_id or auth.uid() = utente_b_id);

grant select, insert, update, delete on table public.collegamento to authenticated;

-- ============================================================================
-- Funzione di supporto alle policy: collegamento attivo con l'utente corrente
-- ============================================================================
-- Centralizza il controllo "sono connesso con questo utente?" usato da
-- tutte le tabelle di contenuto sotto. SECURITY INVOKER (non DEFINER):
-- non serve bypassare la RLS di collegamento, perché il filtro qui sotto
-- è già esattamente quello che la RLS di collegamento applicherebbe per
-- l'utente corrente.

create or replace function public.is_collegato_attivo(altro_utente_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.collegamento c
    where c.stato = 'attiva'
      and (
        (c.utente_a_id = auth.uid() and c.utente_b_id = altro_utente_id)
        or (c.utente_b_id = auth.uid() and c.utente_a_id = altro_utente_id)
      )
  );
$$;

comment on function public.is_collegato_attivo(uuid) is
  'Vero se l''utente autenticato corrente ha un collegamento attivo con altro_utente_id. Usata dalle policy RLS delle tabelle di contenuto per implementare "proprietario o collegato".';

grant execute on function public.is_collegato_attivo(uuid) to authenticated;

-- ============================================================================
-- autore / autore_nome_variante
-- ============================================================================
-- Identità stabile (ADR 0005): i libri puntano all'identità, mai al nome
-- grezzo restituito dai cataloghi. Dato di sistema condiviso, nessun
-- proprietario.

create table public.autore (
  id uuid primary key default gen_random_uuid(),
  nome_canonico text not null,
  creato_at timestamptz not null default now()
);

create table public.autore_nome_variante (
  id uuid primary key default gen_random_uuid(),
  autore_id uuid not null references public.autore (id) on delete cascade,
  nome_variante text not null,
  creato_at timestamptz not null default now(),
  constraint uq_autore_nome_variante unique (nome_variante)
);

comment on table public.autore_nome_variante is
  'Ogni forma grezza del nome vista nei cataloghi, mappata all''identità canonica. Disfare una riconduzione errata = riassegnare la variante a un altro autore_id (fuori banda), senza perdere l''informazione originale.';

create index idx_autore_nome_variante_autore_id on public.autore_nome_variante (autore_id);

-- RLS: attiva su entrambe (ADR 0001, "tutte le tabelle"), ma senza alcuna
-- policy basata su auth.uid(), perché queste righe non hanno un
-- proprietario utente: sono dato bibliografico condiviso. Non è
-- un'omissione — è dichiarata qui esplicitamente, come richiesto — è
-- l'applicazione letterale del fatto che "autore"/"autore_nome_variante"
-- non compaiono nella tabella di ownership del PRD con un Utente come
-- proprietario. Lettura aperta a chiunque sia autenticato; scrittura solo
-- fuori banda con la chiave di servizio (ADR 0007), che bypassa la RLS.
alter table public.autore enable row level security;

create policy autore_select_autenticati
  on public.autore
  for select
  to authenticated
  using (true);

grant select on table public.autore to authenticated;

alter table public.autore_nome_variante enable row level security;

create policy autore_nome_variante_select_autenticati
  on public.autore_nome_variante
  for select
  to authenticated
  using (true);

grant select on table public.autore_nome_variante to authenticated;

-- ============================================================================
-- genere / genere_etichetta
-- ============================================================================
-- Elenco chiuso di 28 identità fisse, gestite dal Manutentore fuori banda
-- (ADR 0007). Stessa situazione RLS di autore: nessuna policy
-- INSERT/UPDATE/DELETE basata su auth.uid(), per lo stesso motivo (dato
-- condiviso di sistema, non un dato di un Utente).

create table public.genere (
  id text primary key,
  creato_at timestamptz not null default now()
);

create table public.genere_etichetta (
  genere_id text not null references public.genere (id) on delete cascade,
  lingua text not null,
  etichetta text not null,
  primary key (genere_id, lingua)
);

alter table public.genere enable row level security;

create policy genere_select_autenticati
  on public.genere
  for select
  to authenticated
  using (true);

grant select on table public.genere to authenticated;

alter table public.genere_etichetta enable row level security;

create policy genere_etichetta_select_autenticati
  on public.genere_etichetta
  for select
  to authenticated
  using (true);

grant select on table public.genere_etichetta to authenticated;

-- ============================================================================
-- libro / libro_autore / libro_genere / variante_titolo
-- ============================================================================
-- Una scheda per opera (ADR 0002). Dato condiviso di sistema: stessa
-- situazione RLS delle tabelle di catalogo sopra — nessuna policy
-- INSERT/UPDATE/DELETE basata su auth.uid(), per lo stesso motivo.

create table public.libro (
  id uuid primary key default gen_random_uuid(),
  identificativo_canonico text,
  non_canonicalizzato boolean not null default false,
  titolo_canonico text not null,
  anno_prima_pubblicazione integer,
  anno_dedotto boolean not null default false,
  lingua_originale text,
  lingua_dedotta boolean not null default false,
  copertina_miniatura_path text,
  copertina_grande_path text,
  creato_at timestamptz not null default now(),
  constraint uq_libro_identificativo_canonico unique (identificativo_canonico)
);

create table public.libro_autore (
  libro_id uuid not null references public.libro (id) on delete cascade,
  autore_id uuid not null references public.autore (id) on delete cascade,
  ordine smallint not null default 0,
  primary key (libro_id, autore_id)
);

create table public.libro_genere (
  libro_id uuid not null references public.libro (id) on delete cascade,
  genere_id text not null references public.genere (id) on delete restrict,
  primary key (libro_id, genere_id)
);

comment on table public.libro_genere is
  'Da uno a tre generi per libro (PRD). Il tetto di tre non è imposto da un CHECK: è un vincolo di aggregazione su più righe, non esprimibile senza un trigger — deliberatamente fuori scope in questa migrazione, coerente con gli altri vincoli tra righe già segnalati (monotonia avanzamenti, lettura aperta unica).';

create table public.variante_titolo (
  id uuid primary key default gen_random_uuid(),
  libro_id uuid not null references public.libro (id) on delete cascade,
  lingua text not null,
  titolo text not null,
  constraint uq_variante_titolo_libro_lingua unique (libro_id, lingua)
);

create index idx_libro_autore_autore_id on public.libro_autore (autore_id);
create index idx_libro_genere_genere_id on public.libro_genere (genere_id);

alter table public.libro enable row level security;

create policy libro_select_autenticati
  on public.libro
  for select
  to authenticated
  using (true);

grant select on table public.libro to authenticated;

alter table public.libro_autore enable row level security;

create policy libro_autore_select_autenticati
  on public.libro_autore
  for select
  to authenticated
  using (true);

grant select on table public.libro_autore to authenticated;

alter table public.libro_genere enable row level security;

create policy libro_genere_select_autenticati
  on public.libro_genere
  for select
  to authenticated
  using (true);

grant select on table public.libro_genere to authenticated;

alter table public.variante_titolo enable row level security;

create policy variante_titolo_select_autenticati
  on public.variante_titolo
  for select
  to authenticated
  using (true);

grant select on table public.variante_titolo to authenticated;

-- ============================================================================
-- voce_di_libreria
-- ============================================================================
-- Istanza personale di un Libro (ADR 0002, 0003). Non ha visibilità
-- propria: sempre visibile ai collegati attivi, coda "da leggere"
-- compresa (tabella di ownership del PRD). È la radice della catena di
-- proprietà: il suo utente_id non discende da nessun'altra riga, quindi
-- resta una FK singola verso utente(id) (non composita).

create table public.voce_di_libreria (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utente (id) on delete cascade,
  libro_id uuid not null references public.libro (id) on delete restrict,
  stato text not null default 'da_leggere',
  pagine_adottate integer,
  voto smallint,
  nota_intenzione text,
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  constraint uq_voce_di_libreria_utente_libro unique (utente_id, libro_id),
  -- Necessaria perché lettura/insight/recensione/artefatto_generato
  -- referenzino la coppia (id, utente_id) con una FK composita, invece di
  -- verificare utente_id in modo indipendente dal proprio via RLS.
  constraint uq_voce_di_libreria_id_utente unique (id, utente_id),
  constraint chk_voce_di_libreria_stato
    check (stato in ('da_leggere', 'in_lettura', 'in_pausa', 'abbandonato', 'letto')),
  constraint chk_voce_di_libreria_pagine_adottate
    check (pagine_adottate is null or pagine_adottate > 0),
  constraint chk_voce_di_libreria_voto check (voto is null or voto between 1 and 5)
);

comment on column public.voce_di_libreria.nota_intenzione is
  'Campo più sensibile dello schema: contiene abitualmente nomi di terzi che non hanno mai dato consenso. Non va mai inviata al fornitore di modelli né indicizzata, in nessuno stato del consenso (PRD).';

create index idx_voce_di_libreria_libro_id on public.voce_di_libreria (libro_id);

alter table public.voce_di_libreria enable row level security;

create policy voce_di_libreria_select_owner_o_collegato
  on public.voce_di_libreria
  for select
  to authenticated
  using (auth.uid() = utente_id or public.is_collegato_attivo(utente_id));

create policy voce_di_libreria_insert_owner
  on public.voce_di_libreria
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy voce_di_libreria_update_owner
  on public.voce_di_libreria
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy voce_di_libreria_delete_owner
  on public.voce_di_libreria
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.voce_di_libreria to authenticated;

-- ============================================================================
-- lettura
-- ============================================================================
-- utente_id non ha una FK singola verso utente(id): è vincolato tramite
-- la FK composita (voce_id, utente_id) -> voce_di_libreria(id, utente_id),
-- che obbliga la Lettura ad appartenere allo stesso utente della Voce a
-- cui si riferisce. Senza questo vincolo, un utente collegato — che può
-- leggere voce_id altrui proprio perché condivisi — potrebbe scrivere una
-- propria Lettura con un voce_id di qualcun altro: la sola RLS "il mio
-- utente_id è il mio" non lo impedirebbe, perché non verifica la
-- provenienza di voce_id.

create table public.lettura (
  id uuid primary key default gen_random_uuid(),
  voce_id uuid not null,
  utente_id uuid not null,
  -- "oggi" è sempre il giorno in Europa centrale (PRD: "Il giorno, l'anno
  -- e il concetto di 'futuro' si valutano sul fuso orario dell'Europa
  -- centrale, uguale per tutti gli Utenti"), non il fuso della sessione
  -- del server (UTC su Supabase): current_date da solo seguirebbe
  -- quest'ultimo.
  data_inizio date not null default ((now() at time zone 'Europe/Rome')::date),
  data_fine date,
  esito text,
  creato_at timestamptz not null default now(),
  constraint chk_lettura_esito check (esito is null or esito in ('conclusa', 'abbandonata')),
  constraint chk_lettura_date check (data_fine is null or data_fine >= data_inizio),
  -- Una Lettura è aperta o chiusa come coppia: esito e data_fine devono
  -- essere entrambi nulli o entrambi valorizzati. L'indice unico parziale
  -- sotto, che garantisce una sola Lettura aperta per Voce, filtra solo su
  -- data_fine is null: senza questo CHECK nulla vieterebbe una riga con
  -- data_fine nulla ma esito valorizzato (o viceversa), che l'indice
  -- tratterebbe come "aperta" o "chiusa" in modo incoerente con il resto
  -- della riga.
  constraint chk_lettura_esito_coerente_con_chiusura check ((data_fine is null) = (esito is null)),
  constraint fk_lettura_voce_utente foreign key (voce_id, utente_id)
    references public.voce_di_libreria (id, utente_id) on delete cascade,
  -- Necessaria perché avanzamento/insight referenzino la coppia
  -- (id, utente_id) con una FK composita.
  constraint uq_lettura_id_utente unique (id, utente_id)
);

-- Al più una Lettura aperta per Voce (PRD, casi limite): indice unico
-- parziale, non un CHECK, perché il vincolo è tra righe.
create unique index uq_lettura_una_aperta_per_voce
  on public.lettura (voce_id)
  where data_fine is null;

create index idx_lettura_voce_id on public.lettura (voce_id);
create index idx_lettura_utente_id on public.lettura (utente_id);

alter table public.lettura enable row level security;

create policy lettura_select_owner_o_collegato
  on public.lettura
  for select
  to authenticated
  using (auth.uid() = utente_id or public.is_collegato_attivo(utente_id));

create policy lettura_insert_owner
  on public.lettura
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy lettura_update_owner
  on public.lettura
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy lettura_delete_owner
  on public.lettura
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.lettura to authenticated;

-- ============================================================================
-- avanzamento
-- ============================================================================
-- Stessa logica di lettura: utente_id è vincolato dalla FK composita
-- (lettura_id, utente_id) -> lettura(id, utente_id), non da una FK
-- singola verso utente(id). Questo è il caso concreto che il vincolo
-- previene: senza la FK composita, un utente collegato potrebbe scrivere
-- un proprio Avanzamento dentro la Lettura di un altro (di cui conosce
-- l'id perché condiviso), corrompendo il conteggio pagine dell'altro
-- utente pur passando la RLS "il mio utente_id è il mio".
--
-- Nota: i vincoli di monotonia (pagina non decrescente, data non
-- anteriore all'avanzamento precedente della stessa Lettura — PRD, regole
-- 14/15) restano vincoli tra righe che richiedono un trigger,
-- deliberatamente non incluso in questa migrazione (fuori scope: solo RLS
-- e indici).

create table public.avanzamento (
  id uuid primary key default gen_random_uuid(),
  lettura_id uuid not null,
  utente_id uuid not null,
  pagina integer not null,
  -- "oggi" in Europa centrale, non nel fuso del server: vedi lettura.data_inizio.
  data date not null default ((now() at time zone 'Europe/Rome')::date),
  generato_automaticamente boolean not null default false,
  creato_at timestamptz not null default now(),
  constraint chk_avanzamento_pagina check (pagina >= 0),
  constraint fk_avanzamento_lettura_utente foreign key (lettura_id, utente_id)
    references public.lettura (id, utente_id) on delete cascade
);

create index idx_avanzamento_lettura_id on public.avanzamento (lettura_id);
create index idx_avanzamento_utente_id on public.avanzamento (utente_id);

alter table public.avanzamento enable row level security;

create policy avanzamento_select_owner_o_collegato
  on public.avanzamento
  for select
  to authenticated
  using (auth.uid() = utente_id or public.is_collegato_attivo(utente_id));

create policy avanzamento_insert_owner
  on public.avanzamento
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy avanzamento_update_owner
  on public.avanzamento
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy avanzamento_delete_owner
  on public.avanzamento
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.avanzamento to authenticated;

-- ============================================================================
-- recensione
-- ============================================================================
-- Una per Voce. Visibile ai collegati attivi solo se condivisa
-- (visibilita = 'condiviso'), altrimenti solo al proprietario. utente_id
-- vincolato dalla FK composita verso voce_di_libreria, stessa logica delle
-- tabelle sopra.

create table public.recensione (
  id uuid primary key default gen_random_uuid(),
  voce_id uuid not null,
  utente_id uuid not null,
  testo text not null,
  visibilita text not null default 'condiviso',
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  constraint uq_recensione_voce unique (voce_id),
  constraint chk_recensione_visibilita check (visibilita in ('condiviso', 'privato')),
  constraint fk_recensione_voce_utente foreign key (voce_id, utente_id)
    references public.voce_di_libreria (id, utente_id) on delete cascade,
  -- Necessaria perché indice_semantico referenzi la coppia (id, utente_id).
  constraint uq_recensione_id_utente unique (id, utente_id)
);

create index idx_recensione_utente_id on public.recensione (utente_id);

alter table public.recensione enable row level security;

create policy recensione_select_owner_o_condivisa
  on public.recensione
  for select
  to authenticated
  using (
    auth.uid() = utente_id
    or (visibilita = 'condiviso' and public.is_collegato_attivo(utente_id))
  );

create policy recensione_insert_owner
  on public.recensione
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy recensione_update_owner
  on public.recensione
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy recensione_delete_owner
  on public.recensione
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.recensione to authenticated;

-- ============================================================================
-- insight
-- ============================================================================
-- Più d'uno per Voce, visibilità decisa singolarmente come la recensione.
-- utente_id vincolato dalla FK composita verso voce_di_libreria (voce_id
-- non è mai nullo). lettura_id resta invece una FK singola verso
-- lettura(id) ON DELETE SET NULL: una FK composita (lettura_id, utente_id)
-- con ON DELETE SET NULL annullerebbe anche utente_id, che è NOT NULL —
-- la cancellazione di una Lettura fallirebbe invece di lasciare l'insight
-- orfano di sola Lettura, comportamento esplicitamente richiesto dal PRD.
-- Di conseguenza un insight con lettura_id valorizzato ma appartenente
-- alla Lettura di un altro utente non è escluso da un vincolo dichiarativo
-- qui: chiuderlo del tutto richiederebbe un trigger, coerentemente con gli
-- altri vincoli tra righe già segnalati come fuori scope in questa
-- migrazione. La superficie di rischio è comunque minima: lettura_id qui
-- è solo un riferimento informativo ("da quale lettura viene l'insight"),
-- non entra in alcuna policy RLS né in alcun conteggio.
--
-- Nota: il contrassegno spoiler (PRD, regola 10 — mai restituito in
-- chiaro in elenchi/anteprime) è un comportamento di presentazione, non
-- di accesso alla riga: la RLS decide SE la riga è visibile, non COME va
-- resa; va applicato dal livello che serve le liste, non qui.

create table public.insight (
  id uuid primary key default gen_random_uuid(),
  voce_id uuid not null,
  lettura_id uuid references public.lettura (id) on delete set null,
  utente_id uuid not null,
  testo text not null,
  visibilita text not null default 'condiviso',
  spoiler boolean not null default false,
  -- "oggi" in Europa centrale, non nel fuso del server: vedi lettura.data_inizio.
  data date not null default ((now() at time zone 'Europe/Rome')::date),
  creato_at timestamptz not null default now(),
  constraint chk_insight_visibilita check (visibilita in ('condiviso', 'privato')),
  constraint fk_insight_voce_utente foreign key (voce_id, utente_id)
    references public.voce_di_libreria (id, utente_id) on delete cascade,
  -- Necessaria perché indice_semantico referenzi la coppia (id, utente_id).
  constraint uq_insight_id_utente unique (id, utente_id)
);

create index idx_insight_voce_id on public.insight (voce_id);
create index idx_insight_lettura_id on public.insight (lettura_id);
create index idx_insight_utente_id on public.insight (utente_id);

alter table public.insight enable row level security;

create policy insight_select_owner_o_condiviso
  on public.insight
  for select
  to authenticated
  using (
    auth.uid() = utente_id
    or (visibilita = 'condiviso' and public.is_collegato_attivo(utente_id))
  );

create policy insight_insert_owner
  on public.insight
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy insight_update_owner
  on public.insight
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy insight_delete_owner
  on public.insight
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.insight to authenticated;

-- ============================================================================
-- artefatto_generato
-- ============================================================================
-- Preview personalizzata o sintesi tematica. Sempre e solo privata:
-- nessuna colonna di visibilità, nessuna condizione "collegato" nella
-- SELECT (PRD, regola 23 — mai condivisibile).
--
-- utente_id qui mantiene una FK singola verso utente(id), perché la riga
-- non discende sempre da una Voce: la sintesi tematica ha voce_id nullo
-- per costruzione (è trasversale a più libri). In aggiunta, quando
-- voce_id è valorizzato (caso preview_personalizzata), la FK composita
-- verso voce_di_libreria verifica comunque la coerenza con l'utente
-- proprietario della Voce.

create table public.artefatto_generato (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utente (id) on delete cascade,
  tipo text not null,
  voce_id uuid,
  testo text not null,
  creato_at timestamptz not null default now(),
  constraint chk_artefatto_generato_tipo
    check (tipo in ('preview_personalizzata', 'sintesi_tematica')),
  constraint chk_artefatto_generato_voce_coerente check (
    (tipo = 'preview_personalizzata' and voce_id is not null)
    or (tipo = 'sintesi_tematica' and voce_id is null)
  ),
  constraint fk_artefatto_generato_voce_utente foreign key (voce_id, utente_id)
    references public.voce_di_libreria (id, utente_id) on delete cascade
);

create index idx_artefatto_generato_utente_id on public.artefatto_generato (utente_id);
create index idx_artefatto_generato_voce_id on public.artefatto_generato (voce_id);

alter table public.artefatto_generato enable row level security;

create policy artefatto_generato_select_owner
  on public.artefatto_generato
  for select
  to authenticated
  using (auth.uid() = utente_id);

create policy artefatto_generato_insert_owner
  on public.artefatto_generato
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy artefatto_generato_update_owner
  on public.artefatto_generato
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy artefatto_generato_delete_owner
  on public.artefatto_generato
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.artefatto_generato to authenticated;

-- ============================================================================
-- indice_semantico
-- ============================================================================
-- Embedding di insight e recensioni (ADR 0009). La SELECT rispecchia le
-- regole di accesso del contenuto di origine (PRD, regola 24): visibile
-- al proprietario sempre, e a un collegato attivo solo se la riga sorgente
-- è attualmente condivisa (join esplicito, non la sola utente_id
-- denormalizzata, perché la visibilità della sorgente può cambiare in
-- qualunque momento e deve riflettersi subito — PRD, regola 9).
--
-- utente_id mantiene una FK singola verso utente(id) (è sempre presente,
-- indipendentemente da quale dei due riferimenti è valorizzato), più due
-- FK composite verso insight(id, utente_id) e recensione(id, utente_id):
-- garantiscono che l'embedding sia intestato allo stesso utente che
-- possiede l'insight o la recensione di origine, non solo "un utente
-- qualsiasi che ha inserito quella riga" — stessa classe di vincolo delle
-- tabelle sopra, qui applicata anche se questa tabella non accetta scritture
-- dirette dagli utenti (vedi sotto): un lavoro in background con un bug può
-- comunque scrivere utente_id sbagliato, e senza la FK composita quella
-- riga passerebbe a insaputa di chiunque.
--
-- INSERT/UPDATE: NESSUNA policy per `authenticated` — non è
-- un'omissione. Questi embedding nascono e si aggiornano solo nei lavori
-- in background che chiamano il fornitore di modelli (ricostruzione
-- indici, nuova indicizzazione), eseguiti con la chiave di servizio e
-- mai con l'identità di un utente (ADR 0001: "i lavori in secondo piano
-- operano con un'identità tecnica che non serve mai richieste di
-- Utenti"). Per un utente autenticato, quindi, la RLS su questi due
-- comandi non è applicabile per costruzione: non esiste alcuna richiesta
-- utente che debba poterli eseguire.
--
-- DELETE: invece è raggiungibile dall'utente proprietario. Serve al
-- flusso di revoca del consenso ("gli indici semantici costruiti sui
-- contenuti dell'Utente vengono cancellati", PRD) quando è l'utente
-- stesso a spegnere l'interruttore: per ADR 0001 quella richiesta va
-- eseguita con la sua identità, non con la chiave di servizio, perché
-- nasce da una sua azione. È inoltre l'unico modo per rimuovere solo le
-- proprie righe senza toccare insight/recensioni di origine, che restano.

create table public.indice_semantico (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utente (id) on delete cascade,
  tipo_contenuto text not null,
  insight_id uuid,
  recensione_id uuid,
  embedding extensions.vector(1536) not null,
  creato_at timestamptz not null default now(),
  constraint chk_indice_semantico_tipo check (tipo_contenuto in ('insight', 'recensione')),
  constraint chk_indice_semantico_riferimento check (
    (tipo_contenuto = 'insight' and insight_id is not null and recensione_id is null)
    or (tipo_contenuto = 'recensione' and recensione_id is not null and insight_id is null)
  ),
  constraint fk_indice_semantico_insight_utente foreign key (insight_id, utente_id)
    references public.insight (id, utente_id) on delete cascade,
  constraint fk_indice_semantico_recensione_utente foreign key (recensione_id, utente_id)
    references public.recensione (id, utente_id) on delete cascade
);

comment on column public.indice_semantico.embedding is
  'Dimensione fissata a 1536 (OpenAI text-embedding-3-small) come default ragionevole: non era stata decisa nella proposta di schema. Da rivedere con un ALTER COLUMN se si sceglie un altro modello prima che la tabella contenga righe reali.';

create index idx_indice_semantico_utente_id on public.indice_semantico (utente_id);
create index idx_indice_semantico_insight_id on public.indice_semantico (insight_id);
create index idx_indice_semantico_recensione_id on public.indice_semantico (recensione_id);

alter table public.indice_semantico enable row level security;

create policy indice_semantico_select_come_origine
  on public.indice_semantico
  for select
  to authenticated
  using (
    auth.uid() = utente_id
    or (
      public.is_collegato_attivo(utente_id)
      and (
        (
          insight_id is not null
          and exists (
            select 1
            from public.insight i
            where i.id = indice_semantico.insight_id
              and i.visibilita = 'condiviso'
          )
        )
        or (
          recensione_id is not null
          and exists (
            select 1
            from public.recensione r
            where r.id = indice_semantico.recensione_id
              and r.visibilita = 'condiviso'
          )
        )
      )
    )
  );

create policy indice_semantico_delete_owner
  on public.indice_semantico
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, delete on table public.indice_semantico to authenticated;
