-- Verifica manuale del corpus dei Quaderni (design-frontend.md §22): la
-- vista `scritto` e le quattro funzioni della migrazione
-- 20260825170000_quaderni_corpus.sql.
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica a quella migrazione o
-- alle policy di insight/recensione/indice_semantico, prima di aprire una
-- PR (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_quaderni.sql
--
-- (`DATABASE_URL` da `supabase status`.) `-v ON_ERROR_STOP=1` è
-- essenziale: senza, psql continua dopo un fallimento invece di fermarsi
-- al primo.
--
-- Ciò che si verifica QUI e non in pytest: chi vede cosa. La vista
-- `scritto` è `security_invoker`, quindi la RLS di insight e recensione
-- resta l'unico punto in cui vive la regola — e il rischio che questa
-- migrazione introduce è esattamente quello di averla aggirata. Un
-- collegato di A vede legittimamente la recensione condivisa di A dalla
-- scheda del libro; non deve vederla dai PROPRI Quaderni, perché la
-- ricerca semantica del PRD è "sulla propria libreria e sui propri
-- insight, mai sui contenuti condivisi dai collegati".
--
-- Ciò che invece vive in pytest (tests/test_quaderni.py): il consenso
-- come interruttore su una parte invece che come cancello, e il fatto
-- che a indici spenti il conteggio dei vicini sia `null` e non `0`. Sono
-- comportamento applicativo, non accesso alla riga.
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: A (proprietario) e B (collegato attivo), due libri, una Voce di
-- A per ciascuno, con sopra una recensione condivisa, un insight privato,
-- un insight spoiler vecchio di anni, e una Voce di B con un proprio
-- insight condiviso. Creati come postgres, prima di impersonare chiunque.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica-q-a@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica-q-b@example.com');

insert into public.utente (id, nome_utente) values
  ('00000000-0000-0000-0000-0000000000f1', 'verifica_q_a'),
  ('00000000-0000-0000-0000-0000000000f2', 'verifica_q_b');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('00000000-0000-0000-0000-0000000000f1', now()),
  ('00000000-0000-0000-0000-0000000000f2', now());

insert into public.collegamento (utente_a_id, utente_b_id, stato, richiesto_da_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
   'attiva', '00000000-0000-0000-0000-0000000000f1');

insert into public.autore (id, nome_canonico) values
  ('00000000-0000-0000-0000-0000000000e1', 'Italo Calvino');

insert into public.libro (id, titolo_canonico) values
  ('00000000-0000-0000-0000-0000000000b1', 'Le città invisibili'),
  ('00000000-0000-0000-0000-0000000000b2', 'Il barone rampante');

insert into public.libro_autore (libro_id, autore_id, ordine) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', 0);

insert into public.voce_di_libreria (id, utente_id, libro_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000b1');

insert into public.recensione (id, voce_id, utente_id, testo, visibilita) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000f1', 'Un libro che resta addosso.', 'condiviso');

insert into public.insight (id, voce_id, utente_id, testo, visibilita, spoiler, data) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000f1', 'Uno stile secco.', 'privato', false,
   (now() at time zone 'Europe/Rome')::date),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000f1', 'Cosimo non scende mai.', 'condiviso', true,
   (now() at time zone 'Europe/Rome')::date - 800),
  -- Di B, e CONDIVISO: e' proprio quello che non deve comparire nei
  -- Quaderni di A pur essendogli visibile dalla scheda del libro.
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000f2', 'Il testo di B, condiviso.', 'condiviso', false,
   (now() at time zone 'Europe/Rome')::date);

-- Vettori: scritti come postgres, esattamente come farebbe il worker sulla
-- connessione diretta. Due vicini fra loro (0.10 e 0.11) e uno lontano,
-- cosi' che la soglia di `vicini_a` abbia qualcosa da tagliare.
insert into public.indice_semantico (utente_id, tipo_contenuto, recensione_id, insight_id, embedding) values
  ('00000000-0000-0000-0000-0000000000f1', 'recensione',
   '00000000-0000-0000-0000-0000000000c1', null,
   array_fill(0.10::real, array[1536])::extensions.vector),
  ('00000000-0000-0000-0000-0000000000f1', 'insight',
   null, '00000000-0000-0000-0000-0000000000c2',
   array_fill(0.11::real, array[1536])::extensions.vector),
  ('00000000-0000-0000-0000-0000000000f2', 'insight',
   null, '00000000-0000-0000-0000-0000000000c4',
   array_fill(0.10::real, array[1536])::extensions.vector);

-- ---------------------------------------------------------------------------
-- Come A.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  n integer;
  t bigint;
  cid uuid;
