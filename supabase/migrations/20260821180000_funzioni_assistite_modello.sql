-- Montaigne — funzioni bibliografiche assistite dal modello (issue #20)
--
-- Chiude l'ultima fetta di #4. Il nucleo (#18), le copertine (#19) e le
-- descrizioni (#21) sono già chiuse; qui arrivano le quattro funzioni
-- assistite dal modello previste dal PRD (classificazione genere, deduzione
-- anno/lingua, riconduzione autori, deduplicazione) e la seconda colonna di
-- colore dominante per la stanza scura (gap emerso chiudendo #19).
--
-- Tre punti che governano ogni scelta qui sotto:
--
-- 1. Le funzioni bibliografiche (genere, anno/lingua, riconduzione autori,
--    deduplicazione) lavorano SOLO su dato di catalogo condiviso — mai su
--    `voce_di_libreria`, `lettura`, `insight`, `recensione` — quindi restano
--    fuori dal consenso dell'Utente (ADR 0008, PRD "funzioni assistite") e
--    rispettano la regola 19 per costruzione dell'accesso ai dati, non per
--    verifica a runtime.
-- 2. La deduplicazione PROPONE soltanto: nessuna fusione automatica di
--    schede Libro, perché un errore lì corromperebbe silenziosamente lo
--    storico di lettura di un Utente sulla scheda "perdente" — l'errore più
--    difficile da scoprire dei due possibili (issue #20). La riconduzione
--    autori invece PUÒ eseguire in automatico quando confidente, perché il
--    suo raggio d'azione resta dentro il catalogo condiviso (autore,
--    autore_nome_variante, libro_autore) e resta reversibile fuori banda
--    tramite `autore_riconduzione`.
-- 3. La fusione vera di due schede Libro resta un'azione del Manutentore
--    fuori dal prodotto (ADR 0007): `fondi_libro` è una funzione Postgres
--    senza alcun grant, invocabile solo da SQL editor/psql con un ruolo
--    privilegiato, mai da un endpoint applicativo.

-- ============================================================================
-- 1. lavoro — tre nuovi tipi
-- ============================================================================
-- Punti 1+2 dell'issue accorpati in un solo tipo: la stessa chiamata al
-- modello risponde con genere, anno e lingua insieme, riusando il contesto
-- (titolo/autori/soggetti) già raccolto in risoluzione.py — dimezza le
-- chiamate rispetto a due lavori separati, e "nessun tetto di spesa
-- impostato nel sistema" (PRD) è un motivo in più per essere parsimoniosi.

alter table public.lavoro drop constraint chk_lavoro_tipo;
alter table public.lavoro add constraint chk_lavoro_tipo
  check (tipo in ('copertina', 'descrizione',
                   'arricchimento_bibliografico', 'riconduzione_autore', 'deduplicazione_libro'));

-- ============================================================================
-- 2. libro — colore dominante della stanza scura
-- ============================================================================
-- docs/design-frontend.md §3: "calcolato per la stanza chiara" /
-- "seconda versione calcolata, più desaturata" per la stanza scura. Una
-- sola colonna esisteva (copertina_colore_dominante, migrazione
-- 20260821120000); questa aggiunge la seconda, calcolata nello stesso
-- lavoro in secondo piano (app/lavori/copertine.py) al momento
-- dell'estrazione, non con una chiamata al modello.

alter table public.libro add column copertina_colore_dominante_scuro text;

alter table public.libro
  add constraint chk_libro_copertina_colore_scuro
    check (copertina_colore_dominante_scuro is null
           or copertina_colore_dominante_scuro ~ '^#[0-9a-f]{6}$'),
  -- Le due colonne nascono e si popolano insieme (stesso lavoro, stessa
  -- estrazione): se una c'è deve esserci anche l'altra. Stesso ruolo di
  -- chk_libro_copertina_coerente per stato/percorso/colore.
  add constraint chk_libro_copertina_colore_scuro_coerente
    check ((copertina_colore_dominante is null) = (copertina_colore_dominante_scuro is null));

comment on column public.libro.copertina_colore_dominante_scuro is
  'Variante desaturata di copertina_colore_dominante per la stanza scura (docs/design-frontend.md §3), calcolata nello stesso lavoro in secondo piano che estrae la prima (app/lavori/copertine.py), mai da una chiamata al modello. Null esattamente quando copertina_colore_dominante lo è (chk_libro_copertina_colore_scuro_coerente).';

-- `cerca_libri` è ricreata più sotto (sezione 6) con la colonna aggiunta
-- all'output: la funzione esistente (20260821120000) va sostituita per
-- intero perché l'elenco delle colonne di ritorno cambia, cosa che
-- `create or replace` non ammette su un `returns table` diverso.

-- ============================================================================
-- 3. autore_riconduzione — traccia della riconduzione assistita
-- ============================================================================
-- Il nucleo riconduce solo per corrispondenza esatta/normalizzata su
-- autore_nome_variante (regola 22bis, catalogo_repository._autore_id).
-- Restano scoperte le forme che nessuna normalizzazione avvicina
-- ("J.R.R. Tolkien" / "John Ronald Reuel Tolkien"): quando il modello è
-- confidente, il lavoro in secondo piano fonde le due identità autore in
-- automatico (a differenza della deduplicazione libri, mai in autonomia:
-- qui il raggio d'azione resta dentro il catalogo condiviso). Questa
-- tabella è l'unica cosa che rende l'operazione ispezionabile e
-- reversibile fuori banda (ADR 0007: nessun meccanismo di rollback
-- applicativo).

create table public.autore_riconduzione (
  id uuid primary key default gen_random_uuid(),
  autore_id_canonico uuid not null references public.autore (id) on delete cascade,
  autore_id_duplicato uuid not null,
  nome_duplicato text not null,
  nome_variante text not null,
  motivo text not null,
  eseguito_at timestamptz not null default now(),
  annullato_at timestamptz
);

comment on table public.autore_riconduzione is
  'Registro delle riconduzioni autore eseguite in automatico dal lavoro in secondo piano "riconduzione_autore" quando il modello è confidente (issue #20, punto 3). L''unica traccia ispezionabile che rende l''operazione reversibile fuori banda: il Manutentore, leggendo questa riga, può ricreare l''autore e ripuntare le righe a mano se la fusione era sbagliata. Infrastruttura di manutenzione, stesso regime RLS di `lavoro`: mai letta dall''app.';

comment on column public.autore_riconduzione.autore_id_duplicato is
  'Non una FK: la riga autore viene cancellata nella stessa transazione che scrive questo log (il lavoro l''ha già fusa nell''autore canonico). L''id resta come riferimento storico per chi rivede l''operazione fuori banda.';

comment on column public.autore_riconduzione.annullato_at is
  'Valorizzato a mano dal Manutentore se disfa l''operazione fuori banda. Nessun meccanismo applicativo lo scrive né lo legge (ADR 0007).';

alter table public.autore_riconduzione enable row level security;
revoke all on table public.autore_riconduzione from anon, authenticated;

-- ============================================================================
-- 4. proposta_fusione_libro — proposte di deduplicazione
-- ============================================================================
-- Quando la catena di risoluzione non trova nulla (né Open Library né
-- Wikidata), la scheda nasce non canonicalizzata. Il lavoro in secondo
-- piano "deduplicazione_libro" confronta con schede esistenti e, se il
-- modello ritiene che sia un duplicato, scrive SOLO una proposta qui — mai
-- una fusione eseguita in autonomia (vincolo assoluto dell'issue #20,
-- punto 4: un merge sbagliato corromperebbe silenziosamente lo storico di
-- lettura di un Utente). Il Manutentore la rivede fuori banda e, se
-- conferma, invoca `fondi_libro` (sezione 7) da SQL editor/psql.

create table public.proposta_fusione_libro (
  id uuid primary key default gen_random_uuid(),
  libro_id_a uuid not null references public.libro (id) on delete cascade,
  libro_id_b uuid not null references public.libro (id) on delete cascade,
  motivo text not null,
  stato text not null default 'in_attesa',
  creato_at timestamptz not null default now(),
  rivisto_at timestamptz,
  -- Ordine canonico della coppia (stesso pattern di
  -- chk_collegamento_ordine, 20260818115830): una coppia produce sempre la
  -- stessa riga indipendentemente da quale dei due libri il lavoro scopra
  -- per primo, e il vincolo unico sotto è davvero simmetrico.
  constraint chk_proposta_fusione_libro_ordine check (libro_id_a < libro_id_b),
  constraint uq_proposta_fusione_libro_coppia unique (libro_id_a, libro_id_b),
  constraint chk_proposta_fusione_libro_stato check (stato in ('in_attesa', 'risolta', 'scartata'))
);

comment on table public.proposta_fusione_libro is
  'Proposte di fusione tra schede Libro duplicate, prodotte dal lavoro in secondo piano "deduplicazione_libro" (issue #20, punto 4). MAI una fusione eseguita: solo una proposta con motivazione, rivista fuori banda dal Manutentore che, se conferma, invoca public.fondi_libro. Infrastruttura di manutenzione, stesso regime RLS di `lavoro`: mai letta dall''app.';

comment on column public.proposta_fusione_libro.stato is
  '''in_attesa'' finché il Manutentore non la rivede fuori banda; ''risolta'' dopo aver invocato fondi_libro; ''scartata'' se il Manutentore giudica che non sia un vero duplicato. Nessun meccanismo applicativo transita questo campo: lo scrive solo il Manutentore, a mano, sulla piattaforma dati.';

alter table public.proposta_fusione_libro enable row level security;
revoke all on table public.proposta_fusione_libro from anon, authenticated;

-- ============================================================================
-- 5. fondi_libro — la fusione vera, fuori banda
-- ============================================================================
-- Estende lo pseudo-SQL lasciato come commento in 20260821120000 (righe
-- 56-67) per gestire i tre vincoli reali che quella nota non copriva:
--
-- 1. uq_libro_riferimento_esterno_principale — se entrambe le schede
--    hanno già un riferimento "principale" per la stessa fonte, quello
--    della duplicata va retrocesso PRIMA di spostarlo.
-- 2. voce_di_libreria_libro_id_fkey (on delete restrict) — le Voci che
--    referenziano la duplicata vanno ripuntate/consolidate PRIMA della
--    `delete from libro`.
-- 3. uq_voce_di_libreria_utente_libro — se lo STESSO Utente ha,
--    indipendentemente, una Voce su entrambe le schede, la politica è
--    quella già scritta nel PRD (caso limite "Fallimenti parziali"):
--    Letture/avanzamenti/insight/note si conservano tutti, voto e
--    recensione più recenti prevalgono (aggiornato_at come proxy — nessun
--    timestamp dedicato esiste su voto/nota_intenzione, e il caso è raro
--    abbastanza da non giustificare una colonna in più solo per questo).
--
-- `security definer` e ZERO grant: invocabile solo da un ruolo
-- privilegiato via SQL editor/psql diretto, mai da un endpoint
-- applicativo (ADR 0007, "l'amministrazione vive fuori dal prodotto").

create or replace function public.fondi_libro(p_sopravvissuta uuid, p_duplicata uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_sopravvissuta = p_duplicata then
    raise exception 'fondi_libro: sopravvissuta e duplicata coincidono (%).', p_sopravvissuta;
  end if;

  -- Vincolo 1: retrocedi i riferimenti "principale" della duplicata per
  -- ogni fonte che la sopravvissuta ha già come principale, PRIMA di
  -- spostarli — altrimenti l'UPDATE sotto violerebbe l'indice unico
  -- parziale (libro_id, fonte) where principale.
  update public.libro_riferimento_esterno
     set principale = false
   where libro_id = p_duplicata and principale
     and fonte in (
       select fonte from public.libro_riferimento_esterno
        where libro_id = p_sopravvissuta and principale
     );

  update public.libro_riferimento_esterno
     set libro_id = p_sopravvissuta
   where libro_id = p_duplicata;

  -- Vincolo 3, caso semplice: un Utente con una Voce SOLO sulla duplicata
  -- si ripunta senza conflitto sulla sopravvissuta.
  update public.voce_di_libreria
     set libro_id = p_sopravvissuta
   where libro_id = p_duplicata
     and utente_id not in (
       select utente_id from public.voce_di_libreria where libro_id = p_sopravvissuta
     );

  -- Vincolo 3, caso B: lo STESSO Utente ha una Voce su entrambe le
  -- schede. Guardia esplicita prima di consolidare: due Letture aperte in
  -- contemporanea sulla stessa Voce sono impedite da
  -- uq_lettura_una_aperta_per_voce, quindi se entrambe le Voci duplicate
  -- hanno una Lettura aperta si preferisce FALLIRE rumorosamente e
  -- lasciare che il Manutentore ne chiuda una fuori banda, piuttosto che
  -- scegliere da soli quale Lettura interrompere.
  if exists (
    select 1
      from public.voce_di_libreria vd
      join public.voce_di_libreria vs
        on vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id
      join public.lettura ld on ld.voce_id = vd.id and ld.data_fine is null
      join public.lettura ls on ls.voce_id = vs.id and ls.data_fine is null
     where vd.libro_id = p_duplicata
  ) then
    raise exception
      'fondi_libro: almeno un Utente ha una Lettura aperta su entrambe le schede (% e %). Chiudere una delle due fuori banda prima di rifondere.',
      p_sopravvissuta, p_duplicata;
  end if;

  -- Voto: colonna diretta su voce_di_libreria, non una tabella a parte
  -- come recensione — va gestito qui esplicitamente, altrimenti la
  -- DELETE finale sulla Voce duplicata perderebbe in silenzio un voto che
  -- la sopravvissuta non aveva ancora. aggiornato_at come proxy di "più
  -- recente" (nessun timestamp dedicato sul voto): vince il voto della
  -- riga aggiornata più di recente, ma solo se non nullo — un "non ancora
  -- votato" più recente non deve cancellare un voto esistente sull'altra
  -- Voce.
  update public.voce_di_libreria vs
     set voto = coalesce(
       case when vd.aggiornato_at > vs.aggiornato_at then vd.voto else vs.voto end,
       case when vd.aggiornato_at > vs.aggiornato_at then vs.voto else vd.voto end
     )
    from public.voce_di_libreria vd
   where vs.libro_id = p_sopravvissuta
     and vd.libro_id = p_duplicata
     and vd.utente_id = vs.utente_id;

  -- Recensione: al più una per Voce (uq_recensione_voce). Se entrambe le
  -- Voci duplicate ne hanno una, prevale la più recente per
  -- aggiornato_at; l'altra si perde (PRD, "Fallimenti parziali").
  delete from public.recensione r
   using public.voce_di_libreria vd, public.voce_di_libreria vs
   where r.voce_id = vd.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id
     and exists (select 1 from public.recensione rs where rs.voce_id = vs.id)
     and r.aggiornato_at <= (select rs.aggiornato_at from public.recensione rs where rs.voce_id = vs.id);

  delete from public.recensione r
   using public.voce_di_libreria vd, public.voce_di_libreria vs
   where r.voce_id = vs.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id
     and exists (select 1 from public.recensione rd where rd.voce_id = vd.id)
     and r.aggiornato_at < (select rd.aggiornato_at from public.recensione rd where rd.voce_id = vd.id);

  -- Repoint di lettura/recensione superstite/artefatto_generato dalla
  -- Voce duplicata a quella sopravvissuta: portano con sé avanzamento e
  -- insight tramite le proprie FK, invariate.
  update public.lettura l
     set voce_id = vs.id
    from public.voce_di_libreria vd, public.voce_di_libreria vs
   where l.voce_id = vd.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id;

  update public.recensione r
     set voce_id = vs.id
    from public.voce_di_libreria vd, public.voce_di_libreria vs
   where r.voce_id = vd.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id;

  update public.artefatto_generato a
     set voce_id = vs.id
    from public.voce_di_libreria vd, public.voce_di_libreria vs
   where a.voce_id = vd.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id;

  -- insight.voce_id ha ON DELETE CASCADE da voce_di_libreria (a
  -- differenza di lettura, il cui id resta stabile qui: solo il suo
  -- voce_id cambia). Senza questo repoint la DELETE finale sulla Voce
  -- duplicata cancellerebbe in silenzio i suoi insight, violando "si
  -- conservano... gli insight" (PRD, "Fallimenti parziali").
  update public.insight i
     set voce_id = vs.id
    from public.voce_di_libreria vd, public.voce_di_libreria vs
   where i.voce_id = vd.id
     and vd.libro_id = p_duplicata
     and vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id;

  -- nota_intenzione: vince quella della sopravvissuta se non vuota,
  -- altrimenti quella della duplicata (nessun timestamp dedicato su cui
  -- basare "più recente", a differenza di recensione.aggiornato_at). Un
  -- UPSERT e non un UPDATE: voce_di_libreria_privata esiste solo per le
  -- Voci su cui qualcuno ha scritto una nota (creata al bisogno, non ad
  -- ogni Voce), quindi se la sopravvissuta non ne ha ancora una un
  -- semplice UPDATE non scriverebbe nulla e la nota della duplicata
  -- andrebbe persa quando la sua riga viene cascata dalla DELETE finale.
  insert into public.voce_di_libreria_privata (voce_id, utente_id, nota_intenzione)
  select vs.id, vs.utente_id, coalesce(ps.nota_intenzione, pd.nota_intenzione)
    from public.voce_di_libreria vd
    join public.voce_di_libreria vs
      on vs.libro_id = p_sopravvissuta and vs.utente_id = vd.utente_id
    left join public.voce_di_libreria_privata ps on ps.voce_id = vs.id
    left join public.voce_di_libreria_privata pd on pd.voce_id = vd.id
   where vd.libro_id = p_duplicata
     and coalesce(ps.nota_intenzione, pd.nota_intenzione) is not null
  on conflict (voce_id) do update set nota_intenzione = excluded.nota_intenzione;

  -- Vincolo 2: voce_di_libreria_libro_id_fkey è ON DELETE RESTRICT. A
  -- questo punto nessuna Voce referenzia più la duplicata (ripuntate sopra
  -- o consolidate), quindi sia questa delete sia quella su libro sotto non
  -- solleveranno.
  delete from public.voce_di_libreria where libro_id = p_duplicata;
  delete from public.libro where id = p_duplicata;
end;
$$;

comment on function public.fondi_libro(uuid, uuid) is
  'Fonde due schede Libro duplicate: sposta i riferimenti esterni, consolida le Voci (compreso il caso in cui lo stesso Utente ne abbia una su entrambe le schede) e cancella la duplicata. Azione del Manutentore fuori dal prodotto (ADR 0007): security definer, ZERO grant, invocabile solo da SQL editor/psql con un ruolo privilegiato. Solleva un''eccezione esplicita, senza scrivere nulla, se lo stesso Utente ha una Lettura aperta su entrambe le schede — quel caso richiede una decisione umana su quale Lettura interrompere.';

revoke all on function public.fondi_libro(uuid, uuid) from public, anon, authenticated;

-- ============================================================================
-- 6. cerca_libri — ricreata con il colore della stanza scura
-- ============================================================================
-- `create or replace` non ammette un `returns table` con un elenco di
-- colonne diverso da quello esistente: la funzione va sostituita per
-- intero. Corpo identico a 20260821120000, con la sola aggiunta di
-- copertina_colore_dominante_scuro nell'elenco di ritorno e nella select.

drop function public.cerca_libri(text, text, integer);

create function public.cerca_libri(
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
    select extensions.unaccent(lower(trim(p_termine))) as t
  ),
  candidati as (
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
    c.rango
  from candidati c
  join public.libro l on l.id = c.libro_id
  left join public.variante_titolo vt on vt.libro_id = l.id and vt.lingua = p_lingua
  left join public.voce_di_libreria v on v.libro_id = l.id and v.utente_id = auth.uid()
  where length((select t from termine)) > 0
  order by c.rango, l.titolo_canonico
  limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.cerca_libri(text, text, integer) is
  'Ricerca sulle schede già nel sistema, per titolo canonico, variante di titolo, nome d''autore o variante di nome. `security invoker`: la RLS di voce_di_libreria resta valutata, quindi il join sulla propria Voce è sicuro per costruzione. Ricreata in 20260821180000 per aggiungere copertina_colore_dominante_scuro all''output (issue #20, punto 5). Nessun indice trigram: alla scala prevista dal PRD (un gruppo chiuso, centinaia di libri) la scansione sequenziale su unaccent+like è più veloce dell''indice e non va mantenuta.';

grant execute on function public.cerca_libri(text, text, integer) to authenticated;
