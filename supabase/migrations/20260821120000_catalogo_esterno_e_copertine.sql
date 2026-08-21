-- Montaigne — catalogo esterno, copertine e lavori in secondo piano
--
-- Rende possibile ciò che il PRD (comportamento #3) chiama l'unica via
-- d'ingresso dei libri: la ricerca su cataloghi esterni. Fino a questa
-- migrazione `public.libro` era popolabile solo a mano
-- (`supabase/seed.sql`), e `POST /voci` accettava soltanto un `libro_id`
-- già esistente.
--
-- Le scelte qui sotto nascono da misure fatte sulle API reali, non dalla
-- lettura della loro documentazione. Le tre che contano:
--
-- 1. Open Library contiene opere DUPLICATE: "La solitudine dei numeri
--    primi" ha tre record d'opera distinti, "Le otto montagne" tre. ADR
--    0002 resta valido nella sostanza (una scheda per opera, identità mai
--    dal titolo), ma la sua premessa implicita — che il catalogo canonico
--    fornisca un identificativo unico per opera — è falsa. La fusione di
--    schede duplicate è quindi manutenzione ordinaria, non un caso
--    limite, e lo schema deve renderla economica.
-- 2. Circa il 40% degli ISBN italiani non è in Open Library. La
--    risoluzione dell'identità ha bisogno di più binari (ISBN, testo
--    libero, Wikidata) e di una degradazione ordinata quando falliscono
--    tutti.
-- 3. La copertina più grande servita da Open Library è 500px di lato
--    lungo, sotto i 600px che il PRD richiede per la versione grande.
--    Google Books ne serve una da 1652x2478. Il criterio di scelta della
--    fonte è quindi la qualità del dato (PRD §Copertina, ADR 0010).
--
-- Convenzioni ereditate da 20260818115830_schema_montaigne.sql: "enum"
-- applicativi come `text` + `check`; tabelle di catalogo senza
-- proprietario, leggibili da ogni autenticato e scrivibili solo fuori
-- banda; RLS attiva ovunque, e dove non è applicabile nella forma
-- `auth.uid()` lo si dichiara a parole accanto alla tabella invece di
-- ometterlo in silenzio.

-- ============================================================================
-- Estensioni
-- ============================================================================
-- `unaccent` serve alla ricerca locale (funzione `cerca_libri` in fondo):
-- chi cerca "citta invisibili" senza accento deve trovare "Le città
-- invisibili". Stessa collocazione di `vector` nello schema `extensions`.
create extension if not exists unaccent with schema extensions;

