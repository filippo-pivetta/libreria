-- Verifica manuale del consenso all'elaborazione assistita e degli indici
-- semantici (issue #6): grant per colonna su `utente_privato`, privilegi
-- di `indice_semantico`, la RPC `cerca_semantico`, e le regole 23/24/30
-- del PRD sul lato database.
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica a
-- 20260822090000_consenso_e_funzioni_personali.sql o alle policy di
-- indice_semantico/artefatto_generato, prima di aprire una PR
-- (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_consenso_e_indici.sql
--
-- (`DATABASE_URL` da `supabase status`.) `-v ON_ERROR_STOP=1` è
-- essenziale: senza, psql continua dopo un fallimento invece di fermarsi
-- al primo.
--
-- Ciò che NON è verificabile qui e vive nei test pytest: il gating del
-- consenso (regola 30) e la validazione della regola 20 sono
-- comportamento applicativo, non di accesso alla riga — la RLS non sa
-- nulla dell'interruttore, e non deve saperlo: gli indici non spariscono
-- perché il database li nasconde, spariscono perché il service li
-- cancella.
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: A (proprietario) e B (collegato attivo), un libro, una Voce di
-- A con una recensione condivisa, un insight privato, un artefatto
-- generato e i vettori corrispondenti. Creati come postgres, prima di
-- impersonare chiunque.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica-a@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica-b@example.com');

insert into public.utente (id, nome_utente) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica_a'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica_b');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('00000000-0000-0000-0000-0000000000f1', now()),
  ('00000000-0000-0000-0000-0000000000f2', now());

insert into public.collegamento (utente_a_id, utente_b_id, stato, richiesto_da_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
   'attiva', '00000000-0000-0000-0000-0000000000f1');

insert into public.libro (id, titolo_canonico) values
  ('00000000-0000-0000-0000-0000000000b1', 'Libro di prova');

insert into public.voce_di_libreria (id, utente_id, libro_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000b1');

insert into public.recensione (id, voce_id, utente_id, testo, visibilita) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000f1', 'Un libro che resta addosso.', 'condiviso');

insert into public.insight (id, voce_id, utente_id, testo, visibilita) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000f1', 'Uno stile secco.', 'privato');

insert into public.artefatto_generato (id, utente_id, tipo, voce_id, testo) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
   'preview_personalizzata', '00000000-0000-0000-0000-0000000000a1', 'Un parere generato.');

-- Vettori: scritti come postgres, esattamente come farebbe il worker sulla
-- connessione diretta. Un vettore costante, perché quello che si verifica
-- qui è chi lo vede, non quanto somiglia a cosa.
insert into public.indice_semantico (utente_id, tipo_contenuto, recensione_id, embedding) values
  ('00000000-0000-0000-0000-0000000000f1', 'recensione',
   '00000000-0000-0000-0000-0000000000c1',
   array_fill(0.1::real, array[1536])::extensions.vector);

insert into public.indice_semantico (utente_id, tipo_contenuto, insight_id, embedding) values
  ('00000000-0000-0000-0000-0000000000f1', 'insight',
   '00000000-0000-0000-0000-0000000000c2',
   array_fill(0.2::real, array[1536])::extensions.vector);

-- ---------------------------------------------------------------------------
-- 1-4. Come A: i propri privilegi su utente_privato e indice_semantico.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  n integer;
begin
  -- 1. Il flag e lo stato degli indici sono scrivibili dal proprietario.
  update public.utente_privato
     set consenso_elaborazione_assistita = false,
         consenso_aggiornato_at = now(),
         indici_stato = 'spenti'
   where utente_id = '00000000-0000-0000-0000-0000000000f1';
  raise notice 'OK 01: il proprietario può spegnere il consenso e dichiarare gli indici spenti';

  -- 2. informativa_accettata_at NON è scrivibile: è la prova di un
  -- consenso informato (grant per colonna, 20260822090000).
  begin
    update public.utente_privato
       set informativa_accettata_at = '1999-01-01'
     where utente_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FALLITO: informativa_accettata_at non deve essere scrivibile dal client';
  exception when insufficient_privilege then
    raise notice 'OK 02: informativa_accettata_at è fuori portata del client';
  end;

  -- 3. Un valore fuori elenco per indici_stato viene rifiutato.
  begin
    update public.utente_privato set indici_stato = 'quasi'
     where utente_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FALLITO: chk_utente_privato_indici_stato doveva rifiutare "quasi"';
  exception when check_violation then
    raise notice 'OK 03: chk_utente_privato_indici_stato rifiuta un valore non ammesso';
  end;

  -- 4. Regola 30: il proprietario può cancellare i propri vettori, ed è
  -- così che la revoca del consenso li porta via.
  delete from public.indice_semantico
   where utente_id = '00000000-0000-0000-0000-0000000000f1';
  select count(*) into n from public.indice_semantico;
  if n <> 0 then
    raise exception 'FALLITO: la revoca deve poter cancellare tutti i propri vettori (regola 30)';
  end if;
  raise notice 'OK 04: il proprietario cancella i propri indici semantici';
end $$;

-- Rimessi come postgres per le verifiche successive.
reset role;
select set_config('request.jwt.claims', null, true);

update public.utente_privato
   set consenso_elaborazione_assistita = true, indici_stato = 'pronti'
 where utente_id = '00000000-0000-0000-0000-0000000000f1';

insert into public.indice_semantico (utente_id, tipo_contenuto, recensione_id, embedding) values
  ('00000000-0000-0000-0000-0000000000f1', 'recensione',
   '00000000-0000-0000-0000-0000000000c1',
   array_fill(0.1::real, array[1536])::extensions.vector);

insert into public.indice_semantico (utente_id, tipo_contenuto, insight_id, embedding) values
  ('00000000-0000-0000-0000-0000000000f1', 'insight',
   '00000000-0000-0000-0000-0000000000c2',
   array_fill(0.2::real, array[1536])::extensions.vector);

-- ---------------------------------------------------------------------------
-- 5-7. Come A: la RPC di ricerca, gli INSERT vietati, l'artefatto.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  n integer;
begin
  -- 5. Nessun INSERT dal client: i vettori nascono solo nei lavori in
  -- secondo piano, sulla connessione diretta (commento sullo schema).
  begin
    insert into public.indice_semantico (utente_id, tipo_contenuto, insight_id, embedding)
      values ('00000000-0000-0000-0000-0000000000f1', 'insight',
              '00000000-0000-0000-0000-0000000000c2',
              array_fill(0.3::real, array[1536])::extensions.vector);
    raise exception 'FALLITO: un utente autenticato non deve poter inserire un embedding';
  exception when insufficient_privilege then
    raise notice 'OK 05: INSERT su indice_semantico è fuori portata del client';
  end;

  -- 6. La ricerca vede i propri due contenuti, privati compresi: verso se
  -- stessi la visibilità non filtra nulla.
  select count(*) into n
    from public.cerca_semantico(array_fill(0.1::real, array[1536])::extensions.vector, 20);
  if n <> 2 then
    raise exception 'FALLITO: A deve trovare i propri 2 contenuti, trovati %', n;
  end if;
  raise notice 'OK 06: cerca_semantico restituisce i propri contenuti, privati compresi';

  -- 7. Regola 23: nessun UPDATE su un artefatto generato, nemmeno dal
  -- proprietario. Esiste o sparisce, non si riscrive.
  begin
    update public.artefatto_generato set testo = 'riscritto'
     where id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLITO: un artefatto generato non deve essere modificabile';
  exception when insufficient_privilege then
    raise notice 'OK 07: UPDATE su artefatto_generato è fuori portata, anche del proprietario';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8-10. Come B, collegato attivo: cosa NON deve vedere.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);

