-- ============================================================================
-- La ricerca locale smette di essere una sola sottostringa
-- ============================================================================
-- `cerca_libri` confrontava l'INTERA stringa digitata con l'intero titolo,
-- con ogni variante e con ogni nome d'autore, un `like '%...%'` alla volta.
-- Due conseguenze, entrambe visibili a chi cerca:
--
-- 1. **Nessuna query mista titolo+autore funzionava.** "eco nome della
--    rosa" non corrisponde né al titolo ("Il nome della rosa") né
--    all'autore ("Umberto Eco"), perché nessuno dei due contiene l'intera
--    stringa: zero risultati locali. Google invece lo trova, quindi la
--    stessa ricerca dava zero schede già nel sistema e poi la stessa opera
--    fra i risultati esterni — cioè proponeva di aggiungere un libro che
--    c'era già. È il modo più diretto di produrre schede duplicate, e
--    passava per un difetto di ricerca invece che di catalogo.
-- 2. **Nessuna tolleranza ai refusi**, mentre `cerca_membri` (migrazione
--    20260824120000) usa già pg_trgm per i nomi utente. Un titolo è più
--    lungo e più facile da sbagliare di un nome utente, non meno.
--
-- La forma nuova è: si spezza ciò che è stato digitato in parole, e un
-- libro corrisponde quando le contiene TUTTE — non importa se una viene
-- dal titolo, una da una variante e una dal nome dell'autore. È quello che
-- fa qualunque ricerca di libri là fuori, ed è quello che un lettore si
-- aspetta scrivendo "eco rosa".
--
-- Perché serve una colonna e non basta cambiare la query: per confrontare
-- una parola con "tutto ciò che di questo libro è cercabile" bisogna avere
-- quel tutto in un posto solo. Ricomporlo a ogni ricerca significa, per
-- OGNI riga di `libro`, quattro sottoquery di aggregazione — cioè la
-- scansione sequenziale che il commento della vecchia funzione dichiarava
-- accettabile "alla scala prevista dal PRD (un gruppo chiuso, centinaia di
-- libri)". Quella scala non è più quella dichiarata: dal 24 agosto 2026
-- l'istanza non è più dimensionata su un gruppo chiuso (AGENTS.md, «Scala
-- attesa»), e il catalogo è la tabella che cresce con ogni opera distinta
-- che chiunque aggiunge. Con il testo materializzato e un indice GIN
-- trigram sopra, la ricerca smette di dipendere dal numero di libri.

-- ----------------------------------------------------------------------------
-- 1. La colonna e la funzione che la compone
-- ----------------------------------------------------------------------------

alter table public.libro add column if not exists testo_ricerca text;

comment on column public.libro.testo_ricerca is
  'Tutto ciò che di questo libro è cercabile — titolo canonico, varianti di titolo, nomi d''autore e loro varianti — normalizzato (minuscolo, senza accenti) e concatenato. Denormalizzazione deliberata e mantenuta dai trigger più sotto: è l''unico modo di far corrispondere una parola contro l''insieme di quei campi senza ricomporlo a ogni ricerca per ogni riga. Non va mai scritta a mano: `aggiorna_testo_ricerca_libro` è l''unica sorgente.';

create or replace function public.componi_testo_ricerca(p_libro_id uuid)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select extensions.unaccent(lower(
    coalesce(l.titolo_canonico, '') || ' ' ||
    coalesce((
      select string_agg(vt.titolo, ' ')
      from public.variante_titolo vt
      where vt.libro_id = l.id
    ), '') || ' ' ||
    coalesce((
      select string_agg(a.nome_canonico, ' ')
      from public.libro_autore la
      join public.autore a on a.id = la.autore_id
      where la.libro_id = l.id
    ), '') || ' ' ||
    coalesce((
      select string_agg(anv.nome_variante, ' ')
      from public.libro_autore la
      join public.autore_nome_variante anv on anv.autore_id = la.autore_id
      where la.libro_id = l.id
    ), '')
  ))
  from public.libro l
  where l.id = p_libro_id;
$$;

comment on function public.componi_testo_ricerca(uuid) is
  'Ricompone da zero il testo cercabile di un libro. `stable` e non `immutable` perché legge altre tabelle e perché `unaccent` dipende dal dizionario: per questo il valore vive in una colonna normale scritta da un trigger, mai in una colonna generata né in un''espressione d''indice, che esigerebbero entrambe l''immutabilità.';

