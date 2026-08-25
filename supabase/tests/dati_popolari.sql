-- Dati di prova per «I titoli che tornano» (design-frontend.md §13,
-- ridisegno del 25 agosto 2026): dieci lettori leggeri, solo per dare
-- alla funzione libri_popolari (migrazione 20260825150000) numeri
-- veri con cui impacchettare la mensola in locale.
--
-- NON sono account utilizzabili: nessuna password, nessuna riga pensata
-- per essere aperta in un browser — servono solo a possedere delle
-- voce_di_libreria, che è tutto ciò che libri_popolari legge. Per lo
-- stesso motivo non compaiono in AGENTS.md "Account di test locali":
-- quella tabella è per chi accede con nome utente e password, questi
-- dieci non ne hanno mai avuti. Si guardano restando `prova` (o
-- `marta`) e aprendo «Aggiungi un libro».
--
-- Niente Letture né Avanzamenti: libri_popolari legge solo stato e voto
-- di voce_di_libreria, e nessun trigger su quella tabella ricalcola lo
-- stato da una Lettura se non alla CANCELLAZIONE di una Lettura
-- (lettura_ricalcola_stato_voce, migrazione 20260820065144) — inserire
-- lo stato direttamente è corretto, non una scorciatoia fragile.
--
-- Sei titoli («vincitori», da autori tutti diversi) con molti lettori e
-- voti alti; il resto del seed di 24 libri fa da rumore, con qualche
-- abbandono per esercitare anche il segnale di finitura. `Le piccole
-- virtù` resta senza nessuna riga apposta: un titolo che nessuno di
-- questi dieci ha letto è un caso reale da tenere, non da riempire.
--
-- Si riapplica dopo un `supabase db reset --local`, dopo aver rifatto
-- anche `supabase/tests/dati_collegato.sql` (AGENTS.md).

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'lettore-popolari-01@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'lettore-popolari-02@example.com'),
  ('10000000-0000-0000-0000-000000000003', 'lettore-popolari-03@example.com'),
  ('10000000-0000-0000-0000-000000000004', 'lettore-popolari-04@example.com'),
  ('10000000-0000-0000-0000-000000000005', 'lettore-popolari-05@example.com'),
  ('10000000-0000-0000-0000-000000000006', 'lettore-popolari-06@example.com'),
  ('10000000-0000-0000-0000-000000000007', 'lettore-popolari-07@example.com'),
  ('10000000-0000-0000-0000-000000000008', 'lettore-popolari-08@example.com'),
  ('10000000-0000-0000-0000-000000000009', 'lettore-popolari-09@example.com'),
  ('10000000-0000-0000-0000-000000000010', 'lettore-popolari-10@example.com');

insert into public.utente (id, nome_utente) values
  ('10000000-0000-0000-0000-000000000001', 'lettore_popolari_01'),
  ('10000000-0000-0000-0000-000000000002', 'lettore_popolari_02'),
  ('10000000-0000-0000-0000-000000000003', 'lettore_popolari_03'),
  ('10000000-0000-0000-0000-000000000004', 'lettore_popolari_04'),
  ('10000000-0000-0000-0000-000000000005', 'lettore_popolari_05'),
  ('10000000-0000-0000-0000-000000000006', 'lettore_popolari_06'),
  ('10000000-0000-0000-0000-000000000007', 'lettore_popolari_07'),
  ('10000000-0000-0000-0000-000000000008', 'lettore_popolari_08'),
  ('10000000-0000-0000-0000-000000000009', 'lettore_popolari_09'),
  ('10000000-0000-0000-0000-000000000010', 'lettore_popolari_10');

insert into public.utente_privato (utente_id, informativa_accettata_at) values
  ('10000000-0000-0000-0000-000000000001', now()),
  ('10000000-0000-0000-0000-000000000002', now()),
  ('10000000-0000-0000-0000-000000000003', now()),
  ('10000000-0000-0000-0000-000000000004', now()),
  ('10000000-0000-0000-0000-000000000005', now()),
  ('10000000-0000-0000-0000-000000000006', now()),
  ('10000000-0000-0000-0000-000000000007', now()),
  ('10000000-0000-0000-0000-000000000008', now()),
  ('10000000-0000-0000-0000-000000000009', now()),
  ('10000000-0000-0000-0000-000000000010', now());

