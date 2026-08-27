-- I privilegi di `public` smettono di essere impliciti.
--
-- Il job `supabase` della CI ha iniziato a fallire su un database pulito
-- mentre in locale le sei verifiche passavano tutte. La differenza non era
-- nello schema, ed è per questo che è rimasta invisibile a lungo: era in
-- chi decideva i privilegi al posto nostro.
--
-- `supabase start` guarda `api.auto_expose_new_tables` per sapere se
-- tabelle, viste, sequenze e funzioni nuove di `public` debbano essere
-- raggiungibili dai ruoli della Data API (`anon`, `authenticated`,
-- `service_role`) senza GRANT espliciti. Fino alla CLI 2.115 il default era
-- `false`; dalla 2.116 è `true`, per allinearsi al comportamento della
-- piattaforma hosted (supabase/cli#6337). Un portatile fermo alla 2.114 e
-- una CI su `version: latest` costruivano quindi due database diversi dalle
-- stesse identiche migrazioni.
--
-- Lo schema non ha mai detto quale dei due volesse: si è appoggiato in
-- silenzio al default della CLI di turno. I `grant` sparsi nelle migrazioni
-- (`grant select on table public.libro to authenticated`, ...) descrivono
-- l'intenzione giusta, ma sono additivi: non tolgono nulla, quindi dove
-- l'auto-esposizione era attiva si sommavano al regalo invece di
-- sostituirlo. Su un database così:
--
--   * il catalogo, che i commenti e le verifiche dichiarano in sola
--     lettura, era scrivibile da `authenticated`
--     (verifica_catalogo_e_copertine, punto 10);
--   * `anon` arrivava alle tabelle e alla vista `scritto` invece di
--     fermarsi sul privilegio (verifica_quaderni, punto 13);
--   * `service_role` aveva i privilegi che tre docstring del back end
--     dichiarano inesistenti (catalogo_repository, indicizzazione_
--     repository, core/supabase.py::get_service_client).
--
-- Nessun dato è mai uscito: la RLS ha retto (verificato su un database
-- auto-esposto col seed applicato, un anonimo legge zero righe da ogni
-- tabella di `public`), e la chiave anonima parla PostgREST, non SQL. A
-- mancare era la difesa esterna delle due — quella che le verifiche
-- asseriscono per prima proprio perché, senza il grant, non esiste policy
-- da aggirare.
--
-- Il rimedio è in due punti, e servono entrambi. `supabase/config.toml`
-- fissa `auto_expose_new_tables = false`, così locale e CI ricostruiscono
-- lo stesso database qualunque CLI abbiano; ma quella riga governa lo
-- stack locale, non il progetto hosted, dove l'auto-esposizione è il
-- comportamento di piattaforma a cui la 2.116 si è allineata. Questa
-- migrazione scrive la stessa cosa dentro lo schema, che è l'unica sede che
-- vale ovunque: da qui in poi i privilegi di `public` sono quelli che le
-- migrazioni concedono, e nessun altro.

-- ---------------------------------------------------------------------------
-- 1. Gli oggetti futuri.
--
-- Senza questo, la prossima tabella creata da una migrazione rinasce con
-- i privilegi dell'immagine e il problema torna identico. `for role
-- postgres` perché è il ruolo che applica le migrazioni e che possiede
-- ogni tabella di `public`; `on tables` in Postgres copre anche le viste.
--
-- Le funzioni restano fuori di proposito: la migrazione 20260826120000 le
-- ha già normalizzate una per una, escludendo con cura quelle di trigger,
-- e `verifica_superficie_data_api` (punto 1) fallisce in CI se una
-- funzione nuova risulta eseguibile da `anon`. Un `alter default
-- privileges` sulle funzioni non saprebbe fare quella distinzione.
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Gli oggetti che già esistono.
--
-- `anon` e `service_role` non devono raggiungere niente di `public`:
-- l'ADR 0006 vuole che nulla sia leggibile senza autenticazione, e il back
-- end non usa la chiave di servizio per parlare a queste tabelle — scrive
-- su connessione diretta come `postgres` (docs/adr/0016). La sequenza è
-- quella di `lavoro`, tabella già revocata a entrambi nella 20260821120000:
-- lasciarne aperta la sequenza era la stessa svista, un livello sotto.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;

-- `authenticated` invece serve, ma solo dove una migrazione l'ha detto.
-- Si azzera e si riscrive per intero: è l'unico modo di separare i grant
-- voluti da quelli dell'immagine, che nell'ACL sono indistinguibili.
--
-- `revoke ... on all tables` porta via anche i grant per colonna, non solo
-- quelli di riga — verificato, `pg_attribute.attacl` resta vuoto dopo. Vanno
-- quindi riscritti anche quelli, in fondo: sono la parte più delicata della
-- superficie e un revoke silenzioso li avrebbe portati via insieme al resto.
revoke all on all tables in schema public from authenticated;

-- Sola lettura: il catalogo bibliografico, che è dato condiviso senza
-- proprietario e si scrive solo dal back end (20260818115830,
-- 20260821120000).
grant select on table public.autore                    to authenticated;
grant select on table public.autore_nome_variante      to authenticated;
grant select on table public.genere                    to authenticated;
grant select on table public.genere_etichetta          to authenticated;
grant select on table public.libro                     to authenticated;
grant select on table public.libro_autore              to authenticated;
grant select on table public.libro_genere              to authenticated;
grant select on table public.libro_descrizione         to authenticated;
grant select on table public.libro_riferimento_esterno to authenticated;
grant select on table public.variante_titolo           to authenticated;

-- Sola lettura anche la vista dei Quaderni (`security_invoker`: la RLS
-- delle tabelle sotto vale come se le si interrogasse direttamente) e la
-- riga privata dell'Utente, che si modifica per colonna e non per riga.
grant select on public.scritto                to authenticated;
grant select on table public.utente_privato   to authenticated;

-- L'identità: si legge e, cancellando l'account, si cancella. Non si
-- riscrive — l'INSERT è per colonna dalla 20260826120000, l'UPDATE è tolto.
grant select, delete on table public.utente to authenticated;

-- Gli indici semantici si cancellano revocando il consenso, ma nascono dai
-- lavori in secondo piano su connessione diretta: nessun INSERT dal client
-- (20260818115830, indicizzazione_repository).
grant select, delete on table public.indice_semantico to authenticated;

-- Il collegamento nasce e si cancella dal client; cambia stato solo sulle
-- due colonne concesse dalla 20260820221500.
grant select, insert, delete on table public.collegamento to authenticated;

-- L'artefatto generato si crea e si butta, non si corregge a mano: l'UPDATE
-- è tolto dalla 20260822090000.
grant select, insert, delete on table public.artefatto_generato to authenticated;

-- La libreria dell'Utente e tutto ciò che le sta sotto: qui la proprietà è
-- di chi scrive, e la RLS la fa rispettare riga per riga.
grant select, insert, update, delete on table public.voce_di_libreria         to authenticated;
grant select, insert, update, delete on table public.voce_di_libreria_privata to authenticated;
grant select, insert, update, delete on table public.lettura                  to authenticated;
grant select, insert, update, delete on table public.avanzamento              to authenticated;
grant select, insert, update, delete on table public.recensione               to authenticated;
grant select, insert, update, delete on table public.insight                  to authenticated;

-- Infine i grant per colonna, che il revoke qui sopra ha azzerato insieme a
-- quelli di riga. Ognuno ripete alla lettera la migrazione che l'ha deciso:
-- il perché sta lì, e non va duplicato qui.

-- 20260820221500: del Collegamento il partecipante cambia lo stato, non il
-- resto della riga.
grant update (stato, aggiornato_at) on table public.collegamento to authenticated;

-- 20260826120000: `completa_registrazione` scrive id e nome_utente;
-- `creato_at` ha un default ed è il database a doverlo fissare.
grant insert (id, nome_utente) on table public.utente to authenticated;

-- 20260826120000: stessa disciplina sulla riga privata. Il valore di
-- `informativa_accettata_at` lo sovrascrive comunque il trigger
-- `trg_utente_privato_informativa_non_falsificabile`.
grant insert (utente_id, informativa_accettata_at) on table public.utente_privato to authenticated;

-- 20260822090000: il consenso all'elaborazione assistita lo cambia l'Utente
-- con la propria identità; `informativa_accettata_at` resta fuori, perché è
-- la prova di un consenso informato e non si riscrive.
grant update (consenso_elaborazione_assistita, consenso_aggiornato_at, indici_stato)
  on table public.utente_privato to authenticated;
