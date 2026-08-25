-- ============================================================================
-- QUADERNI: il corpus, i suoi filtri, i vicini e il pensiero che torna
-- ============================================================================
-- Fino a qui Quaderni non conteneva nulla di proprio: aveva un campo che
-- interrogava i propri scritti (`cerca_semantico`) e una sintesi che li
-- riassumeva. I testi vivevano solo dentro la scheda del libro, e la "vista
-- trasversale degli insight" che design-frontend.md §10 rimandava da sempre
-- non esisteva da nessuna parte. Conseguenza pratica: a consenso revocato la
-- pagina era due stati vuoti, mentre §5 promette il contrario — "i propri
-- scritti esistono anche a consenso revocato, ed è solo il modo di
-- interrogarli che si spegne".
--
-- Questa migrazione costruisce quel contenuto. Il modello è "un corpus, tre
-- lenti": la materia è una sola (ciò che l'Utente ha scritto), e sfogliare,
-- chiedere e guardare i temi ne cambiano ordine e selezione, non l'esistenza.
--
--   scritto                vista: insight e recensioni sotto una forma sola
--   elenco_scritti         la lente "sfoglia" — gratuita, vive a consenso spento
--   sfaccettature_scritti  gli anni e i libri per cui vale la pena filtrare
--   pensiero_che_torna     un proprio scritto vecchio, uno al giorno, gratuito
--   vicini_a               i propri scritti vicini a uno dato — nessuna
--                          chiamata al fornitore: l'embedding è già in tabella
--   cerca_semantico        rifatta: i filtri entrano PRIMA del taglio
--
-- Nessuna tabella nuova e nessuna colonna nuova: tutto ciò che serve era già
-- scritto. Il pensiero che torna in particolare non conserva nulla di ciò che
-- ha già mostrato — la scelta è deterministica sul giorno (hash di utente più
-- data), quindi resta ferma per ventiquattr'ore senza una riga di stato da
-- mantenere e da cancellare insieme all'account.

-- ============================================================================
-- 1. `scritto` — insight e recensioni sotto una forma sola
-- ============================================================================
-- `security_invoker`: la RLS di `insight` e `recensione` resta valutata sul
-- chiamante (regola 24 del PRD, docs/adr/0001). Senza, la vista leggerebbe
-- con i diritti del proprietario e sarebbe un buco che nessuna policy
-- richiuderebbe.
--
-- Due differenze fra le due tabelle sono appianate qui, in un posto solo,
-- invece che in ogni chiamante:
--   - una recensione non ha `data` propria (PRD, entità Recensione: una per
--     Voce, riscritta sul posto), quindi si usa la sua `creato_at` riportata
--     sul fuso di Europa centrale, esattamente come già faceva
--     `cerca_semantico`;
--   - una recensione non ha contrassegno spoiler, che il PRD dà al solo
--     Insight: qui vale `false`, e l'interfaccia dichiara che il filtro
--     "spoiler" riguarda i soli insight invece di far sparire in silenzio le
--     recensioni.

create view public.scritto with (security_invoker = true) as
  select
    'insight'::text as tipo_contenuto,
    i.id            as contenuto_id,
    i.utente_id,
    i.voce_id,
    i.testo,
    i.spoiler,
    i.visibilita,
    i.data,
    i.creato_at
  from public.insight i
  union all
  select
    'recensione'::text,
    r.id,
    r.utente_id,
    r.voce_id,
    r.testo,
    false,
    r.visibilita,
    (r.creato_at at time zone 'Europe/Rome')::date,
    r.creato_at
  from public.recensione r;

comment on view public.scritto is
  'Insight e recensioni dell''Utente sotto una forma sola: è la materia dei Quaderni (design-frontend.md §22). `security_invoker`, quindi la RLS delle due tabelle di base resta l''unico punto in cui vive "chi vede cosa". Una recensione non ha data propria né contrassegno spoiler: la prima viene da `creato_at` sul fuso di Europa centrale, il secondo vale false.';

grant select on public.scritto to authenticated;

