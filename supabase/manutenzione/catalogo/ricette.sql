-- Manutenzione del catalogo: le query ricorrenti, pronte da incollare in
-- SQL editor una alla volta. Il perché di ognuna sta in docs/manutenzione.md,
-- sezione «Manutenzione del catalogo»; i numeri qui corrispondono a quelli.
--
-- Convenzioni:
--   - le query di LETTURA non hanno marcatura;
--   - le query che SCRIVONO sono marcate «SCRIVE» e vanno lette prima;
--   - i segnaposto da sostituire sono fra <angolari>;
--   - ogni scrittura che corregge un valore controlla anche il valore
--     attuale (`and colonna = <vecchio>`): se nel frattempo è cambiato, non
--     tocca nulla invece di sovrascrivere.


-- ============================================================================
-- 1. SALUTE GENERALE — tutti i valori dovrebbero essere 0
-- ============================================================================
select
  (select count(*) from public.libro where copertina_stato = 'in_attesa'
     and not exists (select 1 from public.lavoro w where w.tipo = 'copertina'
                     and w.chiave = libro.id::text and w.stato in ('in_attesa', 'in_corso')))
                                                          as copertine_in_attesa_senza_lavoro,
  (select count(*) from public.libro l where not exists
     (select 1 from public.libro_riferimento_esterno r where r.libro_id = l.id))
                                                          as schede_senza_riferimenti,
  (select count(*) from public.libro l where not exists
     (select 1 from public.libro_autore la where la.libro_id = l.id))
                                                          as schede_senza_autori,
  (select count(*) from public.autore a where not exists
     (select 1 from public.libro_autore la where la.autore_id = a.id))
                                                          as autori_senza_libri,
  (select count(*) from (select fonte, identificativo from public.libro_riferimento_esterno
     where fonte in ('open_library', 'wikidata') and principale
     group by 1, 2 having count(distinct libro_id) > 1) x) as opere_su_piu_schede,
  (select count(*) from public.libro
     where anno_prima_pubblicazione > extract(year from now() at time zone 'Europe/Rome'))
                                                          as anni_futuri,
  (select count(*) from public.voce_di_libreria v join public.libro l on l.id = v.libro_id
     where l.copertina_stato <> 'presente')               as voci_senza_copertina,
  (select count(*) from public.voce_di_libreria where pagine_adottate is null)
                                                          as voci_senza_pagine,
  (select count(*) from public.proposta_fusione_libro where stato = 'in_attesa')
                                                          as proposte_fusione_aperte;


-- ============================================================================
-- 2. CODA DEI LAVORI
-- ============================================================================

-- 2a. Cosa c'è in coda, e cosa è fallito nell'ultimo giorno.
select tipo, stato, count(*), min(esegui_dopo) as prossimo,
       string_agg(distinct left(errore, 80), ' | ') as errori
from public.lavoro
where stato in ('in_attesa', 'in_corso')
   or (stato = 'fallito' and aggiornato_at > now() - interval '1 day')
group by 1, 2 order by 1, 2;

-- 2b. SCRIVE. Rimettere in coda i falliti di un tipo, a passo distanziato
--     (una fonte che ha risposto 429 o 503 a raffica va richiamata piano).
with s as (
  select id, row_number() over (order by id) as n
  from public.lavoro where tipo = '<tipo>' and stato = 'fallito'
)
update public.lavoro w
   set stato = 'in_attesa', tentativi = 0, errore = null,
       esegui_dopo = now() + (s.n - 1) * interval '<secondi> seconds'
  from s where w.id = s.id;


-- ============================================================================
-- 3. COPERTINE
-- ============================================================================

-- 3a. Le schede in una libreria che non hanno copertina, con ciò che la
--     catena ha a disposizione per cercarla.
select l.id,
       coalesce((select vt.titolo from public.variante_titolo vt
                 where vt.libro_id = l.id and vt.lingua = 'it'), l.titolo_canonico) as titolo,
       l.copertina_stato,
       (select string_agg(fonte || ':' || identificativo, ' ')
          from public.libro_riferimento_esterno r where r.libro_id = l.id) as riferimenti
from public.libro l
where l.copertina_stato <> 'presente'
  and exists (select 1 from public.voce_di_libreria v where v.libro_id = l.id);

