-- Montaigne — consenso all'elaborazione assistita e funzioni assistite
-- personali (issue #6)
--
-- Le tabelle di questa issue esistevano già per intero dalla migrazione
-- iniziale (`utente_privato.consenso_elaborazione_assistita`,
-- `artefatto_generato`, `indice_semantico`, RLS comprese): nessun codice
-- applicativo le toccava. Questa migrazione non le crea, aggiunge le tre
-- cose che mancavano per poterle usare davvero, più due strette di
-- privilegi che l'uso reale ha reso evidenti.
--
-- 1. `utente_privato.indici_stato` — lo stato osservabile della
--    ricostruzione degli indici. Il PRD lo esige ("finché non sono pronti
--    la ricerca semantica è incompleta e lo dichiara") e ADR 0016 vieta di
--    leggerlo dalla coda: va sull'entità a cui il lavoro si riferisce.
-- 2. Due tipi di lavoro nuovi, `indicizzazione_semantica` e
--    `ricostruzione_indici`.
-- 3. `cerca_semantico`, la RPC di ricerca vettoriale: `order by <=>` non è
--    esprimibile via PostgREST.
--
-- Strette di privilegi:
-- 4. `utente_privato` concedeva `update` sull'intera tabella, quindi anche
--    su `informativa_accettata_at`, che è la prova di un consenso
--    informato e non deve poter essere riscritta dal client. Grant per
--    colonna, stesso rimedio già applicato a `collegamento` in
--    20260820221500.
-- 5. `artefatto_generato` concedeva `update`, ma un artefatto non si
--    modifica: si genera e si cancella (PRD, "Artefatto generato").

-- ============================================================================
-- 1. utente_privato.indici_stato
-- ============================================================================

alter table public.utente_privato
  add column indici_stato text not null default 'pronti';

alter table public.utente_privato
  add constraint chk_utente_privato_indici_stato
  check (indici_stato in ('pronti', 'spenti', 'in_ricostruzione'));

comment on column public.utente_privato.indici_stato is
  'Stato osservabile degli indici semantici dell''Utente. ''pronti'': la ricerca semantica è completa. ''spenti'': consenso revocato, nessun vettore esiste. ''in_ricostruzione'': consenso appena riattivato, il lavoro in secondo piano sta ricostruendo in blocco e la ricerca deve dichiararsi incompleta invece di restituire risultati parziali senza spiegazione (PRD, caso limite "consenso riattivato dopo una revoca"). Vive qui e non sulla coda dei lavori perché ADR 0016 impone che lo stato mostrato dal prodotto si legga dall''entità, mai dalla riga di lavoro.';

-- Scrivibile dal proprietario per la stessa ragione per cui lo è la DELETE
-- su indice_semantico (commento sopra `create table indice_semantico`): la
-- revoca e la riattivazione nascono da un'azione dell'Utente, e per ADR
-- 0001 quella richiesta va eseguita con la sua identità. Il passaggio a
-- 'pronti' a fine ricostruzione lo scrive invece il worker, sulla
-- connessione diretta.
revoke update on table public.utente_privato from authenticated;
grant update (consenso_elaborazione_assistita, consenso_aggiornato_at, indici_stato)
  on table public.utente_privato to authenticated;

-- ============================================================================
-- 2. artefatto_generato — niente UPDATE
-- ============================================================================
-- Non è un'omissione: un artefatto generato è una fotografia di ciò che il
-- modello ha risposto in un momento preciso. Il PRD gli concede due sole
-- operazioni, esistere e sparire ("cancellabili come gli altri"); un
-- UPDATE permetterebbe di riscriverne il testo lasciandolo etichettato
-- come generato, che è esattamente la confusione che la regola 20 vuole
-- evitare. Rigenerare significa creare una riga nuova.

drop policy artefatto_generato_update_owner on public.artefatto_generato;
revoke update on table public.artefatto_generato from authenticated;

-- ============================================================================
-- 3. Tipi di lavoro
-- ============================================================================

alter table public.lavoro drop constraint chk_lavoro_tipo;
alter table public.lavoro add constraint chk_lavoro_tipo
  check (tipo in ('copertina', 'descrizione', 'arricchimento_bibliografico',
                  'riconduzione_autore', 'deduplicazione_libro',
                  'standardizzazione_descrizione',
                  'indicizzazione_semantica', 'ricostruzione_indici'));

-- ============================================================================
-- 4. cerca_semantico — la ricerca vettoriale sui propri contenuti
-- ============================================================================
-- `security invoker`: la RLS di indice_semantico, insight e recensione
-- resta valutata, come impone la regola 24 del PRD.
--
-- Il filtro `i.utente_id = auth.uid()` è ridondante rispetto alla RLS ed è
-- deliberato: la policy `indice_semantico_select_come_origine` lascia
-- leggere anche i vettori derivati da insight condivisi di un collegato —
-- corretto, perché rispecchia la visibilità della sorgente — ma la ricerca
-- semantica del PRD è un'altra cosa, "sulla propria libreria e sui propri
-- insight, mai sui contenuti condivisi dai collegati: cercare dentro i
-- testi altrui richiederebbe un consenso che nessuno ha prestato". Il
-- restringimento è quindi di prodotto, non di accesso, e sta scritto qui
-- invece che solo nel service — stesso motivo per cui `GET /voci` filtra
-- esplicitamente per utente_id e non si affida alla sola RLS.
--
-- Lo spoiler NON è filtrato qui: la RLS decide SE la riga è visibile, non
-- COME va resa (commento sopra `create table insight`). Nella ricerca
-- semantica il testo resta comunque sempre leggibile, spoiler compreso —
-- ogni riga che arriva qui è già del richiedente (mai di un collegato,
-- per il filtro sopra), e la regola 10 protegge da uno spoiler altrui,
-- non da un proprio testo (issue #6, dopo il primo giro d'uso).
--
-- Nessun indice ivfflat/HNSW sull'embedding: alla scala del PRD (unità o
-- decine di utenti, insight nell'ordine delle decine per libro) ogni
-- interrogazione tocca le poche centinaia di righe di un solo utente dopo
-- il filtro su utente_id, dove la scansione sequenziale batte il salto
-- sull'indice e non richiede manutenzione né spazio sul piano gratuito.
--
-- p_soglia_massima — perché esiste: senza un tetto sulla distanza, la
-- funzione restituisce sempre i p_limite vettori più vicini, per quanto
-- lontani siano in assoluto. Con una libreria piccola (poche decine di
-- contenuti) questo riempie il risultato di roba non pertinente solo
-- perché non c'è nient'altro da escludere. Misurato empiricamente il 22
-- agosto 2026 su un corpus di 6 vettori reali (text-embedding-3-small):
-- il contenuto pertinente a una domanda sulla religione è arrivato a
-- distanza 0.51, il resto (memoria, città, testimonianza — temi diversi)
-- si è raggruppato fra 0.75 e 0.83. Soglia fissata a metà di quel
-- margine: primo tentativo da tarare con un corpus più grande e query
-- più varie, non un valore definitivo — se in uso reale taglia risultati
-- veri (falsi negativi) o ne lascia passare troppi (falsi positivi), va
-- rivista qui, in un posto solo.

create function public.cerca_semantico(
  p_embedding extensions.vector(1536),
  p_limite integer default 20,
  p_soglia_massima real default 0.65
)
returns table (
  tipo_contenuto text,
  contenuto_id uuid,
  testo text,
  spoiler boolean,
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
  select
    ix.tipo_contenuto,
    coalesce(ix.insight_id, ix.recensione_id) as contenuto_id,
    coalesce(i.testo, r.testo) as testo,
    coalesce(i.spoiler, false) as spoiler,
    coalesce(i.data, (r.creato_at at time zone 'Europe/Rome')::date) as data,
    v.id as voce_id,
    l.id as libro_id,
    l.titolo_canonico,
    coalesce(
      (select array_agg(a.nome_canonico order by la.ordine)
         from public.libro_autore la
         join public.autore a on a.id = la.autore_id
        where la.libro_id = l.id),
      array[]::text[]
    ) as autori,
    l.copertina_miniatura_path,
    l.copertina_colore_dominante,
    (ix.embedding <=> p_embedding)::real as distanza
  from public.indice_semantico ix
  left join public.insight i on i.id = ix.insight_id
  left join public.recensione r on r.id = ix.recensione_id
  join public.voce_di_libreria v on v.id = coalesce(i.voce_id, r.voce_id)
  join public.libro l on l.id = v.libro_id
  where ix.utente_id = auth.uid()
    and (ix.embedding <=> p_embedding) < p_soglia_massima
  order by ix.embedding <=> p_embedding
  limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.cerca_semantico(extensions.vector, integer, real) is
  'Ricerca semantica sui propri insight e sulle proprie recensioni (PRD, "funzioni assistite da modello"). `security invoker`, quindi la RLS della regola 24 resta valutata; il filtro esplicito su auth.uid() aggiunge la regola di prodotto per cui la ricerca non attraversa mai i contenuti condivisi da un collegato. Distanza coseno crescente: 0 è identico. p_soglia_massima esclude i risultati troppo lontani per essere pertinenti (0.65, tarata empiricamente, vedi commento sopra la funzione) — senza, un corpus piccolo restituirebbe sempre tutto. Lo spoiler non è filtrato: ogni riga è già del richiedente, mai di un collegato.';

grant execute on function public.cerca_semantico(extensions.vector, integer, real) to authenticated;

-- ============================================================================
-- 5. Il modello di embedding non è più un default provvisorio
-- ============================================================================

comment on column public.indice_semantico.embedding is
  'text-embedding-3-small di OpenAI, 1536 dimensioni (docs/adr/0018). Nella proposta di schema iniziale 1536 era un default ragionevole in attesa di una scelta: la scelta è stata presa con la costruzione dell''issue #6. Cambiare modello significa ALTER COLUMN più una ricostruzione in blocco di tutti gli indici, non una migrazione sola.';
