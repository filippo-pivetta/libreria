-- ============================================================================
-- «I titoli che tornano»: la terza corsia di «Aggiungi un libro» (§13,
-- ridisegno del 25 agosto 2026) — una piccola classifica dei titoli più
-- amati DENTRO l'istanza, per chi apre la pagina senza un titolo in
-- mente e non vuole nemmeno chiederlo a un modello.
--
-- Il PRD ("Non può: vedere libreria, metriche o contenuti di un utente
-- non collegato") governa l'accesso a una libreria, cioè a righe che
-- portano un'identità. Questa funzione non ne restituisce mai una: legge
-- voce_di_libreria di OGNI utente ma emette solo un punteggio per libro,
-- mai un voto, uno stato o un utente_id di riga singola — non si vede
-- nessuna libreria, si vede una classifica calcolata sopra tutte insieme.
-- Per questo è `security definer` (e non invoker, come cerca_libri): deve
-- attraversare righe che la RLS "proprietario o collegato attivo" non
-- concederebbe a chi chiama. `search_path` fissato, come ogni funzione
-- `security definer` di questo schema.
-- ============================================================================

create or replace function public.libri_popolari(
  p_limite integer default 12,
  p_lingua text default 'it'
)
returns table (
  libro_id uuid,
  titolo text,
  autori text[],
  anno_prima_pubblicazione integer,
  copertina_miniatura_path text,
  copertina_colore_dominante text,
  copertina_colore_dominante_scuro text,
  copertina_stato text,
  pagine_mediane_catalogo integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with pesi as (
    -- m: quanti voti "di credito" porta la media generale nello smorzamento
    -- alla Bayes. Con pochi voti un libro resta vicino al centro; solo
    -- accumulandone scavalca la media dell'istanza. Costante scelta a
    -- occhio (nessuna tabella nuova per una configurazione), da rivedere
    -- se la distribuzione reale dei voti la rendesse palesemente sbagliata.
    select 10.0::numeric as m
  ),
  media_istanza as (
    select coalesce(avg(voto), 3.5)::numeric as valore
    from public.voce_di_libreria
    where voto is not null
  ),
  per_libro as (
    select
      v.libro_id,
      count(v.voto) as n_voti,
      avg(v.voto) as media_libro,
      count(*) filter (where v.stato = 'letto') as n_letti,
      count(*) filter (where v.stato = 'abbandonato') as n_abbandonati,
      count(*) as n_librerie
    from public.voce_di_libreria v
    group by v.libro_id
  ),
  punteggi as (
    select
      pl.libro_id,
      -- Voto smorzato: la media del libro pesata sui suoi n voti contro
      -- la media dell'istanza pesata su m. Un titolo con tre voti da 5
      -- non può scavalcare un classico votato da quaranta persone.
      (pl.n_voti * coalesce(pl.media_libro, 0) + pesi.m * media_istanza.valore)
        / (pl.n_voti + pesi.m) as voto_smorzato,
      -- Finitura: la quota di chi lo porta a "letto" invece di lasciarlo
      -- "abbandonato" — il segnale che l'istanza ha e un catalogo esterno
      -- no. Senza traiettorie chiuse (nessuno ancora né finito né
      -- abbandonato) resta neutra: non è un demerito, è un dato assente.
      case when (pl.n_letti + pl.n_abbandonati) = 0 then 0.5
           else pl.n_letti::numeric / (pl.n_letti + pl.n_abbandonati)
      end as finitura,
      -- Diffusione: quante librerie lo contengono, in scala logaritmica —
      -- il decimo lettore conta meno del secondo.
      ln(1 + pl.n_librerie) as diffusione,
      pl.n_librerie
    from per_libro pl, pesi, media_istanza
  ),
  classifica as (
    select
      p.libro_id,
      p.voto_smorzato * (0.5 + 0.5 * p.finitura) * p.diffusione as punteggio,
      -- Mai due titoli dello stesso autore fra i proposti: un solo
      -- rappresentante per autore principale (ordine 0), il migliore.
      -- Un libro senza autore fa gruppo con se stesso.
      row_number() over (
        partition by coalesce(
          (select la.autore_id from public.libro_autore la
            where la.libro_id = p.libro_id
            order by la.ordine
            limit 1),
          p.libro_id
        )
        order by p.voto_smorzato * (0.5 + 0.5 * p.finitura) * p.diffusione desc
      ) as rango_autore
    from punteggi p
    where p.n_librerie > 0
      -- Mai un libro che chi guarda ha già, in qualunque stato: è
      -- l'unico filtro di riga sulla propria identità, e legge solo la
      -- PROPRIA voce_di_libreria — auth.uid() è il chiamante autenticato,
      -- risolto dai claim della richiesta indipendentemente dai
      -- privilegi con cui gira questa funzione.
      and not exists (
        select 1 from public.voce_di_libreria mia
        where mia.libro_id = p.libro_id and mia.utente_id = auth.uid()
      )
  )
  select
    l.id,
    coalesce(vt.titolo, l.titolo_canonico),
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ),
    l.anno_prima_pubblicazione,
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    l.copertina_colore_dominante_scuro,
    l.copertina_stato,
    l.pagine_mediane_catalogo
  from classifica c
  join public.libro l on l.id = c.libro_id
  left join public.variante_titolo vt on vt.libro_id = l.id and vt.lingua = p_lingua
  where c.rango_autore = 1
  order by c.punteggio desc, l.titolo_canonico
  limit least(greatest(p_limite, 1), 24);
$$;

comment on function public.libri_popolari(integer, text) is
  'Classifica dei titoli più amati dell''istanza per «I titoli che tornano» (design-frontend.md §13, ridisegno 25 agosto 2026): voto smorzato alla Bayes (m=10) per non far vincere tre voti da 5 su un classico votato da quaranta persone, pesato sulla quota di chi lo finisce invece di abbandonarlo e sulla diffusione logaritmica fra le librerie. `security definer` perché deve aggregare voce_di_libreria di OGNI utente, cosa che la sua RLS (proprietario o collegato attivo) non concederebbe a security invoker; restituisce solo dato aggregato e di catalogo, mai un voto, uno stato o un utente_id di riga singola — non è una via per vedere una libreria altrui, è un numero calcolato sopra tutte insieme. Un solo titolo per autore principale fra i risultati.';

grant execute on function public.libri_popolari(integer, text) to authenticated;
