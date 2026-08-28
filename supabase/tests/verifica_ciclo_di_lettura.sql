-- Verifica manuale dei trigger e della RPC del ciclo di lettura (issue #2,
-- migrazione 20260820065144_ciclo_di_lettura.sql).
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica ai trigger/RPC, prima
-- di aprire una PR (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_ciclo_di_lettura.sql
--
-- (`DATABASE_URL` da `supabase status`, di norma
-- postgresql://postgres:postgres@127.0.0.1:54322/postgres in locale.)
-- `-v ON_ERROR_STOP=1` è essenziale: senza, psql continua dopo un
-- fallimento e produce solo rumore ("transazione abortita") invece di
-- fermarsi al primo problema.
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale:
-- nessuna riga di fixture sopravvive, che lo script passi o fallisca.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: due utenti di test e due libri seminati. Creati come
-- postgres/service_role (privilegi pieni), prima di impersonare
-- l'utente di test qui sotto.
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

insert into public.libro (id, titolo_canonico) values
  ('00000000-0000-0000-0000-0000000000b1', 'Libro di prova'),
  -- Uno per ciascuna delle tre precisioni di «l'ho già letto»
  -- (20260827160000): una Voce è unica per (utente, libro), quindi tre
  -- registrazioni a posteriori vogliono tre libri.
  ('00000000-0000-0000-0000-0000000000b2', 'Letto, so il giorno'),
  ('00000000-0000-0000-0000-0000000000b3', 'Letto, so solo l''anno'),
  ('00000000-0000-0000-0000-0000000000b4', 'Letto, non so quando');

-- Impersona l'utente A per il resto della sessione: auth.uid() legge da
-- request.jwt.claims, esattamente come farebbe PostgREST per una
-- richiesta autenticata reale — da qui in poi si passa dalle stesse RLS
-- del backend, non dai privilegi di postgres.
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_voce_id uuid;
  v_lettura_1_id uuid;
  v_lettura_2_id uuid;
  v_lettura_3_id uuid;
  v_voce_2_id uuid;
  v_voce_3_id uuid;
  v_voce_4_id uuid;
  v_lettura record;
  v_stato text;
  v_n integer;
  v_pagina integer;
  v_auto boolean;
begin
  -- 1. Crea la Voce (POST /voci, in questa migrazione un semplice INSERT).
  insert into public.voce_di_libreria (utente_id, libro_id)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1')
    returning id into v_voce_id;

  -- 2. Matrice: da_leggere -> abbandonato resta vietata. Da leggere ->
  -- letto invece ora è ammessa (20260827160000, la lettura registrata a
  -- posteriori) e ha i suoi casi in fondo, dalla 19 in poi.
  begin
    perform public.cambia_stato_voce(v_voce_id, 'abbandonato', null);
    raise exception 'FALLITO: da_leggere -> abbandonato doveva essere rifiutata';
  exception when sqlstate 'MTG10' then
    raise notice 'OK 01: da_leggere -> abbandonato rifiutata (MTG10)';
  end;

  -- 3. da_leggere -> in_lettura: ammessa, apre una Lettura.
  perform public.cambia_stato_voce(v_voce_id, 'in_lettura', null);
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'in_lettura' then
    raise exception 'FALLITO: stato atteso in_lettura, trovato %', v_stato;
  end if;
  select id into v_lettura_1_id from public.lettura where voce_id = v_voce_id and esito is null;
  raise notice 'OK 02: da_leggere -> in_lettura apre una Lettura (%)', v_lettura_1_id;

  -- 4. Avanzamento valido: pagina 50 oggi.
  insert into public.avanzamento (lettura_id, utente_id, pagina, data)
    values (v_lettura_1_id, '00000000-0000-0000-0000-0000000000f1', 50, v_oggi);
  raise notice 'OK 03: avanzamento a pagina 50 accettato';

  -- 5. Avanzamento regressivo: rifiutato (MTG03).
  begin
    insert into public.avanzamento (lettura_id, utente_id, pagina, data)
      values (v_lettura_1_id, '00000000-0000-0000-0000-0000000000f1', 30, v_oggi);
    raise exception 'FALLITO: pagina regressiva doveva essere rifiutata';
  exception when sqlstate 'MTG03' then
    raise notice 'OK 04: pagina regressiva (30 dopo 50) rifiutata (MTG03)';
  end;

  -- 6. Avanzamento futuro: rifiutato (MTG01).
  begin
    insert into public.avanzamento (lettura_id, utente_id, pagina, data)
      values (v_lettura_1_id, '00000000-0000-0000-0000-0000000000f1', 60, v_oggi + 1);
    raise exception 'FALLITO: data futura doveva essere rifiutata';
  exception when sqlstate 'MTG01' then
    raise notice 'OK 05: data futura rifiutata (MTG01)';
  end;

  -- 7. Secondo avanzamento valido: pagina 80.
  insert into public.avanzamento (lettura_id, utente_id, pagina, data)
    values (v_lettura_1_id, '00000000-0000-0000-0000-0000000000f1', 80, v_oggi);
  raise notice 'OK 06: avanzamento a pagina 80 accettato';

  -- 8. Correggere pagine_adottate sotto un avanzamento esistente (60 < 80):
  -- rifiutato (MTG11).
  begin
    update public.voce_di_libreria set pagine_adottate = 60 where id = v_voce_id;
    raise exception 'FALLITO: pagine_adottate=60 sotto un avanzamento di 80 doveva essere rifiutato';
  exception when sqlstate 'MTG11' then
    raise notice 'OK 07: pagine_adottate sotto un avanzamento esistente rifiutata (MTG11)';
  end;

  -- 9. Correggere pagine_adottate sopra: accettato.
  update public.voce_di_libreria set pagine_adottate = 100 where id = v_voce_id;
  raise notice 'OK 08: pagine_adottate=100 accettato';

  -- 10. Avanzamento oltre il tetto: rifiutato (MTG06).
  begin
    insert into public.avanzamento (lettura_id, utente_id, pagina, data)
      values (v_lettura_1_id, '00000000-0000-0000-0000-0000000000f1', 150, v_oggi);
    raise exception 'FALLITO: pagina oltre pagine_adottate doveva essere rifiutata';
  exception when sqlstate 'MTG06' then
    raise notice 'OK 09: pagina oltre pagine_adottate (150 > 100) rifiutata (MTG06)';
  end;

  -- 11. Chiusura in "letto": genera l'avanzamento finale automatico a 100.
  perform public.cambia_stato_voce(v_voce_id, 'letto', v_oggi);
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'letto' then
    raise exception 'FALLITO: stato atteso letto, trovato %', v_stato;
  end if;
  select pagina, generato_automaticamente into v_pagina, v_auto
    from public.avanzamento
    where lettura_id = v_lettura_1_id
    order by data desc, creato_at desc
    limit 1;
  if v_pagina <> 100 or v_auto is not true then
    raise exception 'FALLITO: atteso avanzamento finale automatico a 100, trovato % (auto=%)', v_pagina, v_auto;
  end if;
  raise notice 'OK 10: chiusura in letto genera l''avanzamento finale automatico (100)';

  -- 12. Correggere pagine_adottate mentre è "letto": l'avanzamento
  -- automatico si adegua da solo, senza crearne uno nuovo.
  update public.voce_di_libreria set pagine_adottate = 120 where id = v_voce_id;
  select count(*) into v_n from public.avanzamento where lettura_id = v_lettura_1_id;
  if v_n <> 3 then
    raise exception 'FALLITO: attesi 3 avanzamenti sulla prima Lettura (50, 80, auto), trovati %', v_n;
  end if;
  select pagina into v_pagina from public.avanzamento
    where lettura_id = v_lettura_1_id and generato_automaticamente;
  if v_pagina <> 120 then
    raise exception 'FALLITO: avanzamento automatico atteso a 120, trovato %', v_pagina;
  end if;
  raise notice 'OK 11: correzione pagine_adottate a 120 adegua l''avanzamento automatico, non ne crea uno nuovo';

  -- 13. Correggere pagine_adottate sotto il nuovo massimo (90 < 120,
  -- il massimo ora include l'avanzamento automatico aggiornato):
  -- rifiutata.
  begin
    update public.voce_di_libreria set pagine_adottate = 90 where id = v_voce_id;
    raise exception 'FALLITO: pagine_adottate=90 sotto il massimo aggiornato doveva essere rifiutato';
  exception when sqlstate 'MTG11' then
    raise notice 'OK 12: pagine_adottate sotto il massimo aggiornato (90 < 120) rifiutata (MTG11)';
  end;

  -- 14. Rilettura: letto -> in_lettura apre una SECONDA Lettura indipendente.
  perform public.cambia_stato_voce(v_voce_id, 'in_lettura', null);
  select id into v_lettura_2_id
    from public.lettura where voce_id = v_voce_id and esito is null;
  if v_lettura_2_id = v_lettura_1_id then
    raise exception 'FALLITO: la rilettura deve aprire una Lettura nuova, non riusare la prima';
  end if;
  -- Riparte da zero: una pagina bassa non collide con la prima Lettura,
  -- che ha un conteggio indipendente.
  insert into public.avanzamento (lettura_id, utente_id, pagina, data)
    values (v_lettura_2_id, '00000000-0000-0000-0000-0000000000f1', 10, v_oggi);
  raise notice 'OK 13: rilettura apre una seconda Lettura indipendente, conteggio riparte da zero';

  -- 15. Abbandono: nessun avanzamento automatico generato.
  perform public.cambia_stato_voce(v_voce_id, 'abbandonato', v_oggi);
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'abbandonato' then
    raise exception 'FALLITO: stato atteso abbandonato, trovato %', v_stato;
  end if;
  select count(*) into v_n from public.avanzamento
    where lettura_id = v_lettura_2_id and generato_automaticamente;
  if v_n <> 0 then
    raise exception 'FALLITO: un abbandono non deve generare un avanzamento automatico';
  end if;
  raise notice 'OK 14: abbandono chiude senza generare un avanzamento automatico';

  -- 16. Terza apertura (ripresa dell'abbandono), poi annullata per
  -- errore: in_lettura -> da_leggere cancella la Lettura aperta e i
  -- suoi avanzamenti.
  perform public.cambia_stato_voce(v_voce_id, 'in_lettura', null);
  select id into v_lettura_3_id
    from public.lettura where voce_id = v_voce_id and esito is null;
  insert into public.avanzamento (lettura_id, utente_id, pagina, data)
    values (v_lettura_3_id, '00000000-0000-0000-0000-0000000000f1', 5, v_oggi);

  perform public.cambia_stato_voce(v_voce_id, 'da_leggere', null);
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'da_leggere' then
    raise exception 'FALLITO: stato atteso da_leggere, trovato %', v_stato;
  end if;
  if exists (select 1 from public.lettura where id = v_lettura_3_id) then
    raise exception 'FALLITO: la terza Lettura doveva essere cancellata';
  end if;
  raise notice 'OK 15: in_lettura -> da_leggere annulla la Lettura aperta e i suoi avanzamenti';

  -- 17. Cancellazione diretta di una Lettura chiusa (non l'ultima
  -- aperta): ricalcolo dello stato dalle rimanenti. Restano solo
  -- lettura_1 (letto) e lettura_2 (abbandonato); si cancella la più
  -- vecchia (lettura_1, "letto") e ci si aspetta che lo stato ricada
  -- sull'ultima rimasta per data_fine, cioè lettura_2 (abbandonato).
  delete from public.lettura where id = v_lettura_1_id;
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'abbandonato' then
    raise exception 'FALLITO: dopo la cancellazione di lettura_1 lo stato atteso è abbandonato, trovato %', v_stato;
  end if;
  raise notice 'OK 16: DELETE diretta di una Lettura chiusa ricalcola lo stato dalle rimanenti (abbandonato)';

  -- 18. Cancellazione dell'ultima Lettura rimasta: nessuna resta, lo
  -- stato torna a "da leggere".
  delete from public.lettura where id = v_lettura_2_id;
  select stato into v_stato from public.voce_di_libreria where id = v_voce_id;
  if v_stato <> 'da_leggere' then
    raise exception 'FALLITO: senza alcuna Lettura rimasta lo stato atteso è da_leggere, trovato %', v_stato;
  end if;
  raise notice 'OK 17: cancellata l''ultima Lettura, lo stato ricade su da_leggere';

  -- ==========================================================
  -- «L'ho già letto»: la lettura registrata a posteriori
  -- (20260827160000). Tre precisioni, e in nessuna delle tre
  -- l'app inventa una data che l'Utente non ha dato.
  -- ==========================================================

  -- 19. So il giorno: nasce una Lettura già chiusa, senza data di
  -- inizio, e l'avanzamento finale automatico si genera come per una
  -- chiusura normale, perché c'è un giorno a cui datarlo.
  insert into public.voce_di_libreria (utente_id, libro_id, pagine_adottate)
    values ('00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000b2', 200)
    returning id into v_voce_2_id;
  perform public.cambia_stato_voce(v_voce_2_id, 'letto', date '2019-03-12', 'giorno');

  select stato into v_stato from public.voce_di_libreria where id = v_voce_2_id;
  if v_stato <> 'letto' then
    raise exception 'FALLITO: stato atteso letto, trovato %', v_stato;
  end if;
  select id, data_inizio, data_fine, anno_fine, esito into v_lettura
    from public.lettura where voce_id = v_voce_2_id;
  if v_lettura.data_inizio is not null then
    raise exception 'FALLITO: una lettura registrata a posteriori non ha data di inizio, trovata %',
      v_lettura.data_inizio;
  end if;
  if v_lettura.data_fine <> date '2019-03-12' or v_lettura.anno_fine is not null
     or v_lettura.esito <> 'conclusa' then
    raise exception 'FALLITO: chiusura al giorno non registrata come attesa (% / % / %)',
      v_lettura.data_fine, v_lettura.anno_fine, v_lettura.esito;
  end if;
  select count(*), max(pagina), max(data::text) into v_n, v_pagina, v_stato
    from public.avanzamento where lettura_id = v_lettura.id and generato_automaticamente;
  if v_n <> 1 or v_pagina <> 200 or v_stato <> '2019-03-12' then
    raise exception 'FALLITO: atteso un avanzamento automatico a 200 datato 2019-03-12 (% / % / %)',
      v_n, v_pagina, v_stato;
  end if;
  raise notice 'OK 18: da_leggere -> letto con il giorno: Lettura chiusa senza inizio, avanzamento finale generato';

  -- 20. So solo l'anno: `anno_fine` valorizzato, `data_fine` nulla, e
  -- NESSUN avanzamento automatico — non c'è un giorno a cui datarlo, e
  -- inventarne uno rimetterebbe dentro il dato falso. Le pagine di
  -- questa lettura entrano comunque nel totale dell'anno, ma le somma
  -- il calcolo delle metriche, non una riga scritta qui.
  insert into public.voce_di_libreria (utente_id, libro_id, pagine_adottate)
    values ('00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000b3', 150)
    returning id into v_voce_3_id;
  perform public.cambia_stato_voce(v_voce_3_id, 'letto', null, 'anno', 2019);

  select id, data_inizio, data_fine, anno_fine, esito into v_lettura
    from public.lettura where voce_id = v_voce_3_id;
  if v_lettura.data_fine is not null or v_lettura.anno_fine <> 2019
     or v_lettura.esito <> 'conclusa' then
    raise exception 'FALLITO: chiusura alla sola annata non registrata come attesa (% / % / %)',
      v_lettura.data_fine, v_lettura.anno_fine, v_lettura.esito;
  end if;
  select count(*) into v_n from public.avanzamento where lettura_id = v_lettura.id;
  if v_n <> 0 then
    raise exception 'FALLITO: senza un giorno non si genera alcun avanzamento, trovati %', v_n;
  end if;
  raise notice 'OK 19: da_leggere -> letto con la sola annata: anno_fine 2019, nessun avanzamento';

  -- 21. Non so quando: nessuna delle due date. È una Lettura conclusa a
  -- tutti gli effetti — sta nello storico e nel conteggio a vita — che
  -- però non appartiene ad alcun anno, quindi le metriche annuali non la
  -- vedranno mai.
  insert into public.voce_di_libreria (utente_id, libro_id, pagine_adottate)
    values ('00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000b4', 90)
    returning id into v_voce_4_id;
  perform public.cambia_stato_voce(v_voce_4_id, 'letto', null, 'ignota');

  select id, data_fine, anno_fine, esito into v_lettura
    from public.lettura where voce_id = v_voce_4_id;
  if v_lettura.data_fine is not null or v_lettura.anno_fine is not null
     or v_lettura.esito <> 'conclusa' then
    raise exception 'FALLITO: chiusura senza data non registrata come attesa (% / % / %)',
      v_lettura.data_fine, v_lettura.anno_fine, v_lettura.esito;
  end if;
  raise notice 'OK 20: da_leggere -> letto senza alcuna data: Lettura conclusa e senza anno';

  -- 22. Una Lettura conclusa senza data NON è una Lettura aperta.
  -- È la trappola di questa migrazione: finché l'unicità filtrava su
  -- `data_fine is null`, la riga del caso 21 avrebbe occupato il posto
  -- della Lettura aperta, e "Rileggi" sarebbe fallito con una violazione
  -- di unicità incomprensibile.
  perform public.cambia_stato_voce(v_voce_4_id, 'in_lettura', v_oggi);
  select count(*) into v_n from public.lettura where voce_id = v_voce_4_id;
  if v_n <> 2 then
    raise exception 'FALLITO: la rilettura doveva aggiungersi alla conclusa senza data, trovate % Letture', v_n;
  end if;
  select count(*) into v_n from public.lettura where voce_id = v_voce_4_id and esito is null;
  if v_n <> 1 then
    raise exception 'FALLITO: una sola Lettura aperta attesa, trovate %', v_n;
  end if;
  raise notice 'OK 21: una conclusa senza data non occupa il posto della Lettura aperta';

  -- 23. Annata futura: rifiutata (MTG14), come lo è una data futura per
  -- un Avanzamento e per la stessa ragione.
  begin
    perform public.cambia_stato_voce(
      v_voce_4_id, 'letto', null, 'anno', extract(year from v_oggi)::integer + 1);
    raise exception 'FALLITO: un anno di conclusione futuro doveva essere rifiutato';
  exception when sqlstate 'MTG14' then
    raise notice 'OK 22: annata di conclusione futura rifiutata (MTG14)';
  end;

  -- 24. Le due precisioni si escludono: nessuna riga può portarle
  -- entrambe (chk_lettura_una_sola_precisione).
  begin
    update public.lettura set anno_fine = 2019
      where voce_id = v_voce_2_id and data_fine is not null;
    raise exception 'FALLITO: data_fine e anno_fine insieme dovevano essere rifiutate';
  exception when check_violation then
    raise notice 'OK 23: data_fine e anno_fine insieme rifiutate (chk_lettura_una_sola_precisione)';
  end;

  raise notice 'TUTTE LE VERIFICHE SONO PASSATE (23/23)';
end $$;

-- ---------------------------------------------------------------------------
-- 19. RLS: l'utente B non vede né può scrivere sui dati dell'utente A
-- (nessun collegamento attivo — regola 5, già impalcata dalle FK
-- composite e dalle policy esistenti, qui solo esercitata).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);

do $$
declare
  v_voce_id_di_a uuid;
  v_n integer;
begin
  select id into v_voce_id_di_a from public.voce_di_libreria
    where utente_id = '00000000-0000-0000-0000-0000000000f1'
    limit 1;

  select count(*) into v_n from public.voce_di_libreria where id = v_voce_id_di_a;
  if v_n <> 0 then
    raise exception 'FALLITO: l''utente B non collegato non deve vedere la Voce dell''utente A';
  end if;

  begin
    update public.voce_di_libreria set pagine_adottate = 1 where id = v_voce_id_di_a;
    if found then
      raise exception 'FALLITO: l''utente B non deve poter scrivere sulla Voce dell''utente A';
    end if;
  exception when sqlstate 'MTG11' then
    raise exception 'FALLITO: la scrittura di B su A non doveva nemmeno raggiungere il trigger';
  end;

  raise notice 'OK 24: RLS — l''utente B non collegato non vede né può scrivere sui dati dell''utente A';
end $$;

rollback;
