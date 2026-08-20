-- Dati di sviluppo locale: libri seminati per esercitare il ciclo di
-- lettura (issue #2) e la libreria (issue #2, vista scaffale riscritta
-- il 20 agosto 2026) senza dipendere dalla ricerca sui cataloghi esterni
-- (issue #4, non ancora costruita). Applicato in automatico da
-- `supabase db reset --local` dopo le migrazioni, mai in produzione (la
-- CLI lo esegue solo su `db reset`, non su `migration up`/deploy).
--
-- Coerente con "in questa slice trattata come dato già esistente,
-- seminato direttamente come fa fuori banda il Manutentore" (issue #2):
-- niente copertine (restano NULL, trattamento segnaposto già previsto da
-- docs/design-frontend.md §7), nessun genere collegato (l'elenco
-- `genere` stesso resta vuoto: lo popola il Manutentore fuori banda, non
-- necessario per esercitare stato/letture/avanzamenti). Gli autori
-- invece sono seminati: lo scaffale ordina per cognome dell'autore
-- (design-frontend.md §7) e senza dati non c'è nulla da ordinare — più
-- di venti libri e più autori ripetuti, per verificare l'impacchettamento
-- delle mensole e le tacche per lettera su un caso reale, non su sei
-- libri isolati.
--
-- Le Voci di libreria si creano poi via `POST /voci` con un account di
-- test reale (AGENTS.md, "creare un account di test"), non da qui: un
-- seed non può inventare un utente reale, che nasce solo completando un
-- invito.

-- Nessun ON CONFLICT: identificativo_canonico resta NULL su ogni riga (i
-- vincoli unique di Postgres non considerano due NULL in conflitto), e
-- questo file gira solo dopo `db reset --local`, che riparte da un
-- database vuoto — non c'è nulla con cui confliggere.
insert into public.libro (titolo_canonico, anno_prima_pubblicazione, lingua_originale) values
  ('Le città invisibili', 1972, 'it'),
  ('Il barone rampante', 1957, 'it'),
  ('Se questo è un uomo', 1947, 'it'),
  ('Il sistema periodico', 1975, 'it'),
  ('Il nome della rosa', 1980, 'it'),
  ('Il pendolo di Foucault', 1988, 'it'),
  ('Lessico famigliare', 1963, 'it'),
  ('Le piccole virtù', 1962, 'it'),
  ('Il Gattopardo', 1958, 'it'),
  ('La coscienza di Zeno', 1923, 'it'),
  ('Senilità', 1898, 'it'),
  ('Il deserto dei Tartari', 1940, 'it'),
  ('Sessanta racconti', 1958, 'it'),
  ('Cent''anni di solitudine', 1967, 'es'),
  ('Cronaca di una morte annunciata', 1981, 'es'),
  ('Delitto e castigo', 1866, 'ru'),
  ('Il maestro e Margherita', 1967, 'ru'),
  ('Norwegian Wood', 1987, 'ja'),
  ('Kafka sulla spiaggia', 2002, 'ja'),
  ('Le braci', 1942, 'hu'),
  ('Memorie di Adriano', 1951, 'fr'),
  ('Oceano mare', 1993, 'it'),
  ('La strada', 2006, 'en'),
  ('Uomini e topi', 1937, 'en');

insert into public.autore (nome_canonico) values
  ('Italo Calvino'),
  ('Primo Levi'),
  ('Umberto Eco'),
  ('Natalia Ginzburg'),
  ('Giuseppe Tomasi di Lampedusa'),
  ('Italo Svevo'),
  ('Dino Buzzati'),
  ('Gabriel García Márquez'),
  ('Fëdor Dostoevskij'),
  ('Michail Bulgakov'),
  ('Haruki Murakami'),
  ('Sándor Márai'),
  ('Marguerite Yourcenar'),
  ('Alessandro Baricco'),
  ('Cormac McCarthy'),
  ('John Steinbeck');

-- Un autore per libro (ordine 0): sufficiente per lo scaffale e la scheda
-- di questa issue. Più autori per un libro (peso ripartito nelle
-- metriche, PRD regola 18) restano da provare quando servirà davvero.
insert into public.libro_autore (libro_id, autore_id, ordine)
select l.id, a.id, 0
from public.libro l
join public.autore a on (
  (l.titolo_canonico = 'Le città invisibili' and a.nome_canonico = 'Italo Calvino')
  or (l.titolo_canonico = 'Il barone rampante' and a.nome_canonico = 'Italo Calvino')
  or (l.titolo_canonico = 'Se questo è un uomo' and a.nome_canonico = 'Primo Levi')
  or (l.titolo_canonico = 'Il sistema periodico' and a.nome_canonico = 'Primo Levi')
  or (l.titolo_canonico = 'Il nome della rosa' and a.nome_canonico = 'Umberto Eco')
  or (l.titolo_canonico = 'Il pendolo di Foucault' and a.nome_canonico = 'Umberto Eco')
  or (l.titolo_canonico = 'Lessico famigliare' and a.nome_canonico = 'Natalia Ginzburg')
  or (l.titolo_canonico = 'Le piccole virtù' and a.nome_canonico = 'Natalia Ginzburg')
  or (
    l.titolo_canonico = 'Il Gattopardo'
    and a.nome_canonico = 'Giuseppe Tomasi di Lampedusa'
  )
  or (l.titolo_canonico = 'La coscienza di Zeno' and a.nome_canonico = 'Italo Svevo')
  or (l.titolo_canonico = 'Senilità' and a.nome_canonico = 'Italo Svevo')
  or (l.titolo_canonico = 'Il deserto dei Tartari' and a.nome_canonico = 'Dino Buzzati')
  or (l.titolo_canonico = 'Sessanta racconti' and a.nome_canonico = 'Dino Buzzati')
  or (
    l.titolo_canonico = 'Cent''anni di solitudine'
    and a.nome_canonico = 'Gabriel García Márquez'
  )
  or (
    l.titolo_canonico = 'Cronaca di una morte annunciata'
    and a.nome_canonico = 'Gabriel García Márquez'
  )
  or (l.titolo_canonico = 'Delitto e castigo' and a.nome_canonico = 'Fëdor Dostoevskij')
  or (l.titolo_canonico = 'Il maestro e Margherita' and a.nome_canonico = 'Michail Bulgakov')
  or (l.titolo_canonico = 'Norwegian Wood' and a.nome_canonico = 'Haruki Murakami')
  or (l.titolo_canonico = 'Kafka sulla spiaggia' and a.nome_canonico = 'Haruki Murakami')
  or (l.titolo_canonico = 'Le braci' and a.nome_canonico = 'Sándor Márai')
  or (l.titolo_canonico = 'Memorie di Adriano' and a.nome_canonico = 'Marguerite Yourcenar')
  or (l.titolo_canonico = 'Oceano mare' and a.nome_canonico = 'Alessandro Baricco')
  or (l.titolo_canonico = 'La strada' and a.nome_canonico = 'Cormac McCarthy')
  or (l.titolo_canonico = 'Uomini e topi' and a.nome_canonico = 'John Steinbeck')
);
