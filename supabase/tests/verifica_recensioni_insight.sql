-- Verifica manuale delle RLS di `recensione` e `insight` (issue #5,
-- schema/RLS preesistenti dalla migrazione
-- 20260818115830_schema_montaigne.sql — questa issue non ne aggiunge di
-- nuove, le esercita soltanto).
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica alle policy di
-- recensione/insight o alla funzione is_collegato_attivo, prima di aprire
-- una PR (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_recensioni_insight.sql
--
-- (`DATABASE_URL` da `supabase status`, di norma
-- postgresql://postgres:postgres@127.0.0.1:54322/postgres in locale.)
-- `-v ON_ERROR_STOP=1` è essenziale, stesso motivo di
-- verifica_ciclo_di_lettura.sql.
--
-- Il gating dello spoiler (regola 10) NON è verificato qui: è
-- comportamento applicativo (app/services/insight_service.py), non di
-- accesso alla riga — coperto da backend/tests/test_insight.py e dal test
-- cardine in backend/tests/test_voci.py
-- (test_get_voce_dettaglio_nasconde_testo_spoiler_anche_al_proprietario).
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: tre utenti (A proprietario, B da collegare, C mai collegato) e
-- un libro seminato. Creati come postgres/service_role, prima di
-- impersonare l'utente di test.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica-a@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica-b@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'verifica-c@example.com');

insert into public.utente (id, nome_utente) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica_a'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica_b'),
  ('00000000-0000-0000-0000-0000000000f3', 'verifica_c');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('00000000-0000-0000-0000-0000000000f1', now()),
  ('00000000-0000-0000-0000-0000000000f2', now()),
  ('00000000-0000-0000-0000-0000000000f3', now());

insert into public.libro (id, titolo_canonico) values
  ('00000000-0000-0000-0000-0000000000b1', 'Libro di prova');

-- Impersona A: crea la Voce, una recensione e un insight.
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  v_voce_id uuid;
  v_visibilita text;
begin
  insert into public.voce_di_libreria (utente_id, libro_id)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1')
    returning id into v_voce_id;

  insert into public.recensione (voce_id, utente_id, testo)
    values (v_voce_id, '00000000-0000-0000-0000-0000000000f1', 'Un libro che resta addosso.');
  insert into public.insight (voce_id, utente_id, testo)
    values (v_voce_id, '00000000-0000-0000-0000-0000000000f1', 'Uno stile secco.');

  select visibilita into v_visibilita from public.recensione where voce_id = v_voce_id;
  if v_visibilita <> 'condiviso' then
    raise exception 'FALLITO: la recensione deve nascere condivisa per default (regola 2)';
  end if;
  select visibilita into v_visibilita from public.insight where voce_id = v_voce_id;
  if v_visibilita <> 'condiviso' then
    raise exception 'FALLITO: l''insight deve nascere condiviso per default (regola 2)';
  end if;
  raise notice 'OK 01: recensione e insight nascono condivisi per default (regola 2)';
end $$;

-- ---------------------------------------------------------------------------
-- B, senza alcun collegamento con A: nessuna visibilità (regola 1/4).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.recensione
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: B non collegato non deve vedere la recensione di A (regola 1/4)';
  end if;

  select count(*) into v_n from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: B non collegato non deve vedere l''insight di A (regola 1/4)';
  end if;

  raise notice 'OK 02: B non collegato non vede recensione né insight di A (regola 1/4)';
end $$;

-- ---------------------------------------------------------------------------
-- Attiva il collegamento A-B (come service_role, fuori dal percorso
-- applicativo: qui interessa solo lo stato risultante, non come vi si
-- arriva — quello è coperto da supabase/tests di #3 se esistono).
-- ---------------------------------------------------------------------------

reset role;

insert into public.collegamento (utente_a_id, utente_b_id, richiesto_da_id, stato) values (
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000f1',
  'attiva'
);

-- ---------------------------------------------------------------------------
-- B, ora collegato attivo: vede recensione e insight condivisi (regola 2).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.recensione
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 1 then
    raise exception 'FALLITO: B collegato attivo deve vedere la recensione condivisa di A';
  end if;

  select count(*) into v_n from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 1 then
    raise exception 'FALLITO: B collegato attivo deve vedere l''insight condiviso di A';
  end if;

  raise notice 'OK 03: B collegato attivo vede recensione e insight condivisi (regola 2)';
end $$;

-- ---------------------------------------------------------------------------
-- B tenta di scrivere sui contenuti di A: la RLS lo impedisce silenziosamente
-- (0 righe affette, non un'eccezione — regola 5).
-- ---------------------------------------------------------------------------

do $$
declare
  v_recensione_id uuid;
  v_insight_id uuid;
begin
  select id into v_recensione_id from public.recensione
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  select id into v_insight_id from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';

  update public.recensione set testo = 'dirottata da B' where id = v_recensione_id;
  if found then
    raise exception 'FALLITO: B non deve poter scrivere sulla recensione di A (regola 5)';
  end if;

  update public.insight set testo = 'dirottato da B' where id = v_insight_id;
  if found then
    raise exception 'FALLITO: B non deve poter scrivere sull''insight di A (regola 5)';
  end if;

  delete from public.recensione where id = v_recensione_id;
  if found then
    raise exception 'FALLITO: B non deve poter cancellare la recensione di A (regola 5)';
  end if;

  raise notice 'OK 04: B collegato non può scrivere né cancellare i contenuti di A (regola 5)';
end $$;

-- ---------------------------------------------------------------------------
-- A rende privato l'insight: B smette immediatamente di vederlo (regola 9,
-- testo esatto del PRD: "B legge un insight condiviso di A; A lo rende
-- privato; alla richiesta successiva non lo trova").
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);

update public.insight set visibilita = 'privato'
  where utente_id = '00000000-0000-0000-0000-0000000000f1';

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: B non deve più vedere l''insight di A reso privato (regola 9)';
  end if;
  raise notice 'OK 05: cambio di visibilità ha effetto immediato (regola 9)';
end $$;

-- ---------------------------------------------------------------------------
-- Caso limite: toggle rapido privato->condiviso->privato. Lo stato finale
-- che B legge deve essere coerente con l'ultimo update, mai un contenuto
-- "tornato privato" restituito come condiviso.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);

update public.insight set visibilita = 'condiviso'
  where utente_id = '00000000-0000-0000-0000-0000000000f1';
update public.insight set visibilita = 'privato'
  where utente_id = '00000000-0000-0000-0000-0000000000f1';

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: toggle rapido deve convergere sull''ultimo valore (privato), nessun lettore deve vedere un contenuto tornato privato';
  end if;
  raise notice 'OK 06: toggle di visibilità in rapida successione converge deterministicamente (caso limite)';
end $$;

-- ---------------------------------------------------------------------------
-- C, mai collegato a nessuno: nessuna visibilità su A, a prescindere dalla
-- visibilità dei suoi contenuti (regola 1/4, replica del test testuale
-- del PRD: "A condivide voto, recensione e insight; C non collegato
-- interroga ogni vista... rifiuto").
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f3', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.recensione
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: C non collegato non deve vedere alcuna recensione di A (regola 1/4)';
  end if;

  select count(*) into v_n from public.insight
    where utente_id = '00000000-0000-0000-0000-0000000000f1';
  if v_n <> 0 then
    raise exception 'FALLITO: C non collegato non deve vedere alcun insight di A (regola 1/4)';
  end if;

  raise notice 'OK 07: C non collegato non vede nulla di A, indipendentemente dalla visibilità (regola 1/4)';
end $$;

-- ---------------------------------------------------------------------------
-- Vincoli dichiarativi: valori di visibilità non ammessi sono rifiutati a
-- livello di schema, indipendentemente dalla validazione applicativa.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_voce_id uuid;
begin
  select id into v_voce_id from public.voce_di_libreria
    where utente_id = '00000000-0000-0000-0000-0000000000f1';

  begin
    update public.recensione set visibilita = 'pubblico' where voce_id = v_voce_id;
    raise exception 'FALLITO: chk_recensione_visibilita doveva rifiutare "pubblico"';
  exception when check_violation then
    raise notice 'OK 08: chk_recensione_visibilita rifiuta un valore non ammesso';
  end;

  begin
    update public.insight set visibilita = 'pubblico' where voce_id = v_voce_id;
    raise exception 'FALLITO: chk_insight_visibilita doveva rifiutare "pubblico"';
  exception when check_violation then
    raise notice 'OK 09: chk_insight_visibilita rifiuta un valore non ammesso';
  end;

  raise notice 'TUTTE LE VERIFICHE SONO PASSATE (9/9)';
end $$;

rollback;