begin
  -- 1. La vista `scritto` unisce insight e recensioni, e non porta nulla
  -- di altri: `security_invoker` tiene valutata la RLS delle due tabelle
  -- di base, e il filtro esplicito su auth.uid() nelle funzioni aggiunge
  -- la regola di prodotto.
  select count(*) into n from public.scritto where utente_id = auth.uid();
  if n <> 3 then
    raise exception 'FALLITO 01: A deve vedere 3 propri scritti, ne vede %', n;
  end if;
  raise notice 'OK 01: la vista `scritto` unisce i propri insight e le proprie recensioni';

  -- 2. Regola 24 + regola di prodotto: l'insight CONDIVISO di B è
  -- leggibile ad A dalla scheda del libro (la RLS lo consente), ma non
  -- deve MAI comparire nei Quaderni di A.
  select count(*) into n from public.insight
   where id = '00000000-0000-0000-0000-0000000000c4';
  if n <> 1 then
    raise exception 'FALLITO 02a: la RLS di insight non lascia più leggere il condiviso di un collegato';
  end if;
  select count(*) into n from public.elenco_scritti()
   where contenuto_id = '00000000-0000-0000-0000-0000000000c4';
  if n <> 0 then
    raise exception 'FALLITO 02b: elenco_scritti restituisce il contenuto condiviso di un collegato';
  end if;
  raise notice 'OK 02: il condiviso di un collegato resta leggibile sulla scheda e fuori dai propri Quaderni';

  -- 3. `totale` e `libri_distinti` contano la SELEZIONE, non la pagina.
  select totale into t from public.elenco_scritti(p_limite => 1) limit 1;
  if t <> 3 then
    raise exception 'FALLITO 03: totale deve valere 3 anche con p_limite = 1, vale %', t;
  end if;
  raise notice 'OK 03: il conteggio è quello della selezione, non quello della pagina';

  -- 4. I filtri: tipo, spoiler, anno, Voce.
  select count(*) into n from public.elenco_scritti(p_tipo => 'recensione');
  if n <> 1 then raise exception 'FALLITO 04a: filtro per tipo, attese 1, ottenute %', n; end if;
  select count(*) into n from public.elenco_scritti(p_solo_spoiler => true);
  if n <> 1 then raise exception 'FALLITO 04b: filtro spoiler, attese 1, ottenute %', n; end if;
  select count(*) into n from public.elenco_scritti(
    p_voce_ids => array['00000000-0000-0000-0000-0000000000a1']::uuid[]);
  if n <> 2 then raise exception 'FALLITO 04c: filtro per Voce, attese 2, ottenute %', n; end if;
  raise notice 'OK 04: i filtri di elenco_scritti restringono come devono';

  -- 4bis. La lente dei temi: restringere su un elenco di contenuti.
  -- Senza questo filtro un tema potrebbe restringere solo cio' che e'
  -- gia' in pagina, perdendo i propri riferimenti piu' vecchi della
  -- prima trentina.
  select count(*) into n from public.elenco_scritti(
    p_contenuto_ids => array['00000000-0000-0000-0000-0000000000c1',
                             '00000000-0000-0000-0000-0000000000c3']::uuid[]);
  if n <> 2 then
    raise exception 'FALLITO 04d: filtro per contenuti, attese 2, ottenute %', n;
  end if;
  -- E non lascia entrare il contenuto di un collegato nemmeno se lo si
  -- nomina esplicitamente: il filtro si somma a auth.uid(), non lo sostituisce.
  select count(*) into n from public.elenco_scritti(
    p_contenuto_ids => array['00000000-0000-0000-0000-0000000000c4']::uuid[]);
  if n <> 0 then
    raise exception 'FALLITO 04e: un id di un collegato passato a mano ha superato il filtro';
  end if;
  raise notice 'OK 04bis: la lente dei temi restringe per contenuto e resta dentro i propri';

  -- 5. Gli autori arrivano dall'identità stabile, non da una stringa.
  select count(*) into n from public.elenco_scritti()
   where 'Italo Calvino' = any(autori);
  if n <> 2 then
    raise exception 'FALLITO 05: gli autori del libro non arrivano sulle righe, attese 2, ottenute %', n;
  end if;
  raise notice 'OK 05: ogni riga porta il libro da cui viene, autori compresi';

  -- 6. I vicini: senza `p_con_vicini` non si legge un solo vettore.
  select vicini into n from public.elenco_scritti(p_con_vicini => false) limit 1;
  if n <> 0 then
    raise exception 'FALLITO 06a: con p_con_vicini falso il conteggio deve restare 0, vale %', n;
  end if;
  select vicini into n from public.elenco_scritti(p_con_vicini => true)
   where contenuto_id = '00000000-0000-0000-0000-0000000000c1';
  if n <> 1 then
    raise exception 'FALLITO 06b: la recensione ha un vicino indicizzato, ne conta %', n;
  end if;
  raise notice 'OK 06: il conteggio dei vicini si accende solo quando lo si chiede';

  -- 7. `vicini_a` non attraversa i vettori di un collegato: quello di B
  -- ha lo stesso embedding della recensione di A (distanza 0), quindi se
  -- il filtro su auth.uid() cadesse comparirebbe per primo.
  select count(*) into n from public.vicini_a('00000000-0000-0000-0000-0000000000c1');
  if n <> 1 then
    raise exception 'FALLITO 07a: vicini_a deve trovare il solo vicino proprio, ne trova %', n;
  end if;
  select count(*) into n from public.vicini_a('00000000-0000-0000-0000-0000000000c1')
   where contenuto_id = '00000000-0000-0000-0000-0000000000c4';
  if n <> 0 then
    raise exception 'FALLITO 07b: vicini_a ha restituito il contenuto di un collegato';
  end if;
  raise notice 'OK 07: vicini_a resta dentro i propri vettori';

  -- 8. `vicini_a` non restituisce mai se stesso.
  select count(*) into n from public.vicini_a('00000000-0000-0000-0000-0000000000c1')
   where contenuto_id = '00000000-0000-0000-0000-0000000000c1';
  if n <> 0 then
    raise exception 'FALLITO 08: vicini_a ha restituito lo scritto di partenza';
  end if;
  raise notice 'OK 08: vicini_a esclude lo scritto di partenza';

  -- 9. Il pensiero che torna: uno solo, vecchio, e fermo sul giorno.
  select count(*) into n from public.pensiero_che_torna();
  if n <> 1 then
    raise exception 'FALLITO 09a: pensiero_che_torna deve restituire una riga sola, ne dà %', n;
  end if;
  select contenuto_id into cid from public.pensiero_che_torna();
  if cid <> '00000000-0000-0000-0000-0000000000c3' then
    raise exception 'FALLITO 09b: con un solo scritto oltre i 60 giorni deve pescare quello, ha pescato %', cid;
  end if;
  if cid <> (select contenuto_id from public.pensiero_che_torna()) then
    raise exception 'FALLITO 09c: due chiamate nello stesso giorno hanno dato scritti diversi';
  end if;
  raise notice 'OK 09: il pensiero che torna è uno, vecchio, e non cambia entro la giornata';

  -- 10. Se nessuno scritto è abbastanza vecchio si pesca fra tutti: uno
  -- slot vuoto in cima alla pagina è peggio di un pensiero recente.
  select count(*) into n from public.pensiero_che_torna(p_giorni_minimi => 100000);
  if n <> 1 then
    raise exception 'FALLITO 10: senza scritti abbastanza vecchi il ripiego non ha pescato nulla';
  end if;
  raise notice 'OK 10: senza scritti abbastanza vecchi si pesca comunque fra tutti';

  -- 11. Le sfaccettature offrono solo valori che hanno righe.
  select count(*) into n from public.sfaccettature_scritti() where tipo = 'libro';
  if n <> 2 then
    raise exception 'FALLITO 11a: attesi 2 libri fra le sfaccettature, ottenuti %', n;
  end if;
  select count(*) into n from public.sfaccettature_scritti()
   where tipo = 'libro' and chiave = '00000000-0000-0000-0000-0000000000a3';
  if n <> 0 then
    raise exception 'FALLITO 11b: le sfaccettature offrono la Voce di un collegato';
  end if;
  raise notice 'OK 11: le sfaccettature restano dentro i propri scritti';
