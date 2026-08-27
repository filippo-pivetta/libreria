-- Come va la semina. Query di sola lettura tranne l'ultima, che e'
-- marcata. Si incollano in SQL editor una alla volta.

-- 1. A che punto siamo, e quando finisce.
select
  stato,
  count(*)                                   as lavori,
  min(esegui_dopo) filter (where stato = 'in_attesa') as prossima,
  max(esegui_dopo) filter (where stato = 'in_attesa') as ultima
from public.lavoro
where tipo = 'semina_libro'
group by stato
order by stato;

-- 2. Quante schede ha prodotto davvero.
--    Il numero e' sempre inferiore ai lavori riusciti, e non e' un
--    difetto: un lavoro riesce anche quando Google non ha nulla che regga
--    il confronto con l'autore (app/lavori/semina.py), e riesce senza
--    creare nulla quando l'opera era gia' in catalogo.
select count(*) as libri_in_catalogo from public.libro;

-- 3. Cosa e' fallito, e perche'. Raggruppato: durante una semina i
--    fallimenti arrivano quasi sempre tutti dalla stessa causa (quota
--    esaurita, o Google che risponde 503 a raffiche).
select
  coalesce(errore, '(senza messaggio)') as errore,
  count(*)                              as quanti,
  max(aggiornato_at)                    as ultimo
from public.lavoro
where tipo = 'semina_libro' and stato = 'fallito'
group by 1
order by quanti desc;

-- 4. I lavori figli che la semina ha generato: e' li' che finisce lo
--    spazio delle copertine e la spesa del modello.
select tipo, stato, count(*)
from public.lavoro
where tipo <> 'semina_libro'
group by tipo, stato
order by tipo, stato;

-- 5. SCRITTURA — riaccoda i falliti, scaglionandoli da adesso.
--    Da usare il giorno dopo un esaurimento di quota: i tentativi si
--    consumano in dodici minuti (MAX_TENTATIVI=3 con attese di 30s/120s/
--    600s, app/lavori/worker.py), quindi una quota finita di notte lascia
--    fallite tutte le semine di quella finestra anche se la causa e'
--    passata da un pezzo.
--
--    Cambiare l'intervallo se si cambia il ritmo in accoda_opere.sql.
--
--    La numerazione sta in una sottoquery e non nel `set`: Postgres non
--    ammette funzioni finestra dentro un `update ... set`.
--
-- update public.lavoro l
-- set stato = 'in_attesa',
--     tentativi = 0,
--     errore = null,
--     esegui_dopo = now() + (n.posizione * interval '180 seconds')
-- from (
--   select id, row_number() over (order by id) as posizione
--   from public.lavoro
--   where tipo = 'semina_libro' and stato = 'fallito'
-- ) n
-- where l.id = n.id;

-- 6. Le opere che il catalogo non ha preso.
--    Un lavoro di semina riesce anche quando nessun risultato di Google
--    regge il confronto con l'autore: e' un esito, non un errore
--    (app/lavori/semina.py). Quelle opere sparirebbero in silenzio, e
--    questa e' la query che le fa riemergere — la chiave del lavoro e'
--    l'identificativo d'opera di Open Library, quindi basta cercare quali
--    non sono finiti fra i riferimenti di una scheda.
--
--    Il caso piu' frequente e' il titolo in una terza lingua: la lista
--    porta il titolo canonico di Open Library, che per "L'alchimista" e'
--    "O Alquimista", e Google interrogato con country=IT non li collega.
--    Si risemina a mano cambiando il titolo nel payload.
select
  l.chiave                as ol_work,
  l.payload ->> 'titolo'  as titolo_cercato,
  l.payload ->  'autori'  as autori
from public.lavoro l
where l.tipo = 'semina_libro'
  and l.stato = 'riuscito'
  and not exists (
    select 1 from public.libro_riferimento_esterno r
    where r.fonte = 'open_library' and r.identificativo = l.chiave
  )
order by l.id;
