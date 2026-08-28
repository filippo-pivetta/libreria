-- Montaigne — letture registrate a posteriori: «l'ho già letto»
--
-- Il PRD vietava di passare da "da leggere" direttamente a "letto"
-- ("senza una Lettura aperta non c'è nulla da chiudere"), e la
-- motivazione era di meccanismo, non di prodotto: una Lettura può
-- nascere già chiusa, ed è ciò che serve a chi arriva con una libreria
-- storica da riempire — il caso che il PRD stesso nomina come ragione
-- per cui le date sono scelte dall'Utente ("registrare letture concluse
-- prima di usare l'app"). Finora quel caso costava due passaggi e due
-- date per libro. Ogni app dello stesso genere lo fa in un gesto solo.
--
-- Il problema vero non era la transizione ma le DATE, e la regola di
-- questa migrazione è che l'app non ne inventa nessuna. Chi registra un
-- libro letto anni fa sa una di tre cose, e tutte e tre sono legittime:
--
--   il giorno   -> data_fine, come sempre
--   solo l'anno -> anno_fine, colonna nuova; data_fine resta nulla
--   niente      -> nessuna delle due
--
-- Un 1° gennaio salvato in data_fine con accanto un flag "in realtà è
-- solo l'anno" sarebbe la forma di errore che ADR 0005 rifiuta: la prima
-- query che dimentica il flag mette quarant'anni di letture a Capodanno.
-- Due colonne che si escludono a vicenda non hanno quel problema, e
-- l'anno di chiusura è `coalesce(anno_fine, extract(year from
-- data_fine))` ovunque serva.
--
-- CONSEGUENZA DA CONOSCERE PRIMA DI TOCCARE QUALSIASI QUERY SU `lettura`:
-- «aperta» non è più «senza data di fine». Fino a ieri `data_fine is
-- null` e `esito is null` erano equivalenti per CHECK
-- (chk_lettura_esito_coerente_con_chiusura), e mezzo schema usava il
-- primo per dire il secondo. Ora una Lettura può essere chiusa senza
-- alcuna data, quindi **l'unico predicato valido per "aperta" è `esito
-- is null`**. Sono riemesse qui, per questo solo motivo, anche due
-- funzioni che non c'entrano con la novità (`fondi_libro`, `cerca_libri`):
-- lasciarle com'erano significava, per la prima, rifiutare una fusione
-- credendo aperte due Letture chiuse, e per la seconda mostrare la pagina
-- corrente di una lettura finita.
--
-- Codici applicativi nuovi (classe MTG, vedi 20260820065144):
--   MTG14 anno_fine_non_valido — annata futura o fuori scala

-- ============================================================================
-- 1. lettura: la chiusura può essere meno precisa di un giorno
-- ============================================================================

-- Una Lettura registrata a posteriori non ha una data di inizio: non è
-- un dato mancante da riempire più tardi, è una cosa che chi la registra
-- non sa. Le due metriche che la usano (durata, letture a cavallo
-- d'anno) la trattano come tale e saltano la riga.
alter table public.lettura alter column data_inizio drop not null;

alter table public.lettura add column anno_fine integer;

comment on column public.lettura.anno_fine is
  'Anno di conclusione quando il giorno non si conosce (lettura registrata a posteriori). Si esclude con data_fine: al più una delle due è valorizzata. L''anno di chiusura di una Lettura è sempre coalesce(anno_fine, extract(year from data_fine)).';

comment on column public.lettura.data_inizio is
  'Nulla per le Letture registrate a posteriori, dove il giorno d''inizio non è noto. Mai nulla per una Lettura aperta dall''app con "Inizia a leggere", che ha sempre il giorno scelto dall''Utente.';

alter table public.lettura drop constraint chk_lettura_date;
alter table public.lettura add constraint chk_lettura_date
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio);

-- Sostituisce chk_lettura_esito_coerente_con_chiusura, che dichiarava
-- `(data_fine is null) = (esito is null)`. Ciò che definisce una Lettura
-- chiusa è l'esito; le date della chiusura sono un dettaglio della
-- chiusura, e ora possono mancare entrambe.
alter table public.lettura drop constraint chk_lettura_esito_coerente_con_chiusura;
alter table public.lettura add constraint chk_lettura_aperta_senza_chiusura
  check (esito is not null or (data_fine is null and anno_fine is null));
alter table public.lettura add constraint chk_lettura_una_sola_precisione
  check (data_fine is null or anno_fine is null);

-- L'indice che garantisce al più una Lettura aperta per Voce filtrava su
-- `data_fine is null`: da solo, dopo questa migrazione, conterebbe fra le
-- aperte ogni lettura chiusa senza giorno — e la seconda registrata sulla
-- stessa Voce fallirebbe con una violazione di unicità incomprensibile.
drop index public.uq_lettura_una_aperta_per_voce;
create unique index uq_lettura_una_aperta_per_voce
  on public.lettura (voce_id)
  where esito is null;

-- ============================================================================
-- 2. lettura_ricalcola_stato_voce: stesso predicato, ordinamento allargato
-- ============================================================================
-- Riemessa per due righe: «resta una Lettura aperta» ora si chiede
-- all'esito, e «l'ultima» deve saper ordinare anche una chiusura che
-- porta solo l'annata o nessuna data.

create or replace function public.lettura_ricalcola_stato_voce()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ultima record;
begin
  if current_setting('montaigne.skip_ricalcolo_stato', true) = 'true' then
    return old;
  end if;

  -- make_date(anno, 12, 31) è una chiave di ORDINAMENTO, non un dato: una
  -- lettura del 2019 senza giorno viene dopo una del 2018 con giorno, che
  -- è tutto ciò che serve qui. Non viene salvata da nessuna parte.
  -- `nulls last` tiene in fondo le chiusure senza alcuna data, dove
  -- l'unico ordine possibile è quello di inserimento.
  select esito into v_ultima
  from public.lettura
  where voce_id = old.voce_id
  order by coalesce(data_fine, make_date(anno_fine, 12, 31), data_inizio) desc nulls last,
           creato_at desc
  limit 1;

  if not found then
    update public.voce_di_libreria set stato = 'da_leggere' where id = old.voce_id;
  elsif v_ultima.esito is null then
    -- Resta una Lettura aperta (caso limite): lo stato attuale
    -- (in_lettura/in_pausa) è già corretto, quella distinzione non è
    -- ricostruibile da qui e non va toccata.
    null;
  else
    update public.voce_di_libreria
      set stato = case v_ultima.esito when 'conclusa' then 'letto' else 'abbandonato' end
      where id = old.voce_id;
  end if;

  return old;
end;
$$;

-- ============================================================================
-- 3. cambia_stato_voce: la transizione nuova e la precisione della chiusura
-- ============================================================================
-- Firma nuova, quindi DROP e CREATE: aggiungere parametri con default a
-- una funzione esistente creerebbe un secondo overload e ogni chiamata a
-- tre argomenti diventerebbe ambigua.

drop function public.cambia_stato_voce(uuid, text, date);

create function public.cambia_stato_voce(
  p_voce_id uuid,
  p_nuovo_stato text,
  p_data date default null,
  p_precisione text default 'giorno',
  p_anno_fine integer default null
) returns public.voce_di_libreria
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_voce public.voce_di_libreria;
  v_lettura_aperta public.lettura;
  v_lettura_id uuid;
  v_ultimo record;
  v_esito text;
  v_data date;
  v_anno integer;
  v_max_data_avanzamento date;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into v_voce
  from public.voce_di_libreria
  where id = p_voce_id and utente_id = auth.uid()
  for update;

  if not found then
    raise exception 'Voce non trovata.' using errcode = 'MTG13';
  end if;

  -- Matrice di transizione del PRD, una riga per combinazione ammessa;
  -- ogni coppia (stato attuale, nuovo stato) non elencata qui, incluso
  -- il self-loop, è vietata.
  --
  -- `da_leggere -> letto` è la novità, e apre insieme chiude: è la
  -- lettura registrata a posteriori. Resta vietato `da_leggere ->
  -- abbandonato`: abbandonare un libro mai cominciato non è una cosa
  -- che si annota, e nessuno l'ha mai chiesto.
  if not (
    (v_voce.stato = 'da_leggere' and p_nuovo_stato = 'in_lettura')
    or (v_voce.stato = 'da_leggere' and p_nuovo_stato = 'letto')
    or (v_voce.stato = 'in_lettura' and p_nuovo_stato = 'in_pausa')
    or (v_voce.stato = 'in_pausa' and p_nuovo_stato = 'in_lettura')
    or (v_voce.stato in ('in_lettura', 'in_pausa') and p_nuovo_stato = 'letto')
    or (v_voce.stato in ('in_lettura', 'in_pausa') and p_nuovo_stato = 'abbandonato')
    or (v_voce.stato in ('in_lettura', 'in_pausa') and p_nuovo_stato = 'da_leggere')
    or (v_voce.stato in ('letto', 'abbandonato') and p_nuovo_stato = 'in_lettura')
    or (v_voce.stato in ('letto', 'abbandonato') and p_nuovo_stato = 'da_leggere')
  ) then
    raise exception 'La transizione da % a % non è ammessa.', v_voce.stato, p_nuovo_stato
      using errcode = 'MTG10';
  end if;

  -- La precisione della chiusura. 'giorno' è il default e vale per ogni
  -- chiamata scritta prima di questa migrazione: `p_data` o, se assente,
  -- oggi — il comportamento di sempre, che non cambia di una virgola.
  if p_precisione not in ('giorno', 'anno', 'ignota') then
    raise exception 'Precisione di chiusura sconosciuta: %.', p_precisione
      using errcode = 'MTG14';
  end if;

  if p_precisione = 'anno' then
    v_anno := coalesce(p_anno_fine, extract(year from v_oggi)::integer);
    -- Un anno futuro è rifiutato come lo è una data futura per un
    -- Avanzamento (regola 15), e per la stessa ragione: non è un dato,
    -- è un errore di digitazione che poi conta in una metrica.
    if v_anno > extract(year from v_oggi)::integer or v_anno < 1000 then
      raise exception 'L''anno di conclusione (%) non è un anno valido.', v_anno
        using errcode = 'MTG14';
    end if;
  end if;

  if p_nuovo_stato = 'in_lettura' and v_voce.stato in ('da_leggere', 'letto', 'abbandonato') then
    -- Prima lettura, o rilettura/ripresa da uno stato chiuso: apre una
    -- Lettura nuova. Non copre in_pausa -> in_lettura, che non apre
    -- nulla perché la Lettura è già aperta.
    insert into public.lettura (voce_id, utente_id, data_inizio)
    values (p_voce_id, auth.uid(), coalesce(p_data, v_oggi));

  elsif v_voce.stato = 'da_leggere' and p_nuovo_stato = 'letto' then
    -- La lettura registrata a posteriori: nasce già chiusa. `data_inizio`
    -- resta NULLA, e non è una scorciatoia — chi segna oggi un libro
    -- letto nel 2019 non sa quando l'ha cominciato, e un inizio dedotto
    -- (il giorno della fine, l'inserimento) sarebbe un dato inventato
    -- dall'app che poi finisce nella durata media delle letture.
    insert into public.lettura (voce_id, utente_id, data_inizio, data_fine, anno_fine, esito)
    values (
      p_voce_id,
      auth.uid(),
      null,
      case p_precisione when 'giorno' then coalesce(p_data, v_oggi) else null end,
      case p_precisione when 'anno' then v_anno else null end,
      'conclusa'
    )
    returning id into v_lettura_id;

    -- L'avanzamento finale automatico si genera SOLO quando c'è un
    -- giorno a cui datarlo: un Avanzamento senza data non esiste nello
    -- schema, e inventargliene una rimetterebbe dalla finestra il dato
    -- falso che questa migrazione tiene fuori dalla porta. Le pagine di
    -- una lettura senza giorno entrano lo stesso nel totale dell'anno,
    -- ma le mette il calcolo delle metriche leggendo le pagine adottate,
    -- non una riga scritta qui (app/services/metriche_service.py).
    if p_precisione = 'giorno' and v_voce.pagine_adottate is not null then
      insert into public.avanzamento
        (lettura_id, utente_id, pagina, data, generato_automaticamente)
      values
        (v_lettura_id, auth.uid(), v_voce.pagine_adottate, coalesce(p_data, v_oggi), true);
    end if;

  elsif p_nuovo_stato in ('letto', 'abbandonato') then
    select * into v_lettura_aperta
    from public.lettura
    where voce_id = p_voce_id and esito is null
    for update;

    if not found then
      -- Non dovrebbe accadere: la matrice ammette letto/abbandonato
      -- solo da in_lettura/in_pausa, che hanno sempre una Lettura
      -- aperta per costruzione (uq_lettura_una_aperta_per_voce).
      raise exception 'Nessuna Lettura aperta da chiudere per questa Voce.';
    end if;

    v_data := case p_precisione when 'giorno' then coalesce(p_data, v_oggi) else null end;

    select max(a.data) into v_max_data_avanzamento
    from public.avanzamento a
    where a.lettura_id = v_lettura_aperta.id;

    -- "La data di fine non può precedere... l'ultimo avanzamento"
    -- (PRD, entità Lettura): non coperto dal CHECK esistente
    -- chk_lettura_date, che verifica solo data_fine >= data_inizio.
    if v_data is not null
       and v_max_data_avanzamento is not null
       and v_data < v_max_data_avanzamento then
      raise exception 'La data di fine (%) precede l''ultimo avanzamento (%).',
        v_data, v_max_data_avanzamento
        using errcode = 'MTG07';
    end if;

    v_esito := case p_nuovo_stato when 'letto' then 'conclusa' else 'abbandonata' end;

    update public.lettura
      set data_fine = v_data,
          anno_fine = case p_precisione when 'anno' then v_anno else null end,
          esito = v_esito
      where id = v_lettura_aperta.id;

    if p_nuovo_stato = 'letto' and v_data is not null and v_voce.pagine_adottate is not null then
      select a.id, a.pagina into v_ultimo
      from public.avanzamento a
      where a.lettura_id = v_lettura_aperta.id
      order by a.data desc, a.creato_at desc
      limit 1;

      -- "Non lo genera se l'ultimo avanzamento è già a quel valore, né
      -- se la Voce non ha pagine adottate" (già garantito dal WHEN sopra).
      if not found or v_ultimo.pagina <> v_voce.pagine_adottate then
        insert into public.avanzamento
          (lettura_id, utente_id, pagina, data, generato_automaticamente)
        values
          (v_lettura_aperta.id, auth.uid(), v_voce.pagine_adottate, v_data, true);
      end if;
    end if;

  elsif p_nuovo_stato = 'da_leggere' and v_voce.stato in ('in_lettura', 'in_pausa') then
    select * into v_lettura_aperta
    from public.lettura
    where voce_id = p_voce_id and esito is null
    for update;

    if not found then
      raise exception 'Nessuna Lettura aperta da annullare per questa Voce.';
    end if;

    -- Annulla la Lettura aperta e i suoi avanzamenti (cascata via FK
    -- fk_avanzamento_lettura_utente): è l'unico modo per disfare una
    -- Lettura aperta per errore (PRD). La guardia evita che
    -- trg_lettura_ricalcola_stato sovrascriva 'da_leggere', che qui è
    -- una scelta esplicita del chiamante, non da ricalcolare dallo
    -- storico rimasto.
    perform set_config('montaigne.skip_ricalcolo_stato', 'true', true);
    delete from public.lettura where id = v_lettura_aperta.id;
    perform set_config('montaigne.skip_ricalcolo_stato', 'false', true);
  end if;
  -- Nessun effetto collaterale per le altre transizioni ammesse:
  -- letto/abbandonato -> da_leggere (rimette in coda senza aprire né
  -- chiudere nulla), in_lettura <-> in_pausa (la Lettura resta la stessa).

  update public.voce_di_libreria
    set stato = p_nuovo_stato
    where id = p_voce_id
    returning * into v_voce;

  return v_voce;
end;
$$;

comment on function public.cambia_stato_voce(uuid, text, date, text, integer) is
  'Macchina a stati della Voce (PRD, entità "Stato di lettura"), unico canale con cui l''app scrive voce_di_libreria.stato. p_precisione dice quanto si sa della chiusura: ''giorno'' (default, il comportamento di sempre: p_data o oggi), ''anno'' (solo l''annata, in p_anno_fine), ''ignota'' (nessuna data). La transizione da_leggere -> letto registra una lettura passata: nasce chiusa, senza data di inizio, e genera l''avanzamento finale automatico solo se ha un giorno a cui datarlo.';

revoke all on function public.cambia_stato_voce(uuid, text, date, text, integer) from public, anon;
grant execute on function public.cambia_stato_voce(uuid, text, date, text, integer) to authenticated;

-- ============================================================================
-- 4. Le due funzioni che dicevano "aperta" con il predicato sbagliato
-- ============================================================================
-- Riemesse per intero perché è così che si cambia una funzione qui (una
-- migrazione per file, nessun ORM): il corpo è identico a quello della
-- migrazione che le ha introdotte, salvo il predicato.

-- fondi_libro (20260821180000): due join che credevano aperta ogni
-- Lettura senza data di fine, e avrebbero rifiutato una fusione
-- legittima fra due Voci con letture registrate a posteriori.
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
      join public.lettura ld on ld.voce_id = vd.id and ld.esito is null
      join public.lettura ls on ls.voce_id = vs.id and ls.esito is null
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

-- cerca_libri (20260827100000): la pagina corrente veniva presa anche da
-- una lettura conclusa senza giorno, e l'anno dell'ultima lettura non
-- vedeva affatto le chiusure con la sola annata.

drop function public.cerca_libri(text, text, integer, real);

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
      where le.voce_id = v.id and le.esito is null) as voce_pagina_corrente,
    -- L'anno di chiusura può venire da una data piena o dalla sola
    -- annata di una lettura registrata a posteriori: `coalesce` le mette
    -- sullo stesso piano, e `max` ignora da sé le Letture ancora aperte,
    -- che non hanno né l'una né l'altra.
    (select max(coalesce(le.anno_fine, extract(year from le.data_fine)::integer))
       from public.lettura le
      where le.voce_id = v.id) as voce_anno_ultima_lettura,
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
