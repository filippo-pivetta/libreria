-- Montaigne — ciclo di lettura: vincoli tra righe e macchina a stati
--
-- Completa quanto la migrazione 20260818115830_schema_montaigne.sql
-- lascia esplicitamente fuori, con un commento accanto a ciascuna
-- tabella: la monotonia di data/pagina di un Avanzamento e il suo tetto
-- rispetto alle pagine adottate (PRD, regole 14/15), la correzione delle
-- pagine adottate quando esistono già avanzamenti (PRD, caso limite "il
-- totale è un tetto, non un moltiplicatore"), e la macchina a stati di
-- voce_di_libreria.stato con i suoi effetti collaterali su
-- lettura/avanzamento (PRD, entità "Stato di lettura").
--
-- Decisione architetturale (docs/adr/0015): i vincoli su una sola
-- tabella (avanzamento, pagine_adottate) sono trigger — valgono sempre,
-- indipendentemente da chi scrive (backend, Studio, script del
-- Manutentore). La macchina a stati, che tocca più tabelle in un solo
-- gesto (aprire/chiudere/cancellare una Lettura, generare l'avanzamento
-- finale), vive invece in un'unica funzione RPC `security invoker`,
-- `cambia_stato_voce`, sul modello già in uso di `completa_registrazione`
-- (20260819064218): dà atomicità e un canale esplicito per la data
-- scelta dall'Utente, restando comunque soggetta alle stesse RLS di una
-- scrittura diretta. È l'unico canale con cui l'applicazione cambia
-- stato: una scrittura diretta su voce_di_libreria.stato bypassa la
-- matrice di transizione. Trade-off accettato — a differenza delle
-- correzioni di genere, il cambio di stato di lettura non è mai
-- un'operazione fuori banda legittima nel PRD, quindi nessun attore
-- diverso dall'app dovrebbe mai scrivere quella colonna direttamente.
--
-- Codici applicativi: SQLSTATE personalizzati (classe libera, mai
-- assegnata da Postgres), prefisso `MTG`, che PostgREST inoltra intatti
-- nel campo `code` della risposta di errore — lo stesso canale che
-- `me_service` già usa per distinguere `23505` per nome di vincolo. Il
-- service layer Python distingue le regole da questo solo campo, senza
-- fare parsing del messaggio in italiano:
--
--   MTG01 avanzamento_data_futura                    — regola 15
--   MTG02 avanzamento_data_regressiva                 — regola 15
--   MTG03 avanzamento_pagina_regressiva                — "torna indietro, rifiutato"
--   MTG04 avanzamento_pagina_supera_successivo          — correzione oltre il successivo
--   MTG05 avanzamento_data_supera_successivo            — correzione oltre il successivo
--   MTG06 avanzamento_oltre_pagine_adottate             — regola 14
--   MTG07 lettura_chiusura_precede_ultimo_avanzamento    — vincolo sulla Lettura
--   MTG10 transizione_stato_non_ammessa                 — matrice di stato
--   MTG11 pagine_adottate_sotto_avanzamento_esistente     — correzione pagine
--   MTG13 voce_non_trovata                              — ownership/esistenza in cambia_stato_voce

-- ============================================================================
-- avanzamento: monotonia e tetto pagine (regole 14/15)
-- ============================================================================

-- Il trigger sotto usa creato_at come spareggio deterministico fra due
-- avanzamenti con la stessa data. Il default esistente, now(), restituisce
-- l'istante di inizio della TRANSAZIONE, non della singola istruzione: due
-- INSERT nella stessa transazione riceverebbero lo stesso creato_at,
-- rompendo lo spareggio (osservato eseguendo
-- supabase/tests/verifica_ciclo_di_lettura.sql, che inserisce più
-- avanzamenti in un'unica transazione di test). clock_timestamp() legge
-- l'orologio reale ad ogni chiamata, quindi resta distinto anche fra
-- istruzioni della stessa transazione — più corretto anche solo come
-- timestamp di controllo, a prescindere dal suo uso qui.
alter table public.avanzamento
  alter column creato_at set default clock_timestamp();

create index idx_avanzamento_lettura_data
  on public.avanzamento (lettura_id, data desc, creato_at desc);

create function public.avanzamento_valida()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_pagine_adottate integer;
  v_prec record;
  v_succ record;
begin
  if new.data > v_oggi then
    raise exception 'Un avanzamento non può essere datato nel futuro (%).', new.data
      using errcode = 'MTG01';
  end if;

  -- Vicino precedente nella stessa Lettura: il più recente per
  -- (data, creato_at) che precede questa riga. creato_at è già
  -- valorizzato dal default di colonna prima che un trigger BEFORE
  -- giri, quindi è disponibile come spareggio deterministico a parità
  -- di data (due avanzamenti nello stesso giorno restano ammessi,
  -- l'ordine di inserimento decide chi viene "prima").
  select a.pagina, a.data into v_prec
  from public.avanzamento a
  where a.lettura_id = new.lettura_id
    and a.id is distinct from new.id
    and (a.data, a.creato_at) < (new.data, new.creato_at)
  order by a.data desc, a.creato_at desc
  limit 1;

  if found then
    if new.data < v_prec.data then
      raise exception 'La data (%) precede l''avanzamento precedente della stessa Lettura (%).',
        new.data, v_prec.data
        using errcode = 'MTG02';
    end if;
    if new.pagina < v_prec.pagina then
      raise exception 'La pagina (%) è inferiore a quella già raggiunta (%).',
        new.pagina, v_prec.pagina
        using errcode = 'MTG03';
    end if;
  end if;
  -- Se non esiste un precedente (primo avanzamento della Lettura),
  -- nessun vincolo di minimo oltre al CHECK chk_avanzamento_pagina
  -- (pagina >= 0) già esistente: ogni Lettura, anche una rilettura,
  -- riparte da zero (PRD, casi limite).

  -- Vicino successivo: rilevante solo per una correzione (UPDATE), ma
  -- valutato anche in INSERT per coerenza — un client che inserisse un
  -- avanzamento "nel mezzo" della sequenza viene comunque rifiutato.
  select a.pagina, a.data into v_succ
  from public.avanzamento a
  where a.lettura_id = new.lettura_id
    and a.id is distinct from new.id
    and (a.data, a.creato_at) > (new.data, new.creato_at)
  order by a.data asc, a.creato_at asc
  limit 1;

  if found then
    if new.pagina > v_succ.pagina then
      raise exception 'La pagina (%) supera l''avanzamento successivo della stessa Lettura (%).',
        new.pagina, v_succ.pagina
        using errcode = 'MTG04';
    end if;
    if new.data > v_succ.data then
      raise exception 'La data (%) supera l''avanzamento successivo della stessa Lettura (%).',
        new.data, v_succ.data
        using errcode = 'MTG05';
    end if;
  end if;

  -- Tetto pagine (regola 14): solo se la Voce proprietaria ha pagine
  -- adottate. Se sono assenti, nessun tetto — l'avviso di "incremento
  -- fuori scala" senza totale è responsabilità esclusiva del frontend:
  -- il database accetta o rifiuta soltanto, non genera mai un avviso.
  select v.pagine_adottate into v_pagine_adottate
  from public.lettura l
  join public.voce_di_libreria v on v.id = l.voce_id
  where l.id = new.lettura_id;

  if v_pagine_adottate is not null and new.pagina > v_pagine_adottate then
    raise exception 'La pagina (%) supera le pagine adottate per la Voce (%).',
      new.pagina, v_pagine_adottate
      using errcode = 'MTG06';
  end if;

  return new;
end;
$$;

comment on function public.avanzamento_valida() is
  'Monotonia di data/pagina rispetto ai vicini della stessa Lettura (regola 15) e tetto rispetto alle pagine adottate della Voce, quando esistono (regola 14). SQLSTATE personalizzati MTG01-MTG06, vedi il commento in testa al file.';

create trigger trg_avanzamento_valida
  before insert or update on public.avanzamento
  for each row
  execute function public.avanzamento_valida();

-- Al più un avanzamento "generato automaticamente" per Lettura: è quello
-- che il trigger di pagine_adottate e la funzione cambia_stato_voce
-- aggiornano invece di generarne un secondo.
create unique index uq_avanzamento_automatico_per_lettura
  on public.avanzamento (lettura_id)
  where generato_automaticamente;

-- ============================================================================
-- voce_di_libreria.pagine_adottate: tetto e adeguamento dell'avanzamento finale
-- ============================================================================
-- Trigger AFTER, non BEFORE: la funzione inserisce/aggiorna righe di
-- avanzamento che a loro volta rileggono voce_di_libreria.pagine_adottate
-- (trg_avanzamento_valida, tetto pagine). In un trigger BEFORE quella
-- lettura vedrebbe ancora il valore precedente, perché la riga non è
-- stata scritta nella tabella finché il BEFORE non restituisce NEW: il
-- nuovo avanzamento verrebbe validato contro il tetto sbagliato. In AFTER
-- la riga è già scritta nella transazione corrente, quindi le letture
-- annidate vedono il valore corretto. Un'eccezione sollevata qui fa
-- comunque rollback dell'intero UPDATE, come in un trigger BEFORE.

create function public.voce_di_libreria_valida_pagine_adottate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_max_pagina integer;
  v_lettura record;
  v_ultimo record;
begin
  select max(a.pagina) into v_max_pagina
  from public.avanzamento a
  join public.lettura l on l.id = a.lettura_id
  where l.voce_id = new.id;

  if new.pagine_adottate is not null
     and v_max_pagina is not null
     and new.pagine_adottate < v_max_pagina then
    raise exception 'Le pagine adottate (%) sono inferiori a un avanzamento già registrato (%).',
      new.pagine_adottate, v_max_pagina
      using errcode = 'MTG11';
  end if;

  -- L'avanzamento finale automatico "si adegua da solo" alle pagine
  -- adottate corrette, in aumento come in diminuzione (PRD, entità
  -- "Stato di lettura"). Si applica solo se la Voce è già 'letto': se è
  -- 'da leggere' o aperta, non c'è ancora nulla da adeguare (si genera
  -- alla chiusura, dentro cambia_stato_voce).
  if new.stato = 'letto' and new.pagine_adottate is not null then
    select l.id, l.data_fine, l.utente_id into v_lettura
    from public.lettura l
    where l.voce_id = new.id and l.data_fine is not null
    order by l.data_fine desc, l.creato_at desc
    limit 1;

    if found then
      select a.id, a.pagina, a.generato_automaticamente into v_ultimo
      from public.avanzamento a
      where a.lettura_id = v_lettura.id
      order by a.data desc, a.creato_at desc
      limit 1;

      -- "Non lo genera se l'ultimo avanzamento è già a quel valore":
      -- nessun adeguamento se il valore combacia già.
      if not found or v_ultimo.pagina <> new.pagine_adottate then
        if found and v_ultimo.generato_automaticamente then
          update public.avanzamento
            set pagina = new.pagine_adottate
            where id = v_ultimo.id;
        else
          -- L'ultimo avanzamento è un dato dell'Utente (o non esiste
          -- alcun avanzamento): non lo si sovrascrive mai, se ne genera
          -- uno nuovo automatico.
          insert into public.avanzamento
            (lettura_id, utente_id, pagina, data, generato_automaticamente)
          values
            (v_lettura.id, v_lettura.utente_id, new.pagine_adottate, v_lettura.data_fine, true);
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.voce_di_libreria_valida_pagine_adottate() is
  'Rifiuta una correzione di pagine_adottate inferiore a un avanzamento già registrato (MTG11); se la Voce è "letto", adegua o genera l''avanzamento finale automatico. Trigger AFTER, vedi commento sopra sul perché.';

create trigger trg_voce_pagine_adottate
  after update of pagine_adottate on public.voce_di_libreria
  for each row
  when (old.pagine_adottate is distinct from new.pagine_adottate)
  execute function public.voce_di_libreria_valida_pagine_adottate();

-- ============================================================================
-- lettura: ricalcolo dello stato della Voce alla cancellazione
-- ============================================================================
-- "Cancellando una Lettura, la Voce assume lo stato che deriva dalle
-- Letture rimaste: quello dell'ultima chiusa, oppure 'da leggere' se non
-- ne resta nessuna" (PRD). Vale per qualunque Lettura cancellata, aperta
-- o chiusa (DELETE /letture/{id} lato applicazione la espone per
-- entrambe) — non solo per l'annullamento di una Lettura aperta, che
-- passa invece da cambia_stato_voce e forza esplicitamente 'da_leggere'
-- indipendentemente dallo storico: sono due affordance distinte per due
-- intenti distinti, entrambe previste dal PRD. La guardia di sessione
-- sotto evita che questo trigger sovrascriva quella scelta esplicita
-- quando la cancellazione è un effetto collaterale di cambia_stato_voce,
-- non un DELETE diretto.

create function public.lettura_ricalcola_stato_voce()
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

  select data_fine, esito into v_ultima
  from public.lettura
  where voce_id = old.voce_id
  order by coalesce(data_fine, data_inizio) desc, creato_at desc
  limit 1;

  if not found then
    update public.voce_di_libreria set stato = 'da_leggere' where id = old.voce_id;
  elsif v_ultima.data_fine is null then
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

comment on function public.lettura_ricalcola_stato_voce() is
  'AFTER DELETE su lettura: ricalcola voce_di_libreria.stato dalle Letture rimaste. Non gira quando la DELETE è un effetto collaterale di cambia_stato_voce (guardia montaigne.skip_ricalcolo_stato), che ha già deciso lo stato esplicitamente.';

create trigger trg_lettura_ricalcola_stato
  after delete on public.lettura
  for each row
  execute function public.lettura_ricalcola_stato_voce();

-- ============================================================================
-- cambia_stato_voce: macchina a stati (PRD, entità "Stato di lettura")
-- ============================================================================

create function public.cambia_stato_voce(
  p_voce_id uuid,
  p_nuovo_stato text,
  p_data date default null
) returns public.voce_di_libreria
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_voce public.voce_di_libreria;
  v_lettura_aperta public.lettura;
  v_ultimo record;
  v_esito text;
  v_data date;
  v_max_data_avanzamento date;
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
  if not (
    (v_voce.stato = 'da_leggere' and p_nuovo_stato = 'in_lettura')
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

  if p_nuovo_stato = 'in_lettura' and v_voce.stato in ('da_leggere', 'letto', 'abbandonato') then
    -- Prima lettura, o rilettura/ripresa da uno stato chiuso: apre una
    -- Lettura nuova. Non copre in_pausa -> in_lettura, che non apre
    -- nulla perché la Lettura è già aperta.
    insert into public.lettura (voce_id, utente_id, data_inizio)
    values (p_voce_id, auth.uid(), coalesce(p_data, (now() at time zone 'Europe/Rome')::date));

  elsif p_nuovo_stato in ('letto', 'abbandonato') then
    select * into v_lettura_aperta
    from public.lettura
    where voce_id = p_voce_id and data_fine is null
    for update;

    if not found then
      -- Non dovrebbe accadere: la matrice ammette letto/abbandonato
      -- solo da in_lettura/in_pausa, che hanno sempre una Lettura
      -- aperta per costruzione (uq_lettura_una_aperta_per_voce).
      raise exception 'Nessuna Lettura aperta da chiudere per questa Voce.';
    end if;

    v_data := coalesce(p_data, (now() at time zone 'Europe/Rome')::date);

    select max(a.data) into v_max_data_avanzamento
    from public.avanzamento a
    where a.lettura_id = v_lettura_aperta.id;

    -- "La data di fine non può precedere... l'ultimo avanzamento"
    -- (PRD, entità Lettura): non coperto dal CHECK esistente
    -- chk_lettura_date, che verifica solo data_fine >= data_inizio.
    if v_max_data_avanzamento is not null and v_data < v_max_data_avanzamento then
      raise exception 'La data di fine (%) precede l''ultimo avanzamento (%).',
        v_data, v_max_data_avanzamento
        using errcode = 'MTG07';
    end if;

    v_esito := case p_nuovo_stato when 'letto' then 'conclusa' else 'abbandonata' end;

    update public.lettura
      set data_fine = v_data, esito = v_esito
      where id = v_lettura_aperta.id;

    if p_nuovo_stato = 'letto' and v_voce.pagine_adottate is not null then
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
    where voce_id = p_voce_id and data_fine is null
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

comment on function public.cambia_stato_voce(uuid, text, date) is
  'Unico canale applicativo per cambiare voce_di_libreria.stato: valida la matrice di transizione del PRD e ne applica gli effetti collaterali (apri/chiudi/cancella Lettura, genera l''avanzamento finale). Security invoker: soggetta alle stesse RLS di una scrittura diretta, dà solo atomicità e un parametro esplicito per la data scelta dall''Utente. Una scrittura diretta su voce_di_libreria.stato bypassa questa funzione (trade-off accettato, docs/adr/0015).';

grant execute on function public.cambia_stato_voce(uuid, text, date) to authenticated;
