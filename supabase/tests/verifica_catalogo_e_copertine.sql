-- Verifica manuale dello schema del catalogo esterno, delle copertine e
-- della coda dei lavori (migrazione 20260821120000_catalogo_esterno_e_
-- copertine.sql, docs/adr/0016).
--
-- NON fa parte di supabase/migrations/: non viene mai applicato in
-- automatico. Eseguire a mano dopo ogni modifica a quella migrazione,
-- prima di aprire una PR (AGENTS.md):
--
--   supabase db reset --local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verifica_catalogo_e_copertine.sql
--
-- Esiste perché quasi nulla di ciò che verifica è raggiungibile da
-- pytest: i privilegi SQL e le regole di riga si valutano nel database,
-- e un test Python che passa dal client Supabase con la chiave di
-- servizio le aggirerebbe tutte per definizione. Il resto sono vincoli
-- tra righe (indici unici parziali, CHECK) che l'applicazione non deve
-- mai vedere fallire, e proprio per questo non li esercita.
--
-- Tutto lo script vive in un'unica transazione con ROLLBACK finale:
-- nessuna riga di fixture sopravvive, che lo script passi o fallisca.

begin;

-- ---------------------------------------------------------------------------
-- Fixture: un utente di test e due libri. Creati come postgres
-- (privilegi pieni), prima di impersonare l'utente qui sotto.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'verifica-cat@example.com');

insert into public.utente (id, nome_utente) values
  ('00000000-0000-0000-0000-0000000000c1', 'verifica_cat');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('00000000-0000-0000-0000-0000000000c1', now());

insert into public.libro (id, titolo_canonico, copertina_stato) values
  ('00000000-0000-0000-0000-0000000000e1', 'Opera di prova', 'assente'),
  ('00000000-0000-0000-0000-0000000000e2', 'Opera di prova duplicata', 'assente');

-- ---------------------------------------------------------------------------
-- Parte 1 — vincoli di integrità, come postgres (privilegi pieni).
-- Verificano che lo schema rifiuti da solo ciò che il codice non deve
-- mai scrivere: sono le garanzie su cui l'applicazione si appoggia
-- senza ricontrollarle.
-- ---------------------------------------------------------------------------

do $$
declare
  v_stato text;
  v_n integer;