do $$
declare
  n integer;
begin
  -- 8. Regola 23: un artefatto generato di A non è visibile a nessuno,
  -- collegato attivo compreso.
  select count(*) into n from public.artefatto_generato;
  if n <> 0 then
    raise exception 'FALLITO: un collegato non deve vedere alcun artefatto generato (regola 23)';
  end if;
  raise notice 'OK 08: gli artefatti generati di A sono invisibili a B';

  -- 9. Regola 24: l'indice segue la visibilità della sorgente. B vede il
  -- vettore della recensione condivisa, non quello dell'insight privato.
  select count(*) into n from public.indice_semantico;
  if n <> 1 then
    raise exception
      'FALLITO: B deve vedere 1 solo vettore (la recensione condivisa), ne vede % (regola 24)', n;
  end if;
  select count(*) into n from public.indice_semantico where insight_id is not null;
  if n <> 0 then
    raise exception 'FALLITO: il vettore di un insight privato di A non è visibile a B';
  end if;
  raise notice 'OK 09: l''indice segue la visibilità della sorgente (regola 24)';

  -- 10. La ricerca semantica di B non attraversa i contenuti di A,
  -- nemmeno quelli condivisi: è la regola di prodotto in più rispetto
  -- alla 24 ("mai sui contenuti condivisi dai collegati").
  select count(*) into n
    from public.cerca_semantico(array_fill(0.1::real, array[1536])::extensions.vector, 20);
  if n <> 0 then
    raise exception 'FALLITO: la ricerca semantica di B non deve restituire nulla di A, ne trova %', n;
  end if;
  raise notice 'OK 10: cerca_semantico non attraversa i contenuti di un collegato';
end $$;

-- ---------------------------------------------------------------------------
-- 11. Come postgres: la cascata sulla cancellazione dell'account.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', null, true);

do $$
declare
  n integer;
begin
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';

  select count(*) into n from public.indice_semantico
   where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if n <> 0 then
    raise exception 'FALLITO: la cancellazione dell''account deve portare via i suoi vettori';
  end if;

  select count(*) into n from public.artefatto_generato
   where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if n <> 0 then
    raise exception 'FALLITO: la cancellazione dell''account deve portare via i suoi artefatti';
  end if;

  select count(*) into n from public.libro where id = '00000000-0000-0000-0000-0000000000b1';
  if n <> 1 then
    raise exception 'FALLITO: la scheda del Libro è dato condiviso e deve restare (regola 27)';
  end if;

  raise notice 'OK 11: la cancellazione dell''account travolge indici e artefatti, non il catalogo';
  raise notice 'TUTTE LE VERIFICHE SONO PASSATE (11/11)';
end $$;

rollback;