-- ============================================================================
-- 2. `elenco_scritti` — la lente "sfoglia"
-- ============================================================================
-- La sola delle tre lenti che non chiede niente a nessuno: nessuna chiamata al
-- fornitore, nessun indice semantico, quindi funziona identica a consenso
-- revocato. È ciò che rende Quaderni una materia che si abita invece di
-- un'interfaccia al modello.
--
-- I filtri stanno QUI e non nel chiamante per la stessa ragione per cui
-- stanno dentro `cerca_semantico` (sezione 6): filtrare a valle di un taglio
-- restituisce elenchi vuoti che si leggono come "non hai scritto niente al
-- riguardo", che è la cosa falsa più credibile che l'app possa dire.
--
-- `totale` e `libri_distinti` viaggiano su ogni riga invece che in una
-- seconda chiamata: sono ciò che le pastiglie decidono (design-frontend.md
-- §7, "il conteggio chiude la stessa riga perché dice esattamente ciò che le
-- pastiglie decidono"), e leggerli in un secondo giro li farebbe divergere
-- dalla pagina che si sta guardando.
--
-- **Due elenchi e non due valori singoli.** `p_voce_ids` regge il menù
-- "ogni libro", che ne passa uno solo, ma anche la lente dei temi quando
-- deve ricadere sui libri di un tema. `p_contenuto_ids` è la lente dei
-- temi vera e propria: un tema NON è un attributo dello scritto — è un
-- elenco di scritti che il modello ha messo insieme — e senza questo
-- filtro il tema potrebbe restringere solo ciò che è già in pagina,
-- perdendo i propri riferimenti più vecchi della prima trentina.
--
-- `p_con_vicini` è spento di default e non acceso: il conteggio dei vicini
-- costa un confronto vettoriale per ogni riga della pagina contro tutti i
-- vettori dell'Utente, ed è inutile quando il consenso è spento (gli indici
-- non ci sono più) o quando chi chiama vuole solo contare.

create function public.elenco_scritti(
  p_tipo text default null,
  p_solo_spoiler boolean default false,
  p_anno integer default null,
  p_voce_ids uuid[] default null,
  p_contenuto_ids uuid[] default null,
  p_con_vicini boolean default false,
  p_soglia_vicini real default 0.65,
  p_limite integer default 30,
  p_scarto integer default 0
)
returns table (
  tipo_contenuto text,
  contenuto_id uuid,
  testo text,
  spoiler boolean,
  visibilita text,
  data date,
  voce_id uuid,
  libro_id uuid,
  titolo_canonico text,
  autori text[],
  copertina_miniatura_path text,
  copertina_colore_dominante text,
  vicini integer,
  totale bigint,
  libri_distinti bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with filtrati as (
    select s.*, v.libro_id
      from public.scritto s
      join public.voce_di_libreria v on v.id = s.voce_id
     where s.utente_id = auth.uid()
       and (p_tipo is null or s.tipo_contenuto = p_tipo)
       and (not p_solo_spoiler or s.spoiler)
       and (p_anno is null or extract(year from s.data)::int = p_anno)
       and (p_voce_ids is null or s.voce_id = any(p_voce_ids))
       and (p_contenuto_ids is null or s.contenuto_id = any(p_contenuto_ids))
  ),
  totali as (
    select count(*) as totale, count(distinct f.libro_id) as libri_distinti
      from filtrati f
  ),
  pagina as (
    select f.*
      from filtrati f
     order by f.data desc, f.creato_at desc, f.contenuto_id
     limit least(greatest(p_limite, 1), 100)
    offset greatest(p_scarto, 0)
  )
  select
    p.tipo_contenuto,
    p.contenuto_id,
    p.testo,
    p.spoiler,
    p.visibilita,
    p.data,
    p.voce_id,
    p.libro_id,
    l.titolo_canonico,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ),
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    coalesce(vic.n, 0),
    t.totale,
    t.libri_distinti
  from pagina p
  cross join totali t
  join public.libro l on l.id = p.libro_id
  left join lateral (
    select count(*)::int as n
      from public.indice_semantico ix
      join public.indice_semantico ix2
        on ix2.utente_id = ix.utente_id
       and ix2.id <> ix.id
     where p_con_vicini
       and ix.utente_id = auth.uid()
       and (ix.insight_id = p.contenuto_id or ix.recensione_id = p.contenuto_id)
       and (ix2.embedding <=> ix.embedding) < p_soglia_vicini
  ) vic on true
  order by p.data desc, p.creato_at desc, p.contenuto_id;
$$;

comment on function public.elenco_scritti(text, boolean, integer, uuid[], uuid[], boolean, real, integer, integer) is
  'La lente "sfoglia" dei Quaderni: i propri insight e le proprie recensioni dal più recente, filtrabili per tipo, spoiler, anno e Voce (design-frontend.md §22). Nessuna chiamata al fornitore e nessun indice semantico letto finché `p_con_vicini` resta falso: è la sola delle tre lenti che funziona identica a consenso revocato. I filtri sono applicati PRIMA del taglio, mai dopo. `totale` e `libri_distinti` viaggiano su ogni riga perché il conteggio in pagina dica esattamente ciò che le pastiglie decidono (§7).';

