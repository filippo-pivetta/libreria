-- Semina del catalogo: un tipo di lavoro nuovo, `semina_libro`.
--
-- Fa nascere una scheda che nessun Utente ha ancora chiesto, partendo da
-- un titolo e un autore. Serve a non consegnare agli Utenti un catalogo
-- locale vuoto, in cui ogni ricerca ricade sui risultati esterni e ogni
-- aggiunta paga la catena di risoluzione da capo (oltre dieci secondi,
-- misurati).
--
-- Non e' una via d'ingresso nuova per i libri: il gestore
-- (`app/lavori/semina.py`) percorre esattamente la stessa catena di
-- `POST /libri` e chiama la stessa `ricerca_service.assicura_scheda`.
-- Una scheda seminata e una scheda nata da un'aggiunta sono
-- indistinguibili, e devono restarlo — nessuna colonna le separa,
-- deliberatamente: se lo fossero, ADR 0002 avrebbe due identita' invece
-- di una.
--
-- L'unica cosa che il lavoro NON fa e' creare una Voce: il catalogo e'
-- dato condiviso, la Voce e' di un Utente (ADR 0001), e seminare non
-- mette un libro nella libreria di nessuno.
--
-- Il ritmo non e' nel codice ma nel dato: chi accoda scagliona
-- `esegui_dopo` (vedi supabase/manutenzione/semina/), perche' il vincolo
-- vero e' la quota giornaliera di Google Books e non la capacita' della
-- coda. Un worker che smaltisse mille semine in un'ora esaurirebbe la
-- quota e farebbe fallire anche le aggiunte degli Utenti, che passano
-- dalla stessa chiave.

alter table public.lavoro drop constraint chk_lavoro_tipo;
alter table public.lavoro add constraint chk_lavoro_tipo
  check (tipo in ('copertina', 'descrizione', 'arricchimento_bibliografico',
                   'riconduzione_autore', 'deduplicazione_libro', 'standardizzazione_descrizione',
                   'indicizzazione_semantica', 'ricostruzione_indici', 'traduzione_descrizione',
                   'semina_libro'));