begin
  -- 1. La chiave primaria (fonte, identificativo) impedisce che lo stesso
  --    ISBN punti a due schede diverse. È IL vincolo su cui si regge tutta
  --    la deduplicazione: se cede, due Utenti che aggiungono la stessa
  --    opera ricadono su schede diverse e le metriche divergono.
  insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo)
    values ('00000000-0000-0000-0000-0000000000e1', 'isbn13', '9780000000001');
  begin
    insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo)
      values ('00000000-0000-0000-0000-0000000000e2', 'isbn13', '9780000000001');
    raise exception 'FALLITO: lo stesso ISBN non deve poter puntare a due schede';
  exception when unique_violation then
    null;
  end;
  raise notice 'OK 01: (fonte, identificativo) è unico — un identificativo esterno appartiene a una scheda sola';

  -- 2. Più riferimenti della stessa fonte per lo stesso libro sono
  --    LEGITTIMI: è la cardinalità 1:N che rende la fusione un UPDATE.
  --    Se questo insert fallisse, la tabella non starebbe risolvendo il
  --    problema per cui è nata.
  insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo)
    values ('00000000-0000-0000-0000-0000000000e1', 'isbn13', '9780000000002');
  select count(*) into v_n
    from public.libro_riferimento_esterno
   where libro_id = '00000000-0000-0000-0000-0000000000e1' and fonte = 'isbn13';
  if v_n <> 2 then
    raise exception 'FALLITO: un libro deve poter avere più identificativi della stessa fonte (trovati %)', v_n;
  end if;
  raise notice 'OK 02: un libro porta più identificativi della stessa fonte (cardinalità 1:N)';

  -- 3. ...ma al più uno "principale" per (libro, fonte).
  update public.libro_riferimento_esterno set principale = true
   where libro_id = '00000000-0000-0000-0000-0000000000e1' and identificativo = '9780000000001';
  begin
    update public.libro_riferimento_esterno set principale = true
     where libro_id = '00000000-0000-0000-0000-0000000000e1' and identificativo = '9780000000002';
    raise exception 'FALLITO: non devono esistere due riferimenti principali per la stessa coppia (libro, fonte)';
  exception when unique_violation then
    null;
  end;
  raise notice 'OK 03: al più un riferimento principale per (libro, fonte)';

  -- 4. La fusione di due schede duplicate è un UPDATE e non tocca nulla
  --    d'altro. È la proprietà che giustifica l'intera tabella, quindi
  --    va esercitata, non solo dichiarata nei commenti.
  insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo)
    values ('00000000-0000-0000-0000-0000000000e2', 'open_library', 'OL999999W');
  update public.libro_riferimento_esterno
     set libro_id = '00000000-0000-0000-0000-0000000000e1'
   where libro_id = '00000000-0000-0000-0000-0000000000e2';
  delete from public.libro where id = '00000000-0000-0000-0000-0000000000e2';
  select count(*) into v_n
    from public.libro_riferimento_esterno
   where libro_id = '00000000-0000-0000-0000-0000000000e1';
  if v_n <> 3 then
    raise exception 'FALLITO: dopo la fusione la scheda sopravvissuta deve portare tutti i riferimenti (trovati %)', v_n;
  end if;
  raise notice 'OK 04: fondere due schede duplicate è un UPDATE dei riferimenti, senza toccare le Voci';

  -- 5. copertina_stato e presenza dell'immagine non possono divergere:
  --    il frontend leggerebbe una riga contraddittoria.
  begin
    update public.libro set copertina_stato = 'presente'
     where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLITO: copertina_stato = presente senza percorso immagine deve essere rifiutato';
  exception when check_violation then
    null;
  end;
  begin
    update public.libro set copertina_miniatura_path = 'copertine/x/miniatura.webp'
     where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLITO: un percorso immagine con stato diverso da presente deve essere rifiutato';
  exception when check_violation then
    null;
  end;
  update public.libro
     set copertina_stato = 'presente',
         copertina_miniatura_path = 'copertine/e1/miniatura.webp',
         copertina_grande_path = 'copertine/e1/grande.webp',
         copertina_colore_dominante = '#3a2f28',
         -- Aggiunto il 22 agosto 2026 (issue #6): la migrazione
         -- 20260821180000 ha introdotto
         -- chk_libro_copertina_colore_scuro_coerente, che lega i due
         -- colori (o entrambi nulli o entrambi valorizzati), e questo
         -- script non era stato aggiornato — falliva su main da allora.
         copertina_colore_dominante_scuro = '#221c18'
   where id = '00000000-0000-0000-0000-0000000000e1';
  select copertina_stato into v_stato from public.libro where id = '00000000-0000-0000-0000-0000000000e1';
  if v_stato <> 'presente' then
    raise exception 'FALLITO: la coppia coerente (presente + percorso) deve essere ammessa';
  end if;
  raise notice 'OK 05: copertina_stato e percorso immagine restano coerenti per costruzione';

  -- 6. Il colore dominante è un colore, non una stringa qualsiasi: il
  --    frontend lo mette in una variabile CSS senza validarlo.
  begin
    update public.libro set copertina_colore_dominante = 'marrone'
     where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLITO: copertina_colore_dominante deve accettare solo #rrggbb minuscolo';
  exception when check_violation then
    null;
  end;
  raise notice 'OK 06: copertina_colore_dominante accetta solo #rrggbb';

  -- 7. Arbitraggio delle varianti di titolo: una fonte peggiore non
  --    sovrascrive una migliore, una migliore sì. È la regola che
  --    impedisce a un titolo grezzo di catalogo di restare per sempre.
  insert into public.variante_titolo (libro_id, lingua, titolo, fonte)
    values ('00000000-0000-0000-0000-0000000000e1', 'it', 'Opera di prova', 'wikidata');

  insert into public.variante_titolo (libro_id, lingua, titolo, fonte)
    values ('00000000-0000-0000-0000-0000000000e1', 'it', 'Opera Di Prova (Italian Edition)', 'google_books')
    on conflict (libro_id, lingua) do update
      set titolo = excluded.titolo, fonte = excluded.fonte
      where public.rango_fonte_variante(excluded.fonte)
          < public.rango_fonte_variante(variante_titolo.fonte);

  select titolo into v_stato from public.variante_titolo
   where libro_id = '00000000-0000-0000-0000-0000000000e1' and lingua = 'it';
  if v_stato <> 'Opera di prova' then
    raise exception 'FALLITO: google_books non deve sovrascrivere wikidata (trovato %)', v_stato;
  end if;

  insert into public.variante_titolo (libro_id, lingua, titolo, fonte)
    values ('00000000-0000-0000-0000-0000000000e1', 'it', 'Titolo corretto a mano', 'manuale')
    on conflict (libro_id, lingua) do update
      set titolo = excluded.titolo, fonte = excluded.fonte
      where public.rango_fonte_variante(excluded.fonte)
          < public.rango_fonte_variante(variante_titolo.fonte);

  select titolo into v_stato from public.variante_titolo
   where libro_id = '00000000-0000-0000-0000-0000000000e1' and lingua = 'it';
  if v_stato <> 'Titolo corretto a mano' then
    raise exception 'FALLITO: manuale deve sovrascrivere wikidata (trovato %)', v_stato;
  end if;
  raise notice 'OK 07: l''arbitraggio delle varianti di titolo premia la fonte migliore, non la prima arrivata';

  -- 8. Un solo lavoro pendente per (tipo, chiave): due Utenti che
  --    aggiungono la stessa opera non accodano due recuperi.
  insert into public.lavoro (tipo, chiave, payload)
    values ('copertina', '00000000-0000-0000-0000-0000000000e1', '{}'::jsonb);
  insert into public.lavoro (tipo, chiave, payload)
    values ('copertina', '00000000-0000-0000-0000-0000000000e1', '{}'::jsonb)
    on conflict do nothing;
  select count(*) into v_n from public.lavoro
   where tipo = 'copertina' and chiave = '00000000-0000-0000-0000-0000000000e1';
  if v_n <> 1 then
    raise exception 'FALLITO: non devono esistere due lavori pendenti per la stessa coppia (tipo, chiave) — trovati %', v_n;
  end if;

  -- ...ma una volta concluso, lo stesso lavoro si può riaccodare (una
  -- copertina si può voler recuperare di nuovo, fuori banda).
  update public.lavoro set stato = 'riuscito'
   where tipo = 'copertina' and chiave = '00000000-0000-0000-0000-0000000000e1';
  insert into public.lavoro (tipo, chiave, payload)
    values ('copertina', '00000000-0000-0000-0000-0000000000e1', '{}'::jsonb);
  raise notice 'OK 08: un solo lavoro PENDENTE per (tipo, chiave), ma riaccodabile una volta concluso';
end $$;

-- ---------------------------------------------------------------------------
-- Parte 2 — privilegi e regole di riga, come utente autenticato.
--
-- Impersona un utente reale: auth.uid() legge da request.jwt.claims,
-- esattamente come farebbe PostgREST per una richiesta autenticata — da
-- qui in poi si passa dalle stesse regole del backend, non dai privilegi
-- di postgres.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000c1', 'role', 'authenticated')::text,
  true);