grant execute on function public.elenco_scritti(text, boolean, integer, uuid[], uuid[], boolean, real, integer, integer) to authenticated;

-- ============================================================================
-- 3. `sfaccettature_scritti` — cosa vale la pena filtrare
-- ============================================================================
-- Un menù d'anno che elenca anni in cui non si è scritto niente, o di libri
-- che non hanno scritti, è un menù che promette risultati vuoti. Qui escono
-- solo i valori che hanno almeno una riga, col loro conteggio.
--
-- Non filtrata dalle altre pastiglie di proposito: le sfaccettature dicono
-- cosa c'è nel corpus, non cosa resta della selezione corrente — altrimenti
-- restringere per tipo farebbe sparire anni dal menù e non ci si potrebbe
-- più tornare.

create function public.sfaccettature_scritti()
returns table (tipo text, chiave text, etichetta text, n bigint, autori text[])
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select 'anno'::text,
         extract(year from s.data)::int::text,
         extract(year from s.data)::int::text,
         count(*),
         null::text[]
    from public.scritto s
   where s.utente_id = auth.uid()
   group by 2, 3
  union all
  select 'libro'::text,
         s.voce_id::text,
         l.titolo_canonico,
         count(*),
         -- Gli autori servono al filtro sul menù "ogni libro" (design
         -- doc §22): una libreria di centinaia di titoli non si sfoglia
         -- riga per riga, e chi cerca spesso ricorda l'autore più del
         -- titolo esatto. `null` sulle righe "anno" perché lì il campo
         -- non vuol dire nulla, non perché sia stato dimenticato.
         (select array_agg(a.nome_canonico order by la.ordine)
            from public.libro_autore la
            join public.autore a on a.id = la.autore_id
           where la.libro_id = l.id)
    from public.scritto s
    join public.voce_di_libreria v on v.id = s.voce_id
    join public.libro l on l.id = v.libro_id
   where s.utente_id = auth.uid()
   group by 2, 3, l.id;
$$;

comment on function public.sfaccettature_scritti() is
  'Gli anni e i libri per cui esiste almeno uno scritto proprio, col conteggio e — sui soli libri — gli autori: riempiono i due menù di `elenco_scritti` senza offrire voci che darebbero un elenco vuoto, e permettono al menù "ogni libro" di filtrarsi per autore oltre che per titolo. Deliberatamente NON ristretta dalla selezione corrente, altrimenti restringere per tipo toglierebbe anni dal menù e non ci si potrebbe più tornare.';

grant execute on function public.sfaccettature_scritti() to authenticated;

-- ============================================================================
-- 4. `pensiero_che_torna` — un proprio scritto vecchio, uno al giorno
-- ============================================================================
-- Il gesto che Readwise ha costruito in grande (la "Daily Review") applicato
-- alla materia che qui è propria: non una citazione di un autore, ma una
-- frase che l'Utente ha scritto lui, mesi o anni fa, e che aprendo la pagina
-- si ritrova davanti senza aver chiesto niente.
--
-- **Nessuna tabella di stato.** La scelta è deterministica sul giorno — hash
-- di `auth.uid()` più la data di Europa centrale, modulo il numero di
-- candidati — quindi resta ferma per ventiquattr'ore da sé. L'alternativa
-- (una riga che registra cosa è già uscito, come fa la ripetizione spaziata
-- vera) andrebbe mantenuta, cancellata insieme all'account, e ricostruita
-- alla revoca del consenso: tre obblighi in cambio di una rotazione un po'
-- meno prevedibile. `p_scarto` copre il caso in cui l'Utente ne chieda un
-- altro senza aspettare domani.
--
-- **Non dipende dal consenso.** È una riga già scritta, ripescata: nessun
-- testo esce verso il fornitore e nessun indice semantico viene letto.
--
-- `p_giorni_minimi` tiene fuori ciò che si è scritto ieri, che non "torna" —
-- lo si ricorda. Se nessuno scritto è abbastanza vecchio (libreria giovane),
-- si pesca fra tutti invece di non mostrare nulla: uno slot vuoto in cima
-- alla pagina è peggio di un pensiero recente.

