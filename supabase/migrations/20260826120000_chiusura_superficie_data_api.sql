-- Chiusura della superficie raggiungibile direttamente dalla Data API.
--
-- L'ADR 0001 mette la RLS come unica garanzia di accesso, e l'ADR 0006
-- vuole che "nessun contenuto, nessuna metrica e nessun file conservato dal
-- sistema" sia raggiungibile senza autenticazione. Il back end rispetta
-- entrambe le cose, ma il back end non e' l'unico modo di parlare col
-- database: la chiave anonima vive nel bundle del browser (le serve per
-- l'autenticazione) e con quella chiunque puo' interrogare PostgREST
-- direttamente. Tre buchi sono stati verificati contro l'istanza locale.

-- 1. `libri_popolari` era eseguibile da `anon`.
--
-- Postgres concede EXECUTE a PUBLIC su ogni funzione appena creata, e
-- PUBLIC include `anon`. Su una funzione `security definer` — che per
-- definizione non valuta la RLS — questo significa che una POST a
-- /rest/v1/rpc/libri_popolari con la sola chiave anonima, senza alcun
-- login, restituiva la classifica dei titoli piu' presenti nelle librerie
-- dei membri: dato di lettura aggregato, che la regola 6 del PRD vuole
-- inaccessibile senza autenticazione. `auth.uid()` e' NULL per `anon`,
-- quindi il filtro "escludi i libri che ho gia'" non escludeva nulla e la
-- classifica usciva intera.
--
-- Il resto dello schema fa gia' la cosa giusta (`fondi_libro` in
-- 20260821180000, `cerca_membri` in 20260824120000): qui la revoca era
-- semplicemente stata dimenticata. La applichiamo a tutte le RPC, non solo
-- alla colpevole, cosi' che il default di Postgres non torni a decidere
-- per noi alla prossima funzione. Ogni revoca e' seguita dal grant
-- esplicito a `authenticated`, perche' per alcune di queste funzioni
-- l'unico privilegio in essere arrivava proprio da PUBLIC.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end;
$$;

-- 2. `informativa_accettata_at` era riscrivibile con DELETE + INSERT.
--
-- La migrazione 20260822090000 toglie UPDATE sulla tabella e lo ridà per
-- colonna sulle tre che l'Utente puo' davvero cambiare, lasciando fuori
-- `informativa_accettata_at` perche' — dice il commento in
-- utente_repository — "e' la prova di un consenso informato e non si
-- riscrive". Ma INSERT e DELETE restavano concessi sull'intera riga con
-- policy owner-only che li ammettono entrambi: cancellare la propria riga
-- e reinserirla con una data inventata aggirava la protezione per colonna
-- in due chiamate. Verificato: DELETE 204, INSERT 201, data riscritta.
--
-- Due mosse, perche' nessuna delle due basta da sola. Prima si toglie il
-- DELETE: la riga nasce con la registrazione e muore con la cascata di
-- `utente`, non c'e' motivo per cui il client la cancelli da se'. La
-- cascata continua a funzionare — le azioni di integrita' referenziale non
-- passano dai privilegi del chiamante — quindi la cancellazione
-- dell'account (issue #8) resta intatta.
revoke delete on table public.utente_privato from authenticated;

-- Poi si restringe l'INSERT alle due colonne che `completa_registrazione`
-- scrive davvero: le altre hanno un default e non devono arrivare dal
-- client. La funzione e' `security invoker`, quindi continua a passare da
-- qui e ha bisogno che il grant resti.
revoke insert on table public.utente_privato from authenticated;
grant insert (utente_id, informativa_accettata_at) on table public.utente_privato to authenticated;

-- E infine si toglie di mezzo il valore: anche potendo inserire la
-- colonna, il momento dell'accettazione lo decide il database. Cosi' la
-- prova non e' falsificabile nemmeno sull'unico percorso di scrittura
-- rimasto, e `completa_registrazione` (che gia' passa `now()`) non cambia
-- di una riga.
create function public.utente_privato_informativa_non_falsificabile()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.informativa_accettata_at := now();
  return new;
end;
$$;

comment on function public.utente_privato_informativa_non_falsificabile() is
  'Fissa informativa_accettata_at all''istante dell''inserimento, ignorando il valore proposto dal client: la colonna e'' la prova di un consenso informato e il suo momento lo decide il database, non chi lo dichiara.';

create trigger trg_utente_privato_informativa_non_falsificabile
  before insert on public.utente_privato
  for each row
  execute function public.utente_privato_informativa_non_falsificabile();

-- 3. `utente`: UPDATE era concesso sull'intera riga.
--
-- Il PRD dichiara `nome_utente` non modificabile dall'Utente, e il
-- commento in 20260818115830 ammette che lo schema non lo impone: la
-- policy utente_update_owner autorizza il proprietario e il grant copre
-- ogni colonna, quindi una PATCH diretta su /rest/v1/utente cambiava il
-- nome mostrato nell'elenco membri — l'unico ancoraggio d'identita' su cui
-- si accettano i collegamenti — anche dopo che un collegamento era stato
-- accettato. Con lo stesso gesto si riscriveva `creato_at`, che ordina
-- "gli ultimi arrivati" di `cerca_membri`. Verificato: PATCH 200, nome e
-- data sostituiti.
--
-- Nessun percorso applicativo aggiorna questa tabella: il back end fa
-- select, la delete della cancellazione account, e l'insert attraverso
-- `completa_registrazione`. La policy resta al suo posto — se un giorno
-- servira' un rename, bastera' riconcedere la singola colonna.
revoke update on table public.utente from authenticated;

-- Stessa disciplina sull'INSERT: `completa_registrazione` scrive id e
-- nome_utente, `creato_at` ha un default ed e' il database a doverlo
-- fissare.
revoke insert on table public.utente from authenticated;
grant insert (id, nome_utente) on table public.utente to authenticated;