-- 3b. SCRIVE. Riaccodare il recupero per tutte le schede senza copertina,
--     passando TUTTI gli identificativi: il lavoro prova Google, poi ogni
--     ISBN, poi la copertina dell'opera su Open Library. Prima le schede
--     che stanno in una libreria.
with b as (
  select l.id,
    row_number() over (order by exists (select 1 from public.voce_di_libreria v
                                        where v.libro_id = l.id) desc, l.id) as n,
    (select identificativo from public.libro_riferimento_esterno r
      where r.libro_id = l.id and r.fonte = 'google_books' and r.principale limit 1) as g,
    (select identificativo from public.libro_riferimento_esterno r
      where r.libro_id = l.id and r.fonte = 'isbn13' and r.principale limit 1) as i,
    coalesce((select jsonb_agg(identificativo) from public.libro_riferimento_esterno r
      where r.libro_id = l.id and r.fonte = 'isbn13' and not r.principale), '[]') as ia,
    coalesce((select jsonb_agg(identificativo order by principale desc) from public.libro_riferimento_esterno r
      where r.libro_id = l.id and r.fonte = 'open_library'), '[]') as ol
  from public.libro l
  where l.copertina_stato in ('assente', 'fallita')
)
insert into public.lavoro (tipo, chiave, payload, esegui_dopo)
select 'copertina', id::text,
       jsonb_build_object('libro_id', id, 'google_volume_id', g, 'isbn13', i,
                          'isbn13_alternativi', ia, 'open_library_work_ids', ol),
       now() + n * interval '2 seconds'
from b
where g is not null or i is not null or ia <> '[]' or ol <> '[]'
on conflict do nothing;

-- 3c. SCRIVE. Copertina da un indirizzo scelto a mano (vedi docs per quali
--     fonti accettano il nostro User-Agent). Passa per gli stessi controlli
--     e la stessa conversione delle altre fonti.
insert into public.lavoro (tipo, chiave, payload)
values ('copertina', '<libro_id>',
        jsonb_build_object('libro_id', '<libro_id>', 'url_immagine', '<https://...>'))
on conflict do nothing;

-- 3d. SCRIVE. Copertina di un'edizione precisa di Open Library (un `OL…M`
--     trovato su /works/<OL…W>/editions.json), senza passare da Google.
insert into public.lavoro (tipo, chiave, payload)
values ('copertina', '<libro_id>',
        jsonb_build_object('libro_id', '<libro_id>', 'open_library_work_ids', jsonb_build_array('<OL…M>')))
on conflict do nothing;


-- ============================================================================
-- 4. AGGIUNGERE OPERE AL CATALOGO (mai con INSERT su libro)
-- ============================================================================

-- 4a. SCRIVE. Seminare una lista di opere: ogni riga diventa un lavoro
--     `semina_libro`, che percorre la catena vera. Gli autori sono un
--     elenco: passare più grafie dello stesso nome aumenta le corrispondenze
--     (il confronto è sul cognome).
insert into public.lavoro (tipo, chiave, payload, esegui_dopo)
select 'semina_libro', 'manuale:' || md5(titolo),
       jsonb_build_object('titolo', titolo, 'autori', autori),
       now() + n * interval '20 seconds'
from (values
  ('<titolo>', '["<Nome Cognome>", "<grafia alternativa>"]'::jsonb, 1)
) as t(titolo, autori, n)
on conflict do nothing;

-- 4b. Dove è finita un'opera seminata: le schede nate di recente con un
--     autore dal cognome cercato.
select l.id, l.titolo_canonico, l.anno_prima_pubblicazione, l.copertina_stato, l.creato_at
from public.libro l
join public.libro_autore la on la.libro_id = l.id
join public.autore a on a.id = la.autore_id
where lower(a.nome_canonico) like '%<cognome>%'
order by l.creato_at desc;


-- ============================================================================
-- 5. DOPPIONI
-- ============================================================================

-- 5a. Proposte della deduplicazione assistita, con le due schede affiancate.
select p.id, p.motivo,
       la.titolo_canonico as titolo_a, la.anno_prima_pubblicazione as anno_a,
       (select count(*) from public.voce_di_libreria v where v.libro_id = la.id) as voci_a,
       lb.titolo_canonico as titolo_b, lb.anno_prima_pubblicazione as anno_b,
       (select count(*) from public.voce_di_libreria v where v.libro_id = lb.id) as voci_b
from public.proposta_fusione_libro p
join public.libro la on la.id = p.libro_id_a
join public.libro lb on lb.id = p.libro_id_b
where p.stato = 'in_attesa';

-- 5b. SCRIVE. Chiudere una proposta senza fondere.
update public.proposta_fusione_libro set stato = 'scartata', rivisto_at = now()
where id = '<proposta_id>' and stato = 'in_attesa';

-- 5c. Prima di fondere: lo stesso Utente ha una Voce su entrambe? Se sì
--     fondi_libro le consolida, e si ferma se entrambe hanno una lettura
--     aperta (va chiusa una delle due prima).
select u.nome_utente,
       (select count(*) from public.lettura le where le.voce_id = vs.id and le.esito is null) as aperte_sopravvissuta,
       (select count(*) from public.lettura le where le.voce_id = vd.id and le.esito is null) as aperte_duplicata
from public.voce_di_libreria vs
join public.voce_di_libreria vd on vd.utente_id = vs.utente_id
join public.utente u on u.id = vs.utente_id
where vs.libro_id = '<sopravvissuta>' and vd.libro_id = '<duplicata>';