create function public.pensiero_che_torna(
  p_giorni_minimi integer default 60,
  p_scarto integer default 0
)
returns table (
  tipo_contenuto text,
  contenuto_id uuid,
  testo text,
  spoiler boolean,
  visibilita text,
  data date,
  voce_id uuid,
  libro_id uuid,
  titolo_canonico text,
  autori text[],
  copertina_miniatura_path text,
  copertina_colore_dominante text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with tutti as (
    select s.tipo_contenuto, s.contenuto_id, s.testo, s.spoiler, s.visibilita,
           s.data, s.voce_id
      from public.scritto s
     where s.utente_id = auth.uid()
  ),
  vecchi as (
    select * from tutti
     where data <= (now() at time zone 'Europe/Rome')::date - greatest(p_giorni_minimi, 0)
  ),
  candidati as (
    select * from vecchi
    union all
    select * from tutti where not exists (select 1 from vecchi)
  ),
  numerati as (
    select c.*, row_number() over (order by c.contenuto_id) as rn
      from candidati c
  ),
  scelta as (
    select 1 + (
             (((hashtextextended(
                  auth.uid()::text || (now() at time zone 'Europe/Rome')::date::text, 0
                ) % q.n) + q.n) % q.n)
             + greatest(p_scarto, 0)
           ) % q.n as rn
      from (select count(*) as n from candidati) q
     where q.n > 0
  )
  select
    n.tipo_contenuto,
    n.contenuto_id,
    n.testo,
    n.spoiler,
    n.visibilita,
    n.data,
    n.voce_id,
    v.libro_id,
    l.titolo_canonico,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ),
    l.copertina_miniatura_path,
    l.copertina_colore_dominante
  from numerati n
  join scelta sc on sc.rn = n.rn
  join public.voce_di_libreria v on v.id = n.voce_id
  join public.libro l on l.id = v.libro_id;
$$;

comment on function public.pensiero_che_torna(integer, integer) is
  'Un proprio scritto di almeno `p_giorni_minimi` fa, scelto in modo deterministico sul giorno (hash di auth.uid() più la data di Europa centrale): resta fermo per ventiquattr''ore senza alcuna riga di stato da mantenere e da cancellare insieme all''account. `p_scarto` serve a "mostrane un altro". Non dipende dal consenso — è una riga già scritta, ripescata, e nessun indice semantico viene letto. Se nessuno scritto è abbastanza vecchio si pesca fra tutti: uno slot vuoto in cima alla pagina è peggio di un pensiero recente.';

grant execute on function public.pensiero_che_torna(integer, integer) to authenticated;

-- ============================================================================
-- 5. `vicini_a` — i propri scritti vicini a uno dato
-- ============================================================================
-- La funzione più caratteristica della pagina e la più economica che abbia:
-- **nessuna chiamata al fornitore**. `cerca_semantico` deve prima far
-- calcolare l'embedding della domanda, perché la domanda è appena stata
-- digitata; qui il vettore di partenza è già in `indice_semantico`, scritto
-- quando l'insight è stato salvato. Resta quindi solo il confronto
-- vettoriale, che è locale al database: risposta immediata, costo zero per
-- gesto, e nessun testo che esce di nuovo.
--
-- Dipende comunque dal consenso, ma per una ragione diversa dal costo: alla
-- revoca gli indici vengono cancellati (regola 30), quindi non c'è più nulla
-- da confrontare. È il motivo per cui a consenso spento il piede della carta
-- non porta più "N vicini" invece di portarlo e non rispondere.
--
-- Stessa soglia di distanza di `cerca_semantico` e stessa ragione: senza un
-- tetto, ogni scritto avrebbe sempre i suoi N più vicini, per quanto lontani
-- siano in assoluto — e "vicino" smetterebbe di voler dire qualcosa.
--
-- Lo spoiler non è filtrato, come in `cerca_semantico`: ogni riga è già del
-- richiedente, e la regola 10 protegge da uno spoiler altrui.