set local role authenticated;

do $$
declare
  v_n integer;
begin
  -- 9. Le tabelle di catalogo si leggono...
  select count(*) into v_n from public.libro_riferimento_esterno;
  if v_n = 0 then
    raise exception 'FALLITO: un utente autenticato deve poter leggere i riferimenti esterni';
  end if;
  select count(*) into v_n from public.libro_descrizione;
  raise notice 'OK 09: le tabelle di catalogo sono leggibili da un utente autenticato';

  -- 10. ...ma non si scrivono, e il rifiuto arriva dal PRIVILEGIO SQL
  --     (42501), prima ancora della RLS. Sono due difese distinte e qui
  --     si verifica la più esterna: senza il GRANT, non esiste policy da
  --     aggirare.
  begin
    insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo)
      values ('00000000-0000-0000-0000-0000000000e1', 'wikidata', 'Q1');
    raise exception 'FALLITO: un utente autenticato non deve poter scrivere sul catalogo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.libro_riferimento_esterno set principale = false;
    raise exception 'FALLITO: un utente autenticato non deve poter modificare il catalogo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.libro_riferimento_esterno;
    raise exception 'FALLITO: un utente autenticato non deve poter cancellare dal catalogo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.libro_descrizione (libro_id, lingua, testo, fonte)
      values ('00000000-0000-0000-0000-0000000000e1', 'it', 'x', 'wikipedia');
    raise exception 'FALLITO: un utente autenticato non deve poter scrivere una descrizione';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'OK 10: il catalogo è in sola lettura per authenticated, rifiutato dal privilegio SQL (42501)';

  -- 11. La coda dei lavori è chiusa anche in LETTURA. Lo stato che il
  --     prodotto mostra è libro.copertina_stato, non questa tabella.
  begin
    select count(*) into v_n from public.lavoro;
    raise exception 'FALLITO: un utente autenticato non deve poter nemmeno leggere la coda dei lavori';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'OK 11: la coda dei lavori è invisibile a un utente autenticato, lettura compresa';

  -- 12. cerca_libri gira con l'identità del chiamante e non porta mai la
  --     Voce di un altro Utente. Qui l'utente di test non ha Voci: se ne
  --     comparisse una, il join starebbe leggendo la libreria altrui.
  select count(*) into v_n
    from public.cerca_libri('opera di prova')
   where voce_id is not null;
  if v_n <> 0 then
    raise exception 'FALLITO: cerca_libri non deve restituire la Voce di un altro Utente (trovate %)', v_n;
  end if;

  select count(*) into v_n from public.cerca_libri('citta invisibili');
  if v_n <> 1 then
    raise exception 'FALLITO: cerca_libri deve ignorare gli accenti (trovati % risultati)', v_n;
  end if;

  select count(*) into v_n from public.cerca_libri('calvino');
  if v_n < 2 then
    raise exception 'FALLITO: cerca_libri deve trovare per nome d''autore (trovati %)', v_n;
  end if;
  raise notice 'OK 12: cerca_libri ignora gli accenti, trova per autore e non espone Voci altrui';

  -- 12b. La ricerca per PAROLE (migrazione 20260827100000). Il caso che
  --      la versione a sottostringa unica sbagliava: nessun titolo
  --      contiene "calvino" e nessun autore contiene "invisibili", ma il
  --      libro contiene entrambe le parole — ed è ciò che un lettore
  --      scrive. Prima dava zero risultati locali e riproponeva la stessa
  --      opera fra i risultati esterni, cioè invitava ad aggiungere una
  --      scheda che c'era già.
  select count(*) into v_n from public.cerca_libri('calvino invisibili');
  if v_n <> 1 then
    raise exception
      'FALLITO: cerca_libri deve trovare per parole sparse fra titolo e autore (trovati %)', v_n;
  end if;

  select count(*) into v_n from public.cerca_libri('invisibili calvino');
  if v_n <> 1 then
    raise exception 'FALLITO: l''ordine delle parole non deve contare (trovati %)', v_n;
  end if;

  --      Le parole si sommano, non si alternano: una parola che nessun
  --      libro ha deve azzerare il risultato, altrimenti la ricerca
  --      allargherebbe invece di restringere a ogni parola digitata.
  select count(*) into v_n from public.cerca_libri('calvino sottomarino');
  if v_n <> 0 then
    raise exception
      'FALLITO: tutte le parole devono corrispondere, non una qualsiasi (trovati %)', v_n;
  end if;

  -- 12c. Il refuso si perdona, ma non scavalca mai una corrispondenza
  --      vera: chi arriva solo per somiglianza porta il rango più alto.
  select count(*) into v_n from public.cerca_libri('invisibli');
  if v_n < 1 then
    raise exception 'FALLITO: cerca_libri deve perdonare un refuso (trovati %)', v_n;
  end if;

  select coalesce(max(rango), -1) into v_n from public.cerca_libri('invisibli');
  if v_n <> 4 then
    raise exception
      'FALLITO: un risultato trovato solo per somiglianza deve portare rango 4 (trovato %)', v_n;
  end if;

  raise notice 'OK 12b: cerca_libri corrisponde per parole e perdona i refusi';

  -- 13. Le pagine della Voce nascono precompilate alla mediana di
  --     catalogo (PRD comportamento #3), senza che chi inserisce debba
  --     saperlo: è la regola che prima non esisteva in nessuna via
  --     d'ingresso.
  insert into public.voce_di_libreria (utente_id, libro_id)
    select '00000000-0000-0000-0000-0000000000c1', id
      from public.libro where titolo_canonico = 'Il nome della rosa'
    returning pagine_adottate into v_n;
  if v_n is distinct from 533 then
    raise exception 'FALLITO: pagine_adottate doveva nascere a 533 (mediana di catalogo), trovato %', v_n;
  end if;

  -- ...ma non forza: un valore indicato esplicitamente resta.
  insert into public.voce_di_libreria (utente_id, libro_id, pagine_adottate)
    select '00000000-0000-0000-0000-0000000000c1', id, 999
      from public.libro where titolo_canonico = 'Le città invisibili'
    returning pagine_adottate into v_n;
  if v_n <> 999 then
    raise exception 'FALLITO: il trigger non deve sovrascrivere un valore indicato (trovato %)', v_n;
  end if;

  -- ...e su una scheda senza mediana resta nullo, non zero.
  insert into public.voce_di_libreria (utente_id, libro_id)
    select '00000000-0000-0000-0000-0000000000c1', id
      from public.libro where titolo_canonico = 'Il barone rampante'
    returning pagine_adottate into v_n;
  if v_n is not null then
    raise exception 'FALLITO: senza mediana di catalogo pagine_adottate resta nullo (trovato %)', v_n;
  end if;
  raise notice 'OK 13: le pagine della Voce nascono precompilate alla mediana, senza forzare';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Parte 2b — il testo cercabile resta fresco (migrazione 20260827100000).
--
-- Fuori dalla parte "come utente autenticato" perché serve SCRIVERE una
-- variante di titolo, e il catalogo per `authenticated` è in sola lettura
-- (verifica 10, poco sopra): a scriverlo è il back end su connessione
-- diretta (ADR 0016), che è il ruolo con cui gira questa sezione.
-- ---------------------------------------------------------------------------

do $$
declare
  v_n integer;
begin
  -- 13b. Il testo cercabile è denormalizzato: senza i trigger che lo
  --      tengono fresco, una variante di titolo arrivata DOPO l'aggiunta
  --      (Wikidata, in secondo piano) non renderebbe il libro trovabile
  --      con quel titolo — e il guasto è invisibile, perché somiglia a
  --      "non ce l'ho".
  --
  --      Si misura sul RANGO e non sulla presenza: "invisible cities"
  --      assomiglia già abbastanza a "le citta invisibili italo calvino"
  --      perché il ripiego per somiglianza lo peschi da sé (0,55 misurato,
  --      sopra la soglia di 0,5). È esattamente la trappola che rende
  --      inutile un test scritto sul conteggio: passerebbe anche con i
  --      trigger spenti. Con la variante scritta la corrispondenza diventa
  --      letterale, e il rango scende da 4 a 2.
  select coalesce(max(rango), -1) into v_n from public.cerca_libri('invisible cities');
  if v_n <> 4 then
    raise exception
      'FALLITO: presupposto non valido, atteso rango 4 (solo somiglianza), trovato %', v_n;
  end if;

  insert into public.variante_titolo (libro_id, lingua, titolo, fonte)
  select id, 'en', 'Invisible Cities', 'wikidata'
    from public.libro where titolo_canonico = 'Le città invisibili';

  select coalesce(max(rango), -1) into v_n from public.cerca_libri('invisible cities');
  if v_n <> 2 then
    raise exception
      'FALLITO: la variante appena scritta deve dare una corrispondenza letterale '
      '(atteso rango 2, trovato %) — se resta 4, il trigger sul testo cercabile non ha girato',
      v_n;
  end if;
  raise notice 'OK 13b: una variante di titolo scritta dopo l''aggiunta diventa subito cercabile';
end $$;

-- ---------------------------------------------------------------------------
-- Parte 3 — lo spazio file delle copertine.
-- ---------------------------------------------------------------------------

do $$
declare
  v_pubblico boolean;
  v_n integer;
begin
  -- 13. Il bucket esiste ed è privato (PRD regola 6: nessun file
  --     accessibile senza autenticazione).
  select public into v_pubblico from storage.buckets where id = 'copertine';
  if v_pubblico is null then
    raise exception 'FALLITO: il bucket copertine non esiste';
  end if;
  if v_pubblico then
    raise exception 'FALLITO: il bucket copertine deve essere privato (PRD regola 6)';
  end if;

  -- 14. E non ha policy su storage.objects. Una policy "for select to
  --     authenticated" aggiunta per sicurezza renderebbe ogni copertina
  --     leggibile a chiunque abbia un token e un percorso indovinabile:
  --     è il modo esatto in cui la regola 6 si romperebbe senza che
  --     nessun test applicativo se ne accorga.
  select count(*) into v_n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects';
  if v_n <> 0 then
    raise exception 'FALLITO: nessuna policy deve esistere su storage.objects (trovate %)', v_n;
  end if;
  raise notice 'OK 14: il bucket copertine è privato e nessuna policy lo apre a authenticated';
end $$;

rollback;