-- 5d. SCRIVE. Fondere: la duplicata sparisce, Voci, letture, recensioni,
--     insight e riferimenti passano sulla sopravvissuta.
select public.fondi_libro('<sopravvissuta>', '<duplicata>');
update public.proposta_fusione_libro set stato = 'risolta', rivisto_at = now()
where stato = 'in_attesa'
  and (libro_id_a, libro_id_b) = (least('<sopravvissuta>'::uuid, '<duplicata>'::uuid),
                                  greatest('<sopravvissuta>'::uuid, '<duplicata>'::uuid));


-- ============================================================================
-- 6. CORREGGERE UNA SCHEDA
-- ============================================================================

-- 6a. Tutto ciò che si sa di una scheda.
select l.*,
  (select string_agg(a.nome_canonico, ', ' order by la.ordine) from public.libro_autore la
     join public.autore a on a.id = la.autore_id where la.libro_id = l.id) as autori,
  (select string_agg(fonte || ':' || identificativo || case when principale then '*' else '' end, ' ')
     from public.libro_riferimento_esterno r where r.libro_id = l.id) as riferimenti,
  (select string_agg(lingua || '=' || titolo || ' (' || fonte || ')', ' | ')
     from public.variante_titolo v where v.libro_id = l.id) as varianti,
  (select string_agg(lingua || ':' || fonte, ' ') from public.libro_descrizione d
     where d.libro_id = l.id) as descrizioni,
  (select count(*) from public.voce_di_libreria v where v.libro_id = l.id) as voci
from public.libro l where l.id = '<libro_id>';

-- 6b. SCRIVE. Anno di prima pubblicazione, a valori controllati.
update public.libro l set anno_prima_pubblicazione = c.a, anno_dedotto = false
from (values ('<libro_id>'::uuid, <anno_attuale>, <anno_giusto>)) as c(id, da, a)
where l.id = c.id and l.anno_prima_pubblicazione is not distinct from c.da;

-- 6c. Prima di rinominare un autore: esiste già con il nome giusto? Il
--     nome variante è unico in tutto il catalogo, non per autore.
select a.id, a.nome_canonico,
       (select count(*) from public.libro_autore la where la.autore_id = a.id) as libri,
       (select string_agg(nome_variante, ' | ') from public.autore_nome_variante v
         where v.autore_id = a.id) as varianti
from public.autore a where a.nome_canonico ilike '%<cognome>%';

-- 6d. SCRIVE. Rinominare (se non esiste un doppione).
update public.autore set nome_canonico = '<nome giusto>'
where id = '<autore_id>' and nome_canonico = '<nome sbagliato>';

-- 6e. SCRIVE. Agganciare una scheda all'opera canonica (dopo aver
--     verificato su Open Library e Wikidata, vedi docs) e riaccodare le
--     descrizioni da Wikipedia.
insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo, principale) values
  ('<libro_id>', 'open_library', '<OL…W>', true),
  ('<libro_id>', 'wikidata', '<Q…>', true);
insert into public.lavoro (tipo, chiave, payload)
values ('descrizione', '<libro_id>',
        jsonb_build_object('libro_id', '<libro_id>',
                           'titoli_wikipedia', jsonb_build_object('it', '<titolo pagina itwiki>',
                                                                  'en', '<titolo pagina enwiki>')))
on conflict do nothing;


-- ============================================================================
-- 7. PAGINE
-- ============================================================================

-- 7a. Voci senza pagine, e se il catalogo saprebbe riempirle.
select u.nome_utente,
       coalesce((select vt.titolo from public.variante_titolo vt
                 where vt.libro_id = l.id and vt.lingua = 'it'), l.titolo_canonico) as titolo,
       l.pagine_mediane_catalogo
from public.voce_di_libreria v
join public.libro l on l.id = v.libro_id
join public.utente u on u.id = v.utente_id
where v.pagine_adottate is null
order by 1, 2;

-- 7b. SCRIVE. Pagine su una scheda e sulle sue Voci ancora vuote (mai su
--     quelle già compilate: sono dell'Utente).
update public.libro set pagine_mediane_catalogo = <pagine>
where id = '<libro_id>' and pagine_mediane_catalogo is not distinct from <pagine_attuali>;
update public.voce_di_libreria set pagine_adottate = <pagine>
where libro_id = '<libro_id>' and pagine_adottate is null;

-- 7c. Numeri di pagine sospetti nelle librerie.
select coalesce((select vt.titolo from public.variante_titolo vt
                 where vt.libro_id = l.id and vt.lingua = 'it'), l.titolo_canonico) as titolo,
       v.pagine_adottate
from public.voce_di_libreria v join public.libro l on l.id = v.libro_id
where v.pagine_adottate < 40 or v.pagine_adottate > 1500;