create or replace function public.aggiorna_testo_ricerca_libro(p_libro_id uuid)
returns void
language sql
set search_path = public, extensions
as $$
  update public.libro
     set testo_ricerca = public.componi_testo_ricerca(p_libro_id)
   where id = p_libro_id;
$$;

-- Nessuno le chiama dal client: le invocano i trigger qui sotto, che
-- girano con i privilegi di chi scrive — e su queste cinque tabelle
-- `authenticated` ha solo SELECT, perché il catalogo lo scrive il back end
-- su connessione diretta (ADR 0016). Senza queste righe resterebbero
-- eseguibili da `anon` per il default di Postgres (`create function`
-- concede a PUBLIC), che è la superficie che la migrazione 20260826120000
-- ha chiuso una volta e che ogni funzione nuova deve richiudere per sé —
-- `supabase/tests/verifica_superficie_data_api.sql` lo verifica in CI.
revoke all on function public.componi_testo_ricerca(uuid) from public, anon, authenticated;
revoke all on function public.aggiorna_testo_ricerca_libro(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. I trigger che la tengono fresca
-- ----------------------------------------------------------------------------
-- Cinque tabelle e non una: il testo cercabile di un libro cambia quando
-- cambia il suo titolo, quando arriva una variante (Wikidata, dopo
-- l'aggiunta), quando si lega un autore, e anche quando cambia il NOME di
-- un autore già legato — che è esattamente ciò che fa la riconduzione
-- assistita degli autori quando fonde due forme dello stesso nome. Un
-- trigger dimenticato non rompe nulla in modo visibile: rende solo
-- irraggiungibile un libro per una parola che dovrebbe trovarlo, ed è il
-- tipo di guasto che nessuno segnala perché sembra "non ce l'ho".

create or replace function public.trg_testo_ricerca_da_libro()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- Solo sul titolo, e solo quando cambia davvero: senza questa guardia
  -- ogni update su `libro` (copertina, anno, lingua) ne innescherebbe un
  -- secondo, e l'update dentro il trigger rientrerebbe nel trigger.
  if tg_op = 'INSERT' or new.titolo_canonico is distinct from old.titolo_canonico then
    new.testo_ricerca := public.componi_testo_ricerca(new.id);
  end if;
  return new;
end;
$$;

-- `after` per l'INSERT e non `before`: `componi_testo_ricerca` legge
-- `public.libro` per id, e in un `before insert` la riga non c'è ancora.
create or replace function public.trg_testo_ricerca_dopo_libro()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  perform public.aggiorna_testo_ricerca_libro(new.id);
  return null;
end;
$$;

drop trigger if exists testo_ricerca_dopo_insert_libro on public.libro;
create trigger testo_ricerca_dopo_insert_libro
  after insert on public.libro
  for each row execute function public.trg_testo_ricerca_dopo_libro();

drop trigger if exists testo_ricerca_dopo_update_titolo on public.libro;
create trigger testo_ricerca_dopo_update_titolo
  after update of titolo_canonico on public.libro
  for each row
  when (new.titolo_canonico is distinct from old.titolo_canonico)
  execute function public.trg_testo_ricerca_dopo_libro();

-- Le tabelle figlie: il libro toccato è quello a cui la riga appartiene,
-- e su DELETE è `old` a portarlo.
create or replace function public.trg_testo_ricerca_da_figlia()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'DELETE' then
    perform public.aggiorna_testo_ricerca_libro(old.libro_id);
  else
    perform public.aggiorna_testo_ricerca_libro(new.libro_id);
    if tg_op = 'UPDATE' and old.libro_id is distinct from new.libro_id then
      perform public.aggiorna_testo_ricerca_libro(old.libro_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists testo_ricerca_da_variante on public.variante_titolo;
create trigger testo_ricerca_da_variante
  after insert or update or delete on public.variante_titolo
  for each row execute function public.trg_testo_ricerca_da_figlia();

drop trigger if exists testo_ricerca_da_libro_autore on public.libro_autore;
create trigger testo_ricerca_da_libro_autore
  after insert or update or delete on public.libro_autore
  for each row execute function public.trg_testo_ricerca_da_figlia();

-- L'autore non porta un libro_id: tocca tutti i libri che gli sono legati.
create or replace function public.trg_testo_ricerca_da_autore()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_autore_id uuid;
begin
  v_autore_id := case when tg_op = 'DELETE' then old.autore_id else new.autore_id end;
  update public.libro l
     set testo_ricerca = public.componi_testo_ricerca(l.id)
   where exists (
     select 1 from public.libro_autore la
      where la.libro_id = l.id and la.autore_id = v_autore_id
   );
  return null;
end;
$$;

create or replace function public.trg_testo_ricerca_da_nome_autore()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_autore_id uuid;
begin
  v_autore_id := case when tg_op = 'DELETE' then old.id else new.id end;
  update public.libro l
     set testo_ricerca = public.componi_testo_ricerca(l.id)
   where exists (
     select 1 from public.libro_autore la
      where la.libro_id = l.id and la.autore_id = v_autore_id
   );
  return null;
end;
$$;

drop trigger if exists testo_ricerca_da_nome_autore on public.autore;
create trigger testo_ricerca_da_nome_autore
  after update of nome_canonico on public.autore
  for each row
  when (new.nome_canonico is distinct from old.nome_canonico)
  execute function public.trg_testo_ricerca_da_nome_autore();

drop trigger if exists testo_ricerca_da_variante_autore on public.autore_nome_variante;
create trigger testo_ricerca_da_variante_autore
  after insert or update or delete on public.autore_nome_variante
  for each row execute function public.trg_testo_ricerca_da_autore();

-- ----------------------------------------------------------------------------
-- 3. Riempimento iniziale e indice
-- ----------------------------------------------------------------------------

update public.libro set testo_ricerca = public.componi_testo_ricerca(id);

-- GIN trigram: è l'indice che toglie la scansione sequenziale su cui
-- poggiava la vecchia funzione. Verificato con EXPLAIN su 20.000 libri
-- sintetici — `Bitmap Index Scan on idx_libro_testo_ricerca_trgm`, 0,5 ms
-- per parola contro i 3 ms della scansione — e verificato anche che il
-- pianificatore lo scarta da sé, correttamente, per una parola che
-- corrisponde a quasi tutte le righe.
create index if not exists idx_libro_testo_ricerca_trgm
  on public.libro using gin (testo_ricerca extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 4. cerca_libri, per parole
-- ----------------------------------------------------------------------------
-- Stesso elenco di colonne di ritorno della versione precedente
-- (20260821180000): il back end e il frontend non cambiano di una riga.
-- Cambia solo COSA corrisponde e in che ordine.

drop function if exists public.cerca_libri(text, text, integer);

create function public.cerca_libri(
  p_termine text,
  p_lingua text default 'it',
  p_limite integer default 20,
  p_soglia real default 0.5
)
returns table (
  libro_id uuid,
  titolo text,
  titolo_canonico text,
  anno_prima_pubblicazione integer,
  lingua_originale text,
  autori text[],
  copertina_miniatura_path text,
  copertina_colore_dominante text,
  copertina_colore_dominante_scuro text,
  copertina_stato text,
  pagine_mediane_catalogo integer,
  voce_id uuid,
  voce_stato text,
  voce_voto numeric,
  voce_pagina_corrente integer,
  voce_anno_ultima_lettura integer,
  rango smallint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with termine as (
    select extensions.unaccent(lower(trim(coalesce(p_termine, '')))) as t
  ),
  parola as (
    select w
    from termine, unnest(string_to_array(termine.t, ' ')) as w
    where w <> ''
  ),
  -- Un libro per ogni parola che contiene; poi si tengono solo i libri che
  -- le contengono TUTTE. Scritto come join laterale e non come un unico
  -- `like all (...)` perché così ogni parola è un predicato `like
  -- '%w%'` a sé, che è la forma che l'indice GIN trigram sa servire.
  per_parola as (
    select l.id as libro_id, p.w
    from parola p
    join public.libro l on l.testo_ricerca like '%' || p.w || '%'
  ),
  tutte_le_parole as (
    select libro_id
    from per_parola
    group by libro_id
    having count(distinct w) = (select count(*) from parola)
  ),
  -- Tolleranza ai refusi. `word_similarity` e non `similarity`: la seconda
  -- confronta due stringhe INTERE, e su un testo lungo come questo il
  -- punteggio di una parola giusta sarebbe comunque bassissimo — la
  -- soglia non si potrebbe tarare. La prima chiede invece «quanto
  -- assomiglia ciò che è stato digitato al pezzo più simile del testo»,
  -- che è la domanda vera.
  --
  -- Questo ramo NON usa l'indice, ed è deliberato. La forma indicizzabile
  -- è l'operatore `<%`, che però legge la soglia dalla GUC di sessione
  -- (`pg_trgm.word_similarity_threshold`) invece di prenderla come
  -- argomento: per usarla bisognerebbe riscrivere la funzione in plpgsql e
  -- fare `set_config(..., local)`. Misurato su 20.000 libri sintetici: il
  -- ramo per parole (indicizzato) risponde in 8 ms, questo in 84 ms — e
  -- gira SOLO quando nessun libro contiene tutte le parole digitate, cioè
  -- quando la risposta sta comunque per essere "quasi nulla". Se il
  -- catalogo cresce di un ordine di grandezza è qui che si torna, e la
  -- via è già scritta sopra.
  somiglianti as (
    select l.id as libro_id
    from public.libro l, termine
    where termine.t <> ''
      and not exists (select 1 from tutte_le_parole)
      and extensions.word_similarity(termine.t, l.testo_ricerca) >= p_soglia
  ),
  candidati as (
    select libro_id from tutte_le_parole
    union
    select libro_id from somiglianti
  )
  select
    l.id,
    coalesce(vt.titolo, l.titolo_canonico) as titolo,
    l.titolo_canonico,
    l.anno_prima_pubblicazione,
    l.lingua_originale,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ) as autori,
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    l.copertina_colore_dominante_scuro,
    l.copertina_stato,
    l.pagine_mediane_catalogo,
    v.id as voce_id,
    v.stato as voce_stato,
    v.voto as voce_voto,
    (select max(av.pagina)
       from public.lettura le
       join public.avanzamento av on av.lettura_id = le.id
      where le.voce_id = v.id and le.data_fine is null) as voce_pagina_corrente,
    (select max(extract(year from le.data_fine))::integer
       from public.lettura le
      where le.voce_id = v.id and le.data_fine is not null) as voce_anno_ultima_lettura,
    -- Gli stessi quattro ranghi di prima, più un quinto per chi è arrivato
    -- solo per somiglianza: un refuso perdonato non deve mai scavalcare una
    -- corrispondenza esatta.
    (case
       when extensions.unaccent(lower(l.titolo_canonico))
            like (select t || '%' from termine) then 0
       when extensions.unaccent(lower(l.titolo_canonico))
            like (select '%' || t || '%' from termine) then 1
       when exists (
         select 1 from public.variante_titolo vv
          where vv.libro_id = l.id
            and extensions.unaccent(lower(vv.titolo))
                like (select '%' || t || '%' from termine)
       ) then 2
       when exists (select 1 from tutte_le_parole tp where tp.libro_id = l.id) then 3
       else 4
     end)::smallint as rango
  from candidati c
  join public.libro l on l.id = c.libro_id
  left join public.variante_titolo vt on vt.libro_id = l.id and vt.lingua = p_lingua
  left join public.voce_di_libreria v on v.libro_id = l.id and v.utente_id = auth.uid()
  order by rango, l.titolo_canonico
  limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.cerca_libri(text, text, integer, real) is
  'Ricerca sulle schede già nel sistema. Spezza ciò che è stato digitato in parole e restituisce i libri che le contengono TUTTE, non importa se una viene dal titolo canonico, una da una variante di titolo e una dal nome dell''autore: è ciò che permette a "eco nome della rosa" di trovare il libro, cosa che la versione a sottostringa unica (20260821180000) non faceva — e ogni ricerca mista che falliva localmente riproponeva la stessa opera fra i risultati esterni, cioè invitava a duplicare una scheda che c''era già. Quando nessun libro contiene tutte le parole si ripiega sulla somiglianza trigram (`word_similarity`, soglia p_soglia), per perdonare un refuso senza mai anteporlo a una corrispondenza vera: quei risultati portano rango 4, l''ultimo. `security invoker`: la RLS di voce_di_libreria resta valutata, quindi il join sulla propria Voce è sicuro per costruzione.';

revoke all on function public.cerca_libri(text, text, integer, real) from public, anon;
grant execute on function public.cerca_libri(text, text, integer, real) to authenticated;