-- I sei titoli che dovrebbero vincere la classifica, un autore ciascuno.
-- Le città invisibili
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le città invisibili' order by creato_at limit 1;

-- Memorie di Adriano
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Memorie di Adriano' order by creato_at limit 1;

-- Il maestro e Margherita
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il maestro e Margherita' order by creato_at limit 1;

-- Le braci
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Le braci' order by creato_at limit 1;

-- Il deserto dei Tartari
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Il deserto dei Tartari' order by creato_at limit 1;

-- Se questo è un uomo
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'letto', 4.5 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000010', id, 'letto', 5.0 from public.libro where titolo_canonico = 'Se questo è un uomo' order by creato_at limit 1;

-- Il resto del seed, come rumore: pochi lettori, voti più bassi, qualche
-- abbandono. «Le piccole virtù» non compare qui: zero righe è un caso
-- reale (un titolo che nessuno di questi dieci ha letto), non un buco da
-- riempire.
-- Il barone rampante
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Il barone rampante' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'abbandonato', null from public.libro where titolo_canonico = 'Il barone rampante' order by creato_at limit 1;

-- Il sistema periodico
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 3.0 from public.libro where titolo_canonico = 'Il sistema periodico' order by creato_at limit 1;

-- Il nome della rosa
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Il nome della rosa' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 3.0 from public.libro where titolo_canonico = 'Il nome della rosa' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'in_lettura', null from public.libro where titolo_canonico = 'Il nome della rosa' order by creato_at limit 1;

-- Il pendolo di Foucault
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'abbandonato', null from public.libro where titolo_canonico = 'Il pendolo di Foucault' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'abbandonato', null from public.libro where titolo_canonico = 'Il pendolo di Foucault' order by creato_at limit 1;

-- Lessico famigliare
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Lessico famigliare' order by creato_at limit 1;

-- Il Gattopardo
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Il Gattopardo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000010', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Il Gattopardo' order by creato_at limit 1;

-- La coscienza di Zeno
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'letto', 3.5 from public.libro where titolo_canonico = 'La coscienza di Zeno' order by creato_at limit 1;

-- Senilità
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'abbandonato', null from public.libro where titolo_canonico = 'Senilità' order by creato_at limit 1;

-- Sessanta racconti
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Sessanta racconti' order by creato_at limit 1;

-- Cent'anni di solitudine
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Cent''anni di solitudine' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Cent''anni di solitudine' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'in_pausa', null from public.libro where titolo_canonico = 'Cent''anni di solitudine' order by creato_at limit 1;

-- Cronaca di una morte annunciata
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000005', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Cronaca di una morte annunciata' order by creato_at limit 1;

-- Delitto e castigo
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000002', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Delitto e castigo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Delitto e castigo' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000010', id, 'abbandonato', null from public.libro where titolo_canonico = 'Delitto e castigo' order by creato_at limit 1;

-- Norwegian Wood
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000003', id, 'letto', 3.0 from public.libro where titolo_canonico = 'Norwegian Wood' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000007', id, 'abbandonato', null from public.libro where titolo_canonico = 'Norwegian Wood' order by creato_at limit 1;

-- Kafka sulla spiaggia
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000009', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Kafka sulla spiaggia' order by creato_at limit 1;

-- Oceano mare
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000004', id, 'letto', 3.5 from public.libro where titolo_canonico = 'Oceano mare' order by creato_at limit 1;

-- La strada
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000001', id, 'letto', 4.0 from public.libro where titolo_canonico = 'La strada' order by creato_at limit 1;
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000008', id, 'letto', 3.5 from public.libro where titolo_canonico = 'La strada' order by creato_at limit 1;

-- Uomini e topi
insert into public.voce_di_libreria (utente_id, libro_id, stato, voto) select '10000000-0000-0000-0000-000000000006', id, 'letto', 4.0 from public.libro where titolo_canonico = 'Uomini e topi' order by creato_at limit 1;

commit;