create function public.vicini_a(
  p_contenuto_id uuid,
  p_limite integer default 5,
  p_soglia_massima real default 0.65
)
returns table (
  tipo_contenuto text,
  contenuto_id uuid,
  testo text,
  spoiler boolean,
  visibilita text,
  data date,
  voce_id uuid,
  libro_id uuid,
  titolo_canonico text,
  autori text[],
  copertina_miniatura_path text,
  copertina_colore_dominante text,
  distanza real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with origine as (
    select ix.id, ix.embedding
      from public.indice_semantico ix
     where ix.utente_id = auth.uid()
       and (ix.insight_id = p_contenuto_id or ix.recensione_id = p_contenuto_id)
     limit 1
  )
  select
    s.tipo_contenuto,
    s.contenuto_id,
    s.testo,
    s.spoiler,
    s.visibilita,
    s.data,
    s.voce_id,
    v.libro_id,
    l.titolo_canonico,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ),
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    (ix.embedding <=> o.embedding)::real
  from origine o
  join public.indice_semantico ix
    on ix.utente_id = auth.uid()
   and ix.id <> o.id
  join public.scritto s
    on s.tipo_contenuto = ix.tipo_contenuto
   and s.contenuto_id = coalesce(ix.insight_id, ix.recensione_id)
   and s.utente_id = auth.uid()
  join public.voce_di_libreria v on v.id = s.voce_id
  join public.libro l on l.id = v.libro_id
  where (ix.embedding <=> o.embedding) < p_soglia_massima
  order by ix.embedding <=> o.embedding
  limit least(greatest(p_limite, 1), 20);
$$;

comment on function public.vicini_a(uuid, integer, real) is
  'I propri scritti semanticamente più vicini a uno dato (design-frontend.md §22). A differenza di `cerca_semantico` NON chiama il fornitore: il vettore di partenza è già in `indice_semantico`, scritto al salvataggio dell''insight, quindi resta solo il confronto vettoriale locale. Dipende dal consenso solo perché la revoca cancella gli indici (regola 30), non per il costo. Stessa soglia di distanza, stessa ragione: senza tetto ogni scritto avrebbe sempre i suoi N più vicini per quanto lontani. Spoiler non filtrato: ogni riga è già del richiedente.';

grant execute on function public.vicini_a(uuid, integer, real) to authenticated;

-- ============================================================================
-- 6. `cerca_semantico` — i filtri entrano PRIMA del taglio
-- ============================================================================
-- Rifatta invece di affiancata da una variante: una seconda funzione con
-- l'argomento in più avrebbe lasciato in giro due ricerche semantiche
-- leggermente diverse, e la soglia di pertinenza è già una cosa che va
-- rivedibile in un posto solo.
--
-- Cosa cambia, e perché:
--
-- 1. **I filtri.** Quaderni offre le stesse pastiglie gratuite sulla lente
--    "sfoglia" e sui risultati di una domanda, e devono voler dire la stessa
--    cosa nei due posti. Applicarli nel chiamante, dopo che la funzione ha
--    già tagliato ai venti più vicini, darebbe elenchi vuoti ogni volta che i
--    venti più vicini sono tutti dell'anno sbagliato — e un elenco vuoto qui
--    dice "non hai scritto nulla che somigli a questa domanda", che sarebbe
--    falso. Entrano quindi nella WHERE, accanto alla soglia di distanza: si
--    cercano i venti più vicini FRA quelli che passano il filtro.
--
-- 2. **`visibilita`.** Serve al piede della carta, che porta il lucchetto di
--    "solo tuo" accanto a tipo e data (§10: visibilità e spoiler sono segni,
--    non cose da dedurre aprendo qualcosa). Prima usciva solo lo spoiler, e
--    la stessa carta mostrava un segno su due.
--
-- 3. **`vicini`**, dietro `p_con_vicini`: perché una carta dei risultati e
--    una carta della vista sfogliata siano lo stesso oggetto, piede
--    compreso.
--
-- Resta tutto il resto: `security invoker` (regola 24), il filtro esplicito
-- su `auth.uid()` che tiene la ricerca fuori dai contenuti condivisi da un
-- collegato, nessun indice ivfflat/HNSW alla scala del PRD, e lo spoiler non
-- filtrato perché ogni riga è già del richiedente. Il commento originale
-- sulla taratura della soglia (22 agosto 2026, corpus di 6 vettori reali) è
-- riportato qui sotto perché non vada perso con la vecchia definizione.
--
-- p_soglia_massima — perché esiste: senza un tetto sulla distanza, la
-- funzione restituisce sempre i p_limite vettori più vicini, per quanto
-- lontani siano in assoluto. Con una libreria piccola (poche decine di
-- contenuti) questo riempie il risultato di roba non pertinente solo perché
-- non c'è nient'altro da escludere. Misurato empiricamente il 22 agosto 2026
-- su un corpus di 6 vettori reali (text-embedding-3-small): il contenuto
-- pertinente a una domanda sulla religione è arrivato a distanza 0.51, il
-- resto (memoria, città, testimonianza — temi diversi) si è raggruppato fra
-- 0.75 e 0.83. Soglia fissata a metà di quel margine: primo tentativo da
-- tarare con un corpus più grande e query più varie, non un valore
-- definitivo — se in uso reale taglia risultati veri (falsi negativi) o ne
-- lascia passare troppi (falsi positivi), va rivista qui, in un posto solo.

