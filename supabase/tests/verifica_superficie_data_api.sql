-- Verifica manuale della superficie raggiungibile direttamente dalla Data
-- API (migrazione 20260826120000_chiusura_superficie_data_api.sql).
--
-- Le tre cose verificate qui erano tutte sfruttabili con la sola chiave
-- anonima — che vive nel bundle del browser, perché serve
-- all'autenticazione — parlando a PostgREST senza passare dal back end:
-- una RPC `security definer` eseguibile senza login, la prova
-- dell'informativa riscrivibile con DELETE + INSERT, e `nome_utente`
-- modificabile con una PATCH. Il back end non c'entra: sono privilegi di
-- tabella e di funzione, e vanno verificati qui.
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica ai grant di `utente`,
-- `utente_privato` o alle RPC, prima di aprire una PR (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_superficie_data_api.sql
--
-- (`DATABASE_URL` da `supabase status`.) `-v ON_ERROR_STOP=1` è
-- essenziale: senza, psql continua dopo un fallimento invece di fermarsi
-- al primo.
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: un Utente registrato. Creato come postgres, prima di
-- impersonare chiunque.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'verifica-api@example.com');

insert into public.utente (id, nome_utente) values
  ('00000000-0000-0000-0000-0000000000d1', 'verifica_api');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('00000000-0000-0000-0000-0000000000d1', now());

-- ---------------------------------------------------------------------------
-- 1. Nessuna RPC è eseguibile senza autenticazione (ADR 0006).
-- ---------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  -- `libri_popolari` è `security definer`: se `anon` può eseguirla, la RLS
  -- non viene valutata e la classifica esce intera, perché auth.uid() è
  -- NULL e il filtro "escludi i libri che ho già" non esclude nulla.
  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if n <> 0 then
    raise exception 'FALLITO: % funzioni di public sono ancora eseguibili da anon', n;
  end if;
  raise notice 'OK 01: nessuna funzione di public è eseguibile da anon';

  -- Il contrappeso: la revoca non deve aver portato via anche
  -- l'autenticato, che su alcune funzioni aveva il solo privilegio
  -- ereditato da PUBLIC.
  if not has_function_privilege('authenticated', 'public.libri_popolari(integer, text)', 'execute') then
    raise exception 'FALLITO: authenticated deve poter eseguire libri_popolari';
  end if;
  if not has_function_privilege('authenticated', 'public.completa_registrazione(text)', 'execute') then
    raise exception 'FALLITO: authenticated deve poter eseguire completa_registrazione';
  end if;
  raise notice 'OK 02: authenticated conserva l''esecuzione delle RPC applicative';
end $$;

-- ---------------------------------------------------------------------------
-- 2. `utente`: l'identità non si riscrive dal client.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

do $$
begin
  -- Il PRD dichiara nome_utente non modificabile: è l'ancoraggio
  -- d'identità su cui si accettano i collegamenti, e cambiarlo dopo che un
  -- collegamento è stato accettato è esattamente ciò che non deve
  -- succedere.
  begin
    update public.utente set nome_utente = 'dirottato'
     where id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLITO: nome_utente non deve essere modificabile dal client';
  exception when insufficient_privilege then
    raise notice 'OK 03: nome_utente è fuori portata del client';
  end;

  -- `creato_at` ordina "gli ultimi arrivati" di cerca_membri.
  begin
    update public.utente set creato_at = '1999-01-01'
     where id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLITO: creato_at non deve essere modificabile dal client';
  exception when insufficient_privilege then
    raise notice 'OK 04: creato_at è fuori portata del client';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. `utente_privato`: la prova dell'informativa non si falsifica, né
--    riscrivendola né ricreando la riga.
-- ---------------------------------------------------------------------------

do $$
declare
  quando timestamptz;
begin
  -- La strada diretta era già chiusa dal grant per colonna (20260822090000).
  begin
    update public.utente_privato set informativa_accettata_at = '1999-01-01'
     where utente_id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLITO: informativa_accettata_at non deve essere scrivibile';
  exception when insufficient_privilege then
    raise notice 'OK 05: informativa_accettata_at non è scrivibile con un update';
  end;

  -- La strada laterale: cancellare la riga e ricrearla con una data
  -- inventata. È quella che aggirava il grant per colonna in due chiamate.
  begin
    delete from public.utente_privato
     where utente_id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FALLITO: il client non deve poter cancellare la propria riga utente_privato';
  exception when insufficient_privilege then
    raise notice 'OK 06: utente_privato non è cancellabile dal client';
  end;

  -- E anche potendo inserire, il momento lo decide il database: il
  -- trigger sovrascrive qualunque valore proposto.
  insert into public.utente_privato (utente_id, informativa_accettata_at)
  values ('00000000-0000-0000-0000-0000000000d1', '1999-01-01')
  on conflict (utente_id) do nothing;

  select informativa_accettata_at into quando
    from public.utente_privato
   where utente_id = '00000000-0000-0000-0000-0000000000d1';
  if quando < now() - interval '1 hour' then
    raise exception 'FALLITO: informativa_accettata_at è stata falsificata (%)', quando;
  end if;
  raise notice 'OK 07: il momento dell''accettazione lo fissa il database';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. Le due strade legittime restano aperte: la cancellazione dell'account
--    porta via utente_privato per cascata, benché il DELETE sia revocato.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

do $$
declare
  n integer;
begin
  delete from public.utente where id = '00000000-0000-0000-0000-0000000000d1';

  select count(*) into n from public.utente_privato
   where utente_id = '00000000-0000-0000-0000-0000000000d1';
  if n <> 0 then
    raise exception 'FALLITO: la cascata deve rimuovere utente_privato (issue #8)';
  end if;
  raise notice 'OK 08: la cancellazione dell''account porta via utente_privato per cascata';
end $$;

reset role;

rollback;
