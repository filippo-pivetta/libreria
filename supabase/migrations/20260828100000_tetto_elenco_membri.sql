-- ----------------------------------------------------------------------------
-- Il tetto di `cerca_membri` sale da 50 a 500 righe.
--
-- Nulla cambia nella query: stesso corpo, stesso ordinamento, stesso
-- anti-join, stessa tolleranza ai refusi. Cambiano il default di `p_limite`
-- (da 25 a 200) e il tetto invalicabile (da 50 a 500).
--
-- **Perché.** Il 24 agosto 2026 il PRD aveva alzato la scala attesa a
-- migliaia di membri, e 50 era il tetto giusto per un'anagrafica pubblica:
-- una fetta, mai il censimento. Il 28 agosto quella decisione è stata
-- ribaltata — l'istanza torna a essere a cerchia ristretta, su invito,
-- decine di persone — e con lei la ragione del tetto stretto: cinquanta
-- righe non erano una fetta di un elenco infinito, erano tutti.
--
-- **Perché è un difetto e non solo una preferenza.** Da questa migrazione
-- il servizio chiede una riga IN PIÙ del proprio tetto (201) e deduce dal
-- numero di righe tornate se l'elenco è completo: se lo è, il frontend
-- cerca fra i nomi che ha già in pagina invece di interrogare il server a
-- ogni battuta. Con il tetto a 50, una richiesta di 201 righe ne avrebbe
-- ricevute 50 anche a fronte di 60 membri, e 50 <= 200 si sarebbe letto
-- come "ci sono tutti": dieci persone sparite dalla ricerca, in silenzio.
-- Un tetto più basso della richiesta non limita, falsifica.
--
-- 500 e non "nessun tetto": il tetto non è più difesa dall'enumerazione
-- (fra amici non c'è nulla da enumerare), è difesa dalla risposta enorme.
-- Cinquecento righe di id e nome sono una manciata di chilobyte, e restano
-- il punto in cui, se un giorno l'istanza tornasse ad aprirsi, il servizio
-- smette da solo di dichiarare l'elenco completo invece di mandare tutto.
--
-- Il numero totale dei membri continua a non essere esposto da nessuna
-- parte: non esiste un conteggio in questa API, e la riga sentinella dice
-- soltanto "ce n'erano altri", mai quanti.
-- ----------------------------------------------------------------------------

create or replace function public.cerca_membri(
  p_self uuid,
  p_query text default null,
  p_limite int default 200,
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
  -- Tetto invalicabile anche se il chiamante chiede di più. Era 50, e
  -- reggeva finché l'applicazione ne chiedeva 25; ora ne chiede 201, e un
  -- tetto più basso della richiesta è peggio di un tetto basso — è un
  -- tetto che MENTE, perché il servizio deduce dal numero di righe se
  -- l'elenco è completo (utenti_service.elenco_membri) e con 60 membri
  -- avrebbe visto tornare 50 righe da una richiesta di 201, cioè "ci sono
  -- tutti", nascondendone dieci senza dirlo.
  limit least(greatest(p_limite, 1), 500);
$$;

comment on function public.cerca_membri(uuid, text, int, real) is
  'Una fetta dell''elenco membri per chi guarda (p_self), esclusi se stesso e chiunque abbia già una relazione con lui. Senza p_query restituisce gli ultimi arrivati; con p_query cerca per sottostringa e per somiglianza trigram (soglia p_soglia). Tetto invalicabile a 500 righe. Il numero totale dei membri non è mai esposto: non esiste un conteggio in questa API.';

revoke all on function public.cerca_membri(uuid, text, int, real) from public;
grant execute on function public.cerca_membri(uuid, text, int, real) to authenticated;
