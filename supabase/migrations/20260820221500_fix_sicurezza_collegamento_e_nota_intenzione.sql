-- Fix di sicurezza da revisione del repository (20 agosto 2026).
--
-- 1. collegamento: le policy INSERT/UPDATE non impedivano di forzare una
--    connessione "attiva" senza il consenso dell'altra parte (bypass
--    totale del modello di consenso su cui si regge l'accesso ai dati
--    condivisi con i collegati).
-- 2. voce_di_libreria.nota_intenzione: campo dichiarato "il più sensibile
--    dello schema" (commento sulla colonna, migrazione 20260818115830),
--    ma senza una tabella propria era sempre leggibile da qualunque
--    collegato attivo, come il resto della riga. Spostato in una tabella
--    dedicata con RLS chiusa al solo proprietario, stesso pattern già in
--    uso per utente/utente_privato.

-- ============================================================================
-- 1. collegamento — chiudere il bypass del consenso
-- ============================================================================

-- INSERT: senza `stato = 'in_attesa'` nel with check, un utente poteva
-- inserire direttamente una riga con stato = 'attiva', saltando
-- l'accettazione della controparte.
drop policy collegamento_insert_richiedente on public.collegamento;

create policy collegamento_insert_richiedente
  on public.collegamento
  for insert
  to authenticated
  with check (
    auth.uid() = richiesto_da_id
    and (auth.uid() = utente_a_id or auth.uid() = utente_b_id)
    and stato = 'in_attesa'
  );

-- UPDATE: la policy esistente (invariata sotto) vincola solo i valori
-- booleani sul *nuovo* stato della riga, non la loro uguaglianza con la
-- riga esistente. Chi riceve una richiesta legittima da X poteva, nello
-- stesso UPDATE, riscrivere utente_a_id/utente_b_id/richiesto_da_id per
-- puntare a una vittima V arbitraria (il cui id è leggibile da chiunque
-- via utente_select_autenticati) e impostare stato = 'attiva'. Fix:
-- revocare UPDATE sulle colonne di identità, lasciando scrivibile solo
-- stato (e aggiornato_at) — l'unico uso legittimo di questo comando è
-- l'accettazione in_attesa -> attiva. Il privilegio a livello di colonna
-- è verificato da Postgres prima ancora della RLS, quindi basta da solo
-- a chiudere il bypass: la policy `collegamento_update_partecipante_non_
-- richiedente` (migrazione 20260818115830) non va toccata.
revoke update on public.collegamento from authenticated;
grant update (stato, aggiornato_at) on public.collegamento to authenticated;

-- ============================================================================
-- 2. voce_di_libreria_privata — nota_intenzione fuori dalla riga condivisa
-- ============================================================================

create table public.voce_di_libreria_privata (
  voce_id uuid primary key,
  utente_id uuid not null,
  nota_intenzione text,
  constraint fk_voce_di_libreria_privata_voce_utente foreign key (voce_id, utente_id)
    references public.voce_di_libreria (id, utente_id) on delete cascade
);

comment on table public.voce_di_libreria_privata is
  'Dati privati di voce_di_libreria mai visibili a un collegato attivo: oggi solo nota_intenzione (il campo più sensibile dello schema, contiene abitualmente nomi di terzi che non hanno mai dato consenso). Stesso pattern di utente/utente_privato: RLS chiusa al solo proprietario, a differenza di voce_di_libreria che i collegati attivi possono leggere per intero.';

create index idx_voce_di_libreria_privata_utente_id on public.voce_di_libreria_privata (utente_id);

-- Migrazione dei dati esistenti prima di eliminare la colonna.
insert into public.voce_di_libreria_privata (voce_id, utente_id, nota_intenzione)
select id, utente_id, nota_intenzione
from public.voce_di_libreria
where nota_intenzione is not null;

alter table public.voce_di_libreria drop column nota_intenzione;

alter table public.voce_di_libreria_privata enable row level security;

create policy voce_di_libreria_privata_select_owner
  on public.voce_di_libreria_privata
  for select
  to authenticated
  using (auth.uid() = utente_id);

create policy voce_di_libreria_privata_insert_owner
  on public.voce_di_libreria_privata
  for insert
  to authenticated
  with check (auth.uid() = utente_id);

create policy voce_di_libreria_privata_update_owner
  on public.voce_di_libreria_privata
  for update
  to authenticated
  using (auth.uid() = utente_id)
  with check (auth.uid() = utente_id);

create policy voce_di_libreria_privata_delete_owner
  on public.voce_di_libreria_privata
  for delete
  to authenticated
  using (auth.uid() = utente_id);

grant select, insert, update, delete on table public.voce_di_libreria_privata to authenticated;