drop function public.cerca_semantico(extensions.vector, integer, real);

create function public.cerca_semantico(
  p_embedding extensions.vector(1536),
  p_limite integer default 20,
  p_soglia_massima real default 0.65,
  p_tipo text default null,
  p_solo_spoiler boolean default false,
  p_anno integer default null,
  p_voce_ids uuid[] default null,
  p_contenuto_ids uuid[] default null,
  p_con_vicini boolean default false
)
returns table (
  tipo_contenuto text,
  contenuto_id uuid,
  testo text,
  spoiler boolean,
  visibilita text,
  data date,
  voce_id uuid,
  libro_id uuid,
  titolo_canonico text,
  autori text[],
  copertina_miniatura_path text,
  copertina_colore_dominante text,
  vicini integer,
  distanza real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with vicini_ordinati as (
    select
      s.tipo_contenuto,
      s.contenuto_id,
      s.testo,
      s.spoiler,
      s.visibilita,
      s.data,
      s.voce_id,
      v.libro_id,
      (ix.embedding <=> p_embedding)::real as distanza
    from public.indice_semantico ix
    join public.scritto s
      on s.tipo_contenuto = ix.tipo_contenuto
     and s.contenuto_id = coalesce(ix.insight_id, ix.recensione_id)
     and s.utente_id = auth.uid()
    join public.voce_di_libreria v on v.id = s.voce_id
    where ix.utente_id = auth.uid()
      and (ix.embedding <=> p_embedding) < p_soglia_massima
      and (p_tipo is null or s.tipo_contenuto = p_tipo)
      and (not p_solo_spoiler or s.spoiler)
      and (p_anno is null or extract(year from s.data)::int = p_anno)
      and (p_voce_ids is null or s.voce_id = any(p_voce_ids))
      and (p_contenuto_ids is null or s.contenuto_id = any(p_contenuto_ids))
    order by ix.embedding <=> p_embedding
    limit least(greatest(p_limite, 1), 50)
  )
  select
    r.tipo_contenuto,
    r.contenuto_id,
    r.testo,
    r.spoiler,
    r.visibilita,
    r.data,
    r.voce_id,
    r.libro_id,
    l.titolo_canonico,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ),
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    coalesce(vic.n, 0),
    r.distanza
  from vicini_ordinati r
  join public.libro l on l.id = r.libro_id
  left join lateral (
    select count(*)::int as n
      from public.indice_semantico ix
      join public.indice_semantico ix2
        on ix2.utente_id = ix.utente_id
       and ix2.id <> ix.id
     where p_con_vicini
       and ix.utente_id = auth.uid()
       and (ix.insight_id = r.contenuto_id or ix.recensione_id = r.contenuto_id)
       and (ix2.embedding <=> ix.embedding) < p_soglia_massima
  ) vic on true
  order by r.distanza;
$$;

comment on function public.cerca_semantico(extensions.vector, integer, real, text, boolean, integer, uuid[], uuid[], boolean) is
  'Ricerca semantica sui propri insight e sulle proprie recensioni (PRD, "funzioni assistite da modello"). `security invoker`, quindi la RLS della regola 24 resta valutata; il filtro esplicito su auth.uid() aggiunge la regola di prodotto per cui la ricerca non attraversa mai i contenuti condivisi da un collegato. Distanza coseno crescente: 0 è identico. p_soglia_massima esclude i risultati troppo lontani per essere pertinenti (0.65, tarata empiricamente, vedi commento sopra la funzione) — senza, un corpus piccolo restituirebbe sempre tutto. I filtri di tipo/spoiler/anno/Voce sono applicati PRIMA del taglio ai p_limite più vicini, mai dopo: a valle darebbero elenchi vuoti che si leggono come "non hai scritto nulla al riguardo". Lo spoiler non è filtrato: ogni riga è già del richiedente, mai di un collegato.';

grant execute on function public.cerca_semantico(extensions.vector, integer, real, text, boolean, integer, uuid[], uuid[], boolean) to authenticated;