-- ============================================================================
-- 1. libro_riferimento_esterno
-- ============================================================================
-- La tabella che sostituisce `libro.identificativo_canonico`.
--
-- Il difetto della colonna singola era di CARDINALITÀ, non di forma: il
-- rapporto tra un'opera e i suoi identificativi esterni è 1:N, e le
-- misure lo dimostrano da tre lati insieme. Una stessa opera ha N ISBN
-- (edizioni, editori, rilegature diverse: verificato che gli ISBN
-- Harcourt, Vintage e LGF de "Il nome della rosa" risolvono tutti sullo
-- stesso record d'opera), N identificativi di volume Google, e — per il
-- punto 1 dell'intestazione — perfino più di un record d'opera Open
-- Library. Una colonna `unique` sul lato "1" non poteva esprimerlo.
--
-- Il guadagno concreto è sulla fusione dei duplicati, che ADR 0002
-- elenca come il costo di invertire la decisione:
--
--   update public.libro_riferimento_esterno
--      set libro_id = <scheda sopravvissuta>
--    where libro_id = <scheda duplicata>;
--   delete from public.libro where id = <scheda duplicata>;
--
-- Nessuna Voce di libreria viene toccata. Con la colonna singola sarebbe
-- stata una cancellazione con riassegnazione manuale di ogni Voce di
-- ogni Utente.

create table public.libro_riferimento_esterno (
  libro_id uuid not null references public.libro (id) on delete cascade,
  fonte text not null,
  identificativo text not null,
  principale boolean not null default false,
  creato_at timestamptz not null default now(),
  -- Chiave primaria e non un id surrogato con un unique accanto: il
  -- primo passo della catena di risoluzione ("questo identificativo l'ho
  -- già visto?") è esattamente `where (fonte, identificativo) = (...)`,
  -- quindi è una ricerca sulla chiave primaria. Un id surrogato
  -- aggiungerebbe un indice che nessuna query userebbe mai.
  constraint pk_libro_riferimento_esterno primary key (fonte, identificativo),
  constraint chk_libro_riferimento_esterno_fonte
    check (fonte in ('open_library', 'google_books', 'wikidata', 'isbn13'))
);

comment on table public.libro_riferimento_esterno is
  'Gli identificativi esterni che puntano a una scheda: da uno a molti per Libro. Sostituisce libro.identificativo_canonico, che modellava come colonna singola un rapporto 1:N. Fondere due schede duplicate (frequente: Open Library stessa contiene opere duplicate) è un UPDATE di queste righe, senza toccare alcuna Voce di libreria. RLS: dato condiviso di sistema, nessuna policy INSERT/UPDATE/DELETE per authenticated — scrittura solo fuori banda con la chiave di servizio (ADR 0007).';

comment on column public.libro_riferimento_esterno.fonte is
  '''isbn13'' è uno spazio di nomi, non un servizio: un ISBN non ha un fornitore. Sta qui perché il primo passo della risoluzione ("identificativo già noto -> zero chiamate esterne") resti una sola query su una sola tabella, invece di un''unione tra questa e una tabella di ISBN separata.';

comment on column public.libro_riferimento_esterno.principale is
  'Il riferimento da preferire per quella fonte quando se ne mostra o se ne segue uno solo. Non è "l''identificativo canonico" travestito: più righe della stessa fonte restano legittime, ed è proprio ciò che rende la fusione un UPDATE.';

create index idx_libro_riferimento_esterno_libro_id
  on public.libro_riferimento_esterno (libro_id);

-- Al più un riferimento principale per (libro, fonte). È un vincolo tra
-- righe, non esprimibile con un CHECK: stesso schema di
-- uq_lettura_una_aperta_per_voce (20260820065144).
create unique index uq_libro_riferimento_esterno_principale
  on public.libro_riferimento_esterno (libro_id, fonte)
  where principale;

-- ============================================================================
-- 2. Travaso, prima di distruggere
-- ============================================================================
-- Sul database di sviluppo è un no-op (il seed lascia
-- `identificativo_canonico` a NULL su ogni riga). Resta perché questo
-- non è l'unico database che riceverà la migrazione: se il Manutentore
-- ha scritto a mano un identificativo d'opera su una scheda, quello è
-- l'unico ponte esistente verso il catalogo esterno e va conservato
-- nella forma nuova. `non_canonicalizzato` distingue un identificativo
-- di fonte da uno inventato dal sistema: solo i primi sono riferimenti
-- esterni veri.
insert into public.libro_riferimento_esterno (libro_id, fonte, identificativo, principale)
select id, 'open_library', identificativo_canonico, true
from public.libro
where identificativo_canonico is not null
  and non_canonicalizzato = false
on conflict (fonte, identificativo) do nothing;

-- ============================================================================
-- 3. libro — via le due colonne di identità
-- ============================================================================
-- Verificato prima di scrivere questa migrazione: nessun modulo
-- applicativo legge le due colonne. `_SELECT_CON_LIBRO` in
-- backend/app/repositories/voce_repository.py seleziona
-- (id, titolo_canonico, anno_prima_pubblicazione, lingua_originale,
-- copertina_*_path); `LibroEssenziale` in backend/app/schemas/voci.py
-- non le porta; `LibroBody` in frontend/src/lib/api/voci.ts nemmeno.
-- L'unico riferimento fuori dallo schema era un commento in
-- supabase/seed.sql, riscritto insieme a questa migrazione.
--
-- Senza `cascade`, deliberatamente: se esistesse una vista, un indice o
-- un vincolo dipendente che l'analisi non ha visto, Postgres rifiuta e
-- la migrazione si ferma. Con `cascade` li eliminerebbe in silenzio.
-- L'unico dipendente atteso è uq_libro_identificativo_canonico, che cade
-- insieme alla colonna.
alter table public.libro drop column identificativo_canonico;
alter table public.libro drop column non_canonicalizzato;

-- `non_canonicalizzato` non viene ricreata altrove: è un fatto derivabile,
-- non un dato. Una scheda è non canonicalizzata quando non ha alcun
-- riferimento di fonte 'open_library' o 'wikidata'. Conservarla come
-- colonna significherebbe tenere un booleano accanto al dato che lo
-- determina, con la possibilità di divergere — la stessa forma di errore
-- che ADR 0005 rifiuta per le etichette dei generi.

-- ============================================================================
-- 4. libro — copertine e pagine rappresentative
-- ============================================================================

alter table public.libro
  add column copertina_stato text not null default 'in_attesa',
  add column copertina_colore_dominante text,
  add column pagine_mediane_catalogo integer;

alter table public.libro
  add constraint chk_libro_copertina_stato
    check (copertina_stato in ('in_attesa', 'presente', 'assente', 'fallita')),
  add constraint chk_libro_copertina_colore
    check (copertina_colore_dominante is null
           or copertina_colore_dominante ~ '^#[0-9a-f]{6}$'),
  -- Impedisce la riga incoerente che il frontend leggerebbe in modo
  -- contraddittorio ('presente' senza immagine, o immagine senza
  -- 'presente'). Stesso ruolo di chk_lettura_esito_coerente_con_chiusura.
  add constraint chk_libro_copertina_coerente
    check ((copertina_stato = 'presente') = (copertina_miniatura_path is not null)),
  add constraint chk_libro_pagine_mediane
    check (pagine_mediane_catalogo is null or pagine_mediane_catalogo > 0);

comment on column public.libro.copertina_stato is
  'Lo stato osservabile del recupero copertina (PRD "lavori in secondo piano con uno stato osservabile"). È QUI e non nella coda `lavoro`: il frontend legge una colonna che sta già leggendo, e la coda resta infrastruttura chiusa. ''assente'' non è un fallimento ma un esito — la fonte ha risposto e non ha l''immagine (PRD, "senza ulteriori tentativi automatici"); ''fallita'' è l''esaurimento dei tentativi su errori di trasporto.';

comment on column public.libro.copertina_colore_dominante is
  'Colore dominante della copertina in #rrggbb, estratto lato server durante la conversione — l''unico momento in cui l''immagine è già decodificata in memoria. Governa ombra e fondo del volume sullo scaffale (docs/design-frontend.md §7). Una scheda senza copertina non ne ha uno: il suo segnaposto tipografico usa un colore neutro dei token, non un colore estratto da un''immagine che non esiste.';

comment on column public.libro.pagine_mediane_catalogo is
  'Mediana delle pagine sulle edizioni per cui il catalogo dichiara un conteggio, da cui si precompila `voce_di_libreria.pagine_adottate` alla nascita della Voce (PRD §Conteggio pagine). NON è il conteggio autorevole e non entra in alcuna metrica: quello resta sulla Voce, per Utente e correggibile (ADR 0003). Sta sul Libro perché è dato di catalogo condiviso e perché altrimenti ogni Utente che aggiunge la stessa opera dovrebbe richiamare la fonte esterna per riottenerlo.';

-- Le schede nate prima di questa migrazione non hanno alcun riferimento
-- esterno da cui recuperare un'immagine: 'assente', non 'in_attesa', che
-- farebbe attendere allo scaffale una copertina che nessun lavoro
-- produrrà mai.
update public.libro set copertina_stato = 'assente' where copertina_miniatura_path is null;

-- ============================================================================
-- 5. libro_descrizione
-- ============================================================================
-- Stessa forma di `variante_titolo` e per la stessa ragione (ADR 0005):
-- nessun campo fisso per lingua, ogni descrizione è una riga che dichiara
-- la propria. Emenda il PRD, che nella versione precedente non prevedeva
-- una descrizione del Libro.

create table public.libro_descrizione (
  libro_id uuid not null references public.libro (id) on delete cascade,
  lingua text not null,
  testo text not null,
  fonte text not null,
  url_fonte text,
  creato_at timestamptz not null default now(),
  constraint pk_libro_descrizione primary key (libro_id, lingua),
  constraint chk_libro_descrizione_fonte check (fonte in ('wikipedia', 'google_books'))
);

comment on table public.libro_descrizione is
  'La descrizione di un''opera in una lingua. Wikipedia è preferita a Google Books perché è prosa enciclopedica invece che testo di quarta di copertina; Open Library non compare tra le fonti ammesse perché la sua descrizione è un unico blob senza tag di lingua, in pratica con più lingue concatenate dentro (verificato).';

comment on column public.libro_descrizione.url_fonte is
  'Non decorativo: i testi di Wikipedia sono CC BY-SA e l''attribuzione è una condizione d''uso, quindi la scheda del libro deve poterla mostrare.';

comment on column public.libro_descrizione.fonte is
  'Serve ad arbitrare la qualità, non solo a documentare la provenienza: la descrizione di Google c''è quasi sempre, quella di Wikipedia esiste solo per le opere notabili ma è migliore. Con la fonte in colonna, un passaggio successivo può promuovere Wikipedia dove arriva senza toccare il resto.';

-- ============================================================================
-- 6. variante_titolo — da quale fonte viene ogni variante
-- ============================================================================
-- Il vincolo `uq_variante_titolo_libro_lingua` fa sì che per ogni lingua
-- esista una variante sola. Senza sapere da dove viene, vinceva la prima
-- arrivata — e la prima è spesso il titolo grezzo di un volume di
-- catalogo, che nei risultati reali arriva in forme come
-- "La Solitudine Dei Numeri Primi (Italian Edition)". Con `fonte`,
-- l'arbitraggio è esplicito e l'ordine di arrivo non conta più.
--
-- La tabella è vuota su ogni database esistente (il seed non la scrive
-- mai), quindi `not null` senza default: se un domani non lo fosse, la
-- migrazione fallisce rumorosamente invece di inventare una provenienza.
alter table public.variante_titolo
  add column fonte text not null,
  add column creato_at timestamptz not null default now();

alter table public.variante_titolo
  add constraint chk_variante_titolo_fonte
    check (fonte in ('wikidata', 'open_library', 'google_books', 'manuale'));

create or replace function public.rango_fonte_variante(p_fonte text)
returns smallint
language sql
immutable
parallel safe
as $$
  select case p_fonte
           when 'manuale' then 0
           when 'wikidata' then 1
           when 'open_library' then 2
           else 3
         end::smallint;
$$;

comment on function public.rango_fonte_variante(text) is
  'Rango di preferenza tra le fonti di una variante di titolo, minore = migliore. Usata nell''ON CONFLICT della scrittura, così che una variante già presente venga sostituita solo da una fonte migliore: "vince la fonte migliore" invece di "vince la prima arrivata". ''manuale'' è la correzione del Manutentore fuori banda e non viene mai sovrascritta da un catalogo.';

-- ============================================================================
-- 7. lavoro — la coda dei lavori in secondo piano
-- ============================================================================
-- Il PRD elenca quattro operazioni che non stanno dentro il tempo di una
-- richiesta e "presuppongono lavori in secondo piano con uno stato
-- osservabile": ricostruzione degli indici semantici, recupero e
-- conversione delle copertine, riconduzione degli autori,
-- deduplicazione. Questa tabella è l'infrastruttura di tutte e quattro;
-- oggi il solo tipo ammesso è quello delle copertine, e il CHECK sul
-- tipo va esteso quando se ne aggiunge uno (docs/adr/0016).

create table public.lavoro (
  -- bigint identity e non uuid come il resto dello schema: una coda vuole
  -- un ordine FIFO totale e gratuito, che un uuid v4 non dà. Deliberato,
  -- non una svista.
  id bigint generated always as identity primary key,
  tipo text not null,
  chiave text not null,
  payload jsonb not null default '{}'::jsonb,
  stato text not null default 'in_attesa',
  tentativi smallint not null default 0,
  esegui_dopo timestamptz not null default now(),
  preso_at timestamptz,
  errore text,
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  constraint chk_lavoro_tipo check (tipo in ('copertina', 'descrizione')),
  constraint chk_lavoro_stato
    check (stato in ('in_attesa', 'in_corso', 'riuscito', 'fallito'))
);

comment on table public.lavoro is
  'Coda dei lavori in secondo piano (docs/adr/0016). Presa in carico con FOR UPDATE SKIP LOCKED, quindi più worker possono girare insieme senza coordinamento esterno. Lo stato che il prodotto mostra NON si legge da qui: per le copertine è libro.copertina_stato. Questa tabella è infrastruttura e resta chiusa a ogni ruolo applicativo (vedi RLS in fondo).';

comment on column public.lavoro.chiave is
  'Identifica l''oggetto del lavoro (per le copertine: il libro_id). Insieme a `tipo` regge l''indice unico parziale sotto, che impedisce di accodare due volte lo stesso lavoro pendente.';

comment on column public.lavoro.tentativi is
  'Incrementato ALLA PRESA IN CARICO, non al fallimento: un worker ucciso a metà lavoro brucia comunque un tentativo. È la protezione contro il lavoro velenoso che fa cadere il processo e verrebbe ripreso all''infinito a ogni riavvio.';

-- Due Utenti che aggiungono la stessa opera nello stesso minuto non
-- devono accodare due recuperi della stessa copertina.
create unique index uq_lavoro_pendente
  on public.lavoro (tipo, chiave)
  where stato in ('in_attesa', 'in_corso');

-- Indice della presa in carico. Parziale, perché a regime la coda è
-- quasi tutta 'riuscito' e quelle righe non vanno mai scandite.
create index idx_lavoro_da_prendere
  on public.lavoro (esegui_dopo, id)
  where stato = 'in_attesa';

-- Indice del recuperatore dei lavori orfani (worker morto a metà).
create index idx_lavoro_in_corso
  on public.lavoro (preso_at)
  where stato = 'in_corso';

-- ============================================================================
-- 8. cerca_libri — la ricerca sulle schede già nel sistema
-- ============================================================================
-- Il PRD vuole che la ricerca interroghi "prima le schede già esistenti
-- nel sistema [...] e poi i cataloghi esterni", e il design chiede che le
-- prime compaiano per prime *perché* non richiedono una chiamata
-- esterna. Questa funzione è quel primo passo: sola lettura, solo
-- Postgres, nessuna rete.
--
-- È una funzione e non una query PostgREST perché deve attraversare
-- quattro tabelle con criteri diversi (titolo canonico, varianti di
-- titolo, nomi d'autore, varianti di nome) e portarsi dietro la Voce di
-- chi chiama con l'anno dell'ultima lettura chiusa — cioè il dato della
-- riga "Letto nel 2023, quattro stelle" del design §13.
--
-- `security invoker`: la funzione gira con i privilegi e l'identità di
-- chi la chiama, quindi la RLS di `voce_di_libreria` resta valutata e il
-- join sulla propria Voce è sicuro per costruzione, senza che questa
-- funzione debba filtrare nulla a mano. Sarebbe stato `security definer`
-- l'errore da non fare.

create or replace function public.cerca_libri(
  p_termine text,
  p_lingua text default 'it',
  p_limite integer default 20
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
    select extensions.unaccent(lower(trim(p_termine))) as t
  ),
  candidati as (
    -- Rango: quanto è diretta la corrispondenza. 0 il titolo canonico che
    -- inizia col termine, 1 il titolo canonico che lo contiene, 2 una
    -- variante di titolo, 3 un autore. Serve a mettere in cima ciò che
    -- l'utente stava quasi certamente cercando, non a filtrare.
    select l.id as libro_id,
           min(c.rango)::smallint as rango
    from public.libro l
    join lateral (
      select 0 as rango
      where extensions.unaccent(lower(l.titolo_canonico)) like (select t || '%' from termine)
      union all
      select 1
      where extensions.unaccent(lower(l.titolo_canonico)) like (select '%' || t || '%' from termine)
      union all
      select 2
      from public.variante_titolo vt
      where vt.libro_id = l.id
        and extensions.unaccent(lower(vt.titolo)) like (select '%' || t || '%' from termine)
      union all
      select 3
      from public.libro_autore la
      join public.autore a on a.id = la.autore_id
      where la.libro_id = l.id
        and extensions.unaccent(lower(a.nome_canonico)) like (select '%' || t || '%' from termine)
      union all
      select 3
      from public.libro_autore la
      join public.autore_nome_variante anv on anv.autore_id = la.autore_id
      where la.libro_id = l.id
        and extensions.unaccent(lower(anv.nome_variante)) like (select '%' || t || '%' from termine)
    ) c on true
    group by l.id
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
    c.rango
  from candidati c
  join public.libro l on l.id = c.libro_id
  left join public.variante_titolo vt on vt.libro_id = l.id and vt.lingua = p_lingua
  -- La RLS di voce_di_libreria permette a un collegato attivo di leggere
  -- la riga altrui: senza il filtro esplicito su auth.uid() questo join
  -- porterebbe anche la Voce di un collegato per lo stesso libro, e la
  -- ricerca mostrerebbe "Letto nel 2023" per una lettura che non è la
  -- propria. Stesso presidio già applicato in voce_repository.get_by_libro.
  left join public.voce_di_libreria v on v.libro_id = l.id and v.utente_id = auth.uid()
  where length((select t from termine)) > 0
  order by c.rango, l.titolo_canonico
  limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.cerca_libri(text, text, integer) is
  'Ricerca sulle schede già nel sistema, per titolo canonico, variante di titolo, nome d''autore o variante di nome. `security invoker`: la RLS di voce_di_libreria resta valutata, quindi il join sulla propria Voce è sicuro per costruzione. Nessun indice trigram: alla scala prevista dal PRD (un gruppo chiuso, centinaia di libri) la scansione sequenziale su unaccent+like è più veloce dell''indice e non va mantenuta — è una scelta, non una dimenticanza, da rivedere se il catalogo crescesse di ordini di grandezza.';

grant execute on function public.cerca_libri(text, text, integer) to authenticated;

-- ============================================================================
-- 9. Spazio file delle copertine
-- ============================================================================
-- Bucket PRIVATO. La regola 6 del PRD non ammette alternative — "nessun
-- dato di lettura e nessun file conservato dal sistema, copertine
-- comprese, è accessibile senza autenticazione" — ed è accompagnata da un
-- test esplicito: richiesta anonima a qualunque indirizzo di immagine,
-- rifiuto.
--
-- NESSUNA POLICY SU storage.objects, E QUESTO È IL PUNTO. Non è
-- un'omissione:
--   - `service_role` bypassa la RLS per definizione della piattaforma,
--     quindi il worker scrive le copertine senza che serva una policy;
--   - senza policy, nessun `anon` né `authenticated` legge direttamente;
--   - gli URL firmati funzionano lo stesso, perché l'API Storage valida
--     il token contenuto nell'URL, non il ruolo del chiamante. Il
--     frontend non parla mai con Storage: consuma URL che il back end ha
--     firmato.
--
-- L'errore da non fare è aggiungere una policy `for select to
-- authenticated` "per sicurezza": renderebbe ogni copertina leggibile a
-- chiunque abbia un token valido e un percorso indovinabile, cioè
-- aprirebbe esattamente la superficie che la regola 6 chiude.
--
-- Percorsi: copertine/{libro_id}/miniatura.webp e .../grande.webp — un
-- prefisso per libro, così la cancellazione di una scheda è la rimozione
-- di un prefisso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('copertine', 'copertine', false, 2097152, array['image/webp'])
on conflict (id) do nothing;


-- ============================================================================
-- 11. genere — le 28 identità dell'elenco chiuso
-- ============================================================================
-- L'elenco è definito nell'appendice del PRD ed è chiuso: "Ogni voce ha
-- un'identità stabile a cui puntano i libri, e due etichette che l'utente
-- legge. Le etichette si possono riscrivere in qualsiasi momento senza
-- toccare alcun libro; le identità no, perché reggono le metriche degli
-- anni passati."
--
-- Sta in una migrazione e non in supabase/seed.sql benché il PRD affidi il
-- popolamento al Manutentore fuori banda (ADR 0007): una migrazione È
-- fuori banda, e queste non sono righe di esempio ma la definizione del
-- dominio. `libro_genere.genere_id` le referenzia con ON DELETE RESTRICT,
-- quindi senza di esse nessun libro potrebbe mai essere classificato — e
-- il seed non gira in produzione.
--
-- "Non classificato" NON compare: non è un genere di questo elenco ma
-- l'assenza di genere, cioè un libro senza righe in libro_genere.

insert into public.genere (id) values
  ('literary_fiction'),
  ('classics'),
  ('historical_fiction'),
  ('crime_thriller'),
  ('fantasy'),
  ('science_fiction'),
  ('horror'),
  ('romance'),
  ('poetry'),
  ('biography_memoir'),
  ('history'),
  ('philosophy'),
  ('politics_society'),
  ('economics_business'),
  ('science'),
  ('technology'),
  ('psychology'),
  ('self_improvement'),
  ('health_fitness'),
  ('religion_spirituality'),
  ('art_photography'),
  ('performing_arts'),
  ('travel'),
  ('nature_environment'),
  ('food_cooking'),
  ('sport'),
  ('essays_reportage'),
  ('true_crime')
on conflict (id) do nothing;

insert into public.genere_etichetta (genere_id, lingua, etichetta) values
  ('literary_fiction', 'it', 'Narrativa contemporanea'),
  ('literary_fiction', 'en', 'Literary Fiction'),
  ('classics', 'it', 'Classici'),
  ('classics', 'en', 'Classics'),
  ('historical_fiction', 'it', 'Romanzo storico'),
  ('historical_fiction', 'en', 'Historical Fiction'),
  ('crime_thriller', 'it', 'Giallo e thriller'),
  ('crime_thriller', 'en', 'Crime & Thriller'),
  ('fantasy', 'it', 'Fantasy'),
  ('fantasy', 'en', 'Fantasy'),
  ('science_fiction', 'it', 'Fantascienza'),
  ('science_fiction', 'en', 'Science Fiction'),
  ('horror', 'it', 'Horror'),
  ('horror', 'en', 'Horror'),
  ('romance', 'it', 'Rosa'),
  ('romance', 'en', 'Romance'),
  ('poetry', 'it', 'Poesia'),
  ('poetry', 'en', 'Poetry'),
  ('biography_memoir', 'it', 'Biografie e memorie'),
  ('biography_memoir', 'en', 'Biography & Memoir'),
  ('history', 'it', 'Storia'),
  ('history', 'en', 'History'),
  ('philosophy', 'it', 'Filosofia'),
  ('philosophy', 'en', 'Philosophy'),
  ('politics_society', 'it', 'Politica e società'),
  ('politics_society', 'en', 'Politics & Society'),
  ('economics_business', 'it', 'Economia e impresa'),
  ('economics_business', 'en', 'Economics & Business'),
  ('science', 'it', 'Scienze'),
  ('science', 'en', 'Science'),
  ('technology', 'it', 'Tecnologia'),
  ('technology', 'en', 'Technology'),
  ('psychology', 'it', 'Psicologia'),
  ('psychology', 'en', 'Psychology'),
  ('self_improvement', 'it', 'Crescita personale'),
  ('self_improvement', 'en', 'Self-Improvement'),
  ('health_fitness', 'it', 'Salute e benessere'),
  ('health_fitness', 'en', 'Health & Fitness'),
  ('religion_spirituality', 'it', 'Religione e spiritualità'),
  ('religion_spirituality', 'en', 'Religion & Spirituality'),
  ('art_photography', 'it', 'Arte e fotografia'),
  ('art_photography', 'en', 'Art & Photography'),
  ('performing_arts', 'it', 'Musica e spettacolo'),
  ('performing_arts', 'en', 'Music & Performing Arts'),
  ('travel', 'it', 'Viaggi'),
  ('travel', 'en', 'Travel'),
  ('nature_environment', 'it', 'Natura e ambiente'),
  ('nature_environment', 'en', 'Nature & Environment'),
  ('food_cooking', 'it', 'Cucina'),
  ('food_cooking', 'en', 'Food & Cooking'),
  ('sport', 'it', 'Sport'),
  ('sport', 'en', 'Sport'),
  ('essays_reportage', 'it', 'Saggi e reportage'),
  ('essays_reportage', 'en', 'Essays & Reportage'),
  ('true_crime', 'it', 'Cronaca nera'),
  ('true_crime', 'en', 'True Crime')
on conflict (genere_id, lingua) do nothing;


-- ============================================================================
-- 12. pagine_adottate precompilate alla nascita della Voce
-- ============================================================================
-- Il PRD (comportamento #3) vuole che la Voce nasca "con il numero di
-- pagine precompilato a un valore rappresentativo che l'Utente può
-- correggere", e (§Conteggio pagine) che quel valore sia "la mediana
-- delle edizioni per cui il catalogo dichiara un conteggio pagine".
-- Finora non lo faceva nessuno: `POST /voci` inseriva la Voce senza mai
-- toccare quel campo.
--
-- Un trigger e non codice applicativo, per la stessa ragione per cui la
-- macchina a stati sta nel database (ADR 0015): le vie d'ingresso di una
-- Voce sono più d'una — `POST /voci` su una scheda esistente, la nascita
-- di una scheda dalla ricerca, gli inserimenti fuori banda del
-- Manutentore — e una regola scritta in una sola di esse è una regola che
-- le altre violano in silenzio.
--
-- Non forza il valore: se chi inserisce ha già indicato pagine_adottate,
-- quelle restano. Non è un valore autorevole (ADR 0003) ma un punto di
-- partenza correggibile.

create or replace function public.precompila_pagine_adottate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pagine_adottate is null then
    select l.pagine_mediane_catalogo into new.pagine_adottate
      from public.libro l
     where l.id = new.libro_id;
  end if;
  return new;
end;
$$;

comment on function public.precompila_pagine_adottate() is
  'Riempie voce_di_libreria.pagine_adottate con la mediana di catalogo del Libro quando chi inserisce non la indica (PRD, comportamento #3). `security definer` perché la lettura di public.libro non dipenda dai privilegi di chi inserisce; `search_path` fissato, come per le altre funzioni di questo schema.';

create trigger trg_voce_precompila_pagine
  before insert on public.voce_di_libreria
  for each row
  execute function public.precompila_pagine_adottate();

-- ============================================================================
-- 13. RLS e privilegi
-- ============================================================================

-- --- Dato di catalogo: libro_riferimento_esterno, libro_descrizione ---
--
-- Stessa situazione di autore/genere/libro (20260818115830): righe senza
-- proprietario, dato bibliografico condiviso di sistema. RLS attiva come
-- su ogni tabella (ADR 0001), lettura aperta a chiunque sia autenticato,
-- e NESSUNA policy INSERT/UPDATE/DELETE basata su auth.uid(), perché non
-- esiste un Utente proprietario a cui ancorarla. La scrittura avviene
-- solo fuori banda (ADR 0007), ed è rinforzata anche a livello di GRANT:
-- al ruolo `authenticated` non viene concesso il privilegio SQL, oltre a
-- non esistere la policy. Nessun privilegio ad `anon` (ADR 0006).

alter table public.libro_riferimento_esterno enable row level security;

create policy libro_riferimento_esterno_select_autenticati
  on public.libro_riferimento_esterno
  for select
  to authenticated
  using (true);

grant select on table public.libro_riferimento_esterno to authenticated;

alter table public.libro_descrizione enable row level security;

create policy libro_descrizione_select_autenticati
  on public.libro_descrizione
  for select
  to authenticated
  using (true);

grant select on table public.libro_descrizione to authenticated;

-- --- Infrastruttura: lavoro ---
--
-- Regime più stretto di qualunque altra tabella dello schema: RLS attiva,
-- ZERO policy e ZERO privilegi, nemmeno la SELECT.
--
-- Non è una dimenticanza. Lo stato che il prodotto deve mostrare è
-- `libro.copertina_stato`, che il frontend legge già insieme al resto
-- della scheda; la coda è infrastruttura, e un Utente autenticato non ha
-- alcuna richiesta legittima che la debba leggere. Esporla vorrebbe dire
-- pubblicare i tempi, gli errori e i tentativi interni del sistema in
-- cambio di nulla.
--
-- Il `revoke` sotto è un no-op su privilegi mai concessi: sta qui come
-- documentazione eseguibile dell'intenzione, ed è l'unica riga della
-- migrazione con quello scopo.
alter table public.lavoro enable row level security;

revoke all on table public.lavoro from anon, authenticated;