end $$;

-- ---------------------------------------------------------------------------
-- Come B: la simmetria. Ciò che vede A dai propri Quaderni non deve
-- entrare in quelli di B, nemmeno per la parte condivisa.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000f2', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  n integer;
begin
  select count(*) into n from public.elenco_scritti();
  if n <> 1 then
    raise exception 'FALLITO 12: B deve vedere il solo proprio scritto, ne vede %', n;
  end if;
  select count(*) into n from public.elenco_scritti()
   where contenuto_id = '00000000-0000-0000-0000-0000000000c1';
  if n <> 0 then
    raise exception 'FALLITO 12b: la recensione condivisa di A è entrata nei Quaderni di B';
  end if;
  raise notice 'OK 12: i Quaderni di B contengono i soli scritti di B';
end $$;

-- ---------------------------------------------------------------------------
-- Come anonimo: niente, come ovunque nell'app.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', null, true);
set local role anon;

-- Non "vede zero righe": non arriva alla RLS. Il grant di SELECT sulla
-- vista è per il solo ruolo `authenticated`, quindi un anonimo si ferma
-- un livello prima, sul privilegio. È la difesa più forte delle due, e
-- va asserita per quella che è.
do $$
declare
  n integer;
begin
  begin
    select count(*) into n from public.scritto;
    raise exception 'FALLITO 13: un anonimo è arrivato a leggere la vista scritto (% righe)', n;
  exception when insufficient_privilege then
    raise notice 'OK 13: la vista `scritto` non è nemmeno raggiungibile da un anonimo';
  end;
end $$;

reset role;
rollback;
