-- ============================================================================
-- Elenco membri per un'istanza che non è più di poche decine di persone.
--
-- Il PRD diceva "Utenti: unità o decine": con quel numero l'elenco membri
-- poteva essere una `select *` ordinata per nome, ed è ciò che era. Aperta
-- l'istanza a un pubblico più largo, quella query diventa tre cose sbagliate
-- insieme — una scansione dell'intera tabella a ogni apertura di pagina, un
-- payload che cresce senza tetto, e un censimento completo dei membri servito
-- a chiunque sia autenticato.
--
-- Questa migrazione non cambia alcuna regola di visibilità: `utente` resta
-- leggibile da tutti gli autenticati (policy `utente_select_autenticati`,
-- migrazione 20260818115830), perché è ciò che l'elenco membri del PRD
-- richiede e la riga contiene solo id e nome utente. Cambia COME si legge:
-- mai tutta, sempre a fette, e la fetta senza ricerca sono gli ultimi
-- arrivati.
-- ============================================================================

-- pg_trgm: accelera sia `ILIKE '%q%'` sia l'operatore di somiglianza. Senza
-- indice trigram una ricerca per sottostringa non è indicizzabile in alcun
-- modo e resta una scansione sequenziale.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_utente_nome_utente_trgm
  on public.utente using gin (nome_utente extensions.gin_trgm_ops);

-- L'elenco senza ricerca mostra i più recenti: senza questo indice
-- l'ordinamento è un sort dell'intera tabella per restituirne venticinque.
create index if not exists idx_utente_creato_at
  on public.utente (creato_at desc);

-- ----------------------------------------------------------------------------
-- Una funzione sola per i due modi dell'elenco: sfogliare e cercare.
--
-- Sono la stessa query con un predicato in più, e tenerle separate avrebbe
-- significato due ordinamenti da mantenere allineati a mano. `p_query` nulla
-- o vuota = sfoglia.
--
-- L'anti-join su `collegamento` sta QUI e non in Python: il servizio già fa
-- un join in memoria fra membri e collegamenti (utenti_service.elenco_membri),
-- ma filtrare a valle romperebbe il tetto — se i venticinque più recenti
-- fossero tutti già collegati, la fetta tornerebbe vuota pur esistendo altri
-- membri. Escludendo prima di applicare il LIMIT, venticinque righe chieste
-- sono venticinque righe utili.
--
-- SECURITY INVOKER (il default, esplicitato perché è una scelta): la funzione
-- non deve mai vedere più di chi la chiama. `search_path` fissato perché una
-- funzione con search_path mutabile è un vettore di dirottamento.
-- ----------------------------------------------------------------------------
create or replace function public.cerca_membri(
  p_self uuid,
  p_query text default null,
  p_limite int default 25,
  p_soglia real default 0.3
)
returns table (id uuid, nome_utente text)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select u.id, u.nome_utente
  from public.utente u
  where u.id <> p_self
    -- Solo chi non ha già una relazione con chi guarda: collegati e
    -- richieste pendenti hanno sezioni proprie, complete e senza tetto,
    -- perché una richiesta nascosta da un LIMIT non si potrebbe più né
    -- accettare né ritirare.
    and not exists (
      select 1
      from public.collegamento c
      where (c.utente_a_id = p_self and c.utente_b_id = u.id)
         or (c.utente_b_id = p_self and c.utente_a_id = u.id)
    )
    and (
      p_query is null
      or p_query = ''
      or u.nome_utente ilike '%' || p_query || '%'
      -- Tolleranza agli errori di battitura. 0.3 è la soglia predefinita di
      -- pg_trgm (`pg_trgm.similarity_threshold`): passata come parametro e
      -- non letta dalla GUC, perché una soglia che dipende dalla
      -- configurazione della sessione non è riproducibile in un test.
      or extensions.similarity(u.nome_utente, p_query) >= p_soglia
    )
  order by
    -- Senza ricerca l'ordine è l'arrivo: gli ultimi iscritti per primi.
    case when p_query is null or p_query = '' then u.creato_at end desc,
    -- Con la ricerca l'ordine è la qualità della corrispondenza. Il nome
    -- utente è un identificatore, non una frase: chi ha digitato il nome
    -- esatto ha ragione, e la somiglianza è solo l'ultima spiaggia.
    case when p_query is null or p_query = '' then null
         else lower(u.nome_utente) = lower(p_query) end desc,
    case when p_query is null or p_query = '' then null
         else u.nome_utente ilike p_query || '%' end desc,
    case when p_query is null or p_query = '' then null
         else u.nome_utente ilike '%' || p_query || '%' end desc,
    case when p_query is null or p_query = '' then null
         else extensions.similarity(u.nome_utente, p_query) end desc,
    u.nome_utente
  -- Tetto invalicabile anche se il chiamante chiede di più: l'elenco membri
  -- non deve poter diventare un censimento in una richiesta sola.
  limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.cerca_membri(uuid, text, int, real) is
  'Una fetta dell''elenco membri per chi guarda (p_self), esclusi se stesso e chiunque abbia già una relazione con lui. Senza p_query restituisce gli ultimi arrivati; con p_query cerca per sottostringa e per somiglianza trigram (soglia p_soglia). Il numero totale dei membri non è mai esposto: non esiste un conteggio in questa API.';

revoke all on function public.cerca_membri(uuid, text, int, real) from public;
grant execute on function public.cerca_membri(uuid, text, int, real) to authenticated;
