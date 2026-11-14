-- Montaigne — libro.lingua_originale è un codice di lingua, mai un nome
--
-- Il frontend passa la colonna a `Intl.DisplayNames` (formattaLingua in
-- frontend/src/lib/formato.ts), che la scrive per esteso nella lingua
-- dell'interfaccia. Misurato in produzione il 14 novembre 2026: accanto ai
-- codici (`en` 634, `it` 42, …) c'erano circa trecento righe scritte per
-- esteso in tre lingue — «inglese» 134, «English» 95, «italiano»,
-- «Italian», «Amerikanisches Englisch» — e tre con la stringa `'null'`. Le
-- scriveva il lavoro di arricchimento assistito, che chiedeva al modello
-- «la lingua originale» senza vincolarne la forma.
--
-- Tre passi:
--   1. i nomi riconosciuti diventano il loro codice;
--   2. ciò che resta fuori elenco diventa NULL — un dato assente, non un
--      dato inventato (PRD), e il lavoro di arricchimento lo potrà
--      ridedurre;
--   3. un CHECK impedisce che si ripeta.
--
-- L'elenco dei codici è lo stesso di backend/app/core/lingua_originale.py
-- (`CODICI`), che vincola anche la risposta del modello. Sono due copie da
-- tenere allineate a mano: un codice aggiunto solo nel backend farebbe
-- fallire la scrittura su questo CHECK, e il lavoro lo segnalerebbe.

-- 1. Nomi -> codice. Il confronto è su lower(trim()), quindi «English» ed
--    «english» sono la stessa voce.
update public.libro l
   set lingua_originale = m.codice
  from (values
    ('arabo', 'ar'), ('catalano', 'ca'), ('ceco', 'cs'), ('danese', 'da'),
    ('tedesco', 'de'), ('greco', 'el'), ('greco moderno', 'el'),
    ('inglese', 'en'), ('spagnolo', 'es'), ('persiano', 'fa'),
    ('finlandese', 'fi'), ('francese', 'fr'), ('greco antico', 'grc'),
    ('ebraico', 'he'), ('ungherese', 'hu'), ('italiano', 'it'),
    ('giapponese', 'ja'), ('coreano', 'ko'), ('latino', 'la'),
    ('olandese', 'nl'), ('norvegese', 'no'), ('polacco', 'pl'),
    ('portoghese', 'pt'), ('rumeno', 'ro'), ('russo', 'ru'), ('serbo', 'sr'),
    ('svedese', 'sv'), ('turco', 'tr'), ('ucraino', 'uk'), ('yiddish', 'yi'),
    ('cinese', 'zh'),
    ('arabic', 'ar'), ('catalan', 'ca'), ('czech', 'cs'), ('danish', 'da'),
    ('german', 'de'), ('greek', 'el'), ('english', 'en'),
    ('american english', 'en'), ('british english', 'en'), ('spanish', 'es'),
    ('persian', 'fa'), ('finnish', 'fi'), ('french', 'fr'),
    ('ancient greek', 'grc'), ('hebrew', 'he'), ('hindi', 'hi'),
    ('hungarian', 'hu'), ('italian', 'it'), ('japanese', 'ja'),
    ('korean', 'ko'), ('latin', 'la'), ('dutch', 'nl'), ('norwegian', 'no'),
    ('polish', 'pl'), ('portuguese', 'pt'), ('romanian', 'ro'),
    ('russian', 'ru'), ('serbian', 'sr'), ('swedish', 'sv'),
    ('tagalog', 'tl'), ('turkish', 'tr'), ('ukrainian', 'uk'),
    ('chinese', 'zh'),
    ('amerikanisches englisch', 'en'), ('englisch', 'en'), ('deutsch', 'de'),
    ('eng', 'en'), ('ita', 'it'), ('fre', 'fr'), ('fra', 'fr'), ('ger', 'de'),
    ('deu', 'de'), ('spa', 'es'), ('rus', 'ru'), ('jpn', 'ja'), ('lat', 'la')
  ) as m(nome, codice)
 where lower(trim(l.lingua_originale)) = m.nome;

-- Codici già giusti ma con maiuscole o spazi («EN», « it»).
update public.libro
   set lingua_originale = lower(trim(lingua_originale))
 where lingua_originale is not null
   and lingua_originale <> lower(trim(lingua_originale));

-- 2. Ciò che resta fuori elenco diventa assente. `lingua_dedotta` torna
--    false insieme: la lingua dedotta non c'è più.
update public.libro
   set lingua_originale = null,
       lingua_dedotta = false
 where lingua_originale is not null
   and lingua_originale not in (
     'ar', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr', 'grc',
     'he', 'hi', 'hu', 'it', 'ja', 'ko', 'la', 'nl', 'no', 'pl', 'pt', 'ro',
     'ru', 'sr', 'sv', 'tl', 'tr', 'uk', 'yi', 'zh'
   );

-- 3. Il vincolo.
alter table public.libro
  add constraint chk_libro_lingua_originale_codice
    check (lingua_originale is null or lingua_originale in (
      'ar', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr', 'grc',
      'he', 'hi', 'hu', 'it', 'ja', 'ko', 'la', 'nl', 'no', 'pl', 'pt', 'ro',
      'ru', 'sr', 'sv', 'tl', 'tr', 'uk', 'yi', 'zh'
    ));

comment on constraint chk_libro_lingua_originale_codice on public.libro is
  'Codice di lingua (ISO 639-1, grc per il greco antico), mai un nome: il frontend lo scrive per esteso con Intl.DisplayNames. Elenco allineato a mano con backend/app/core/lingua_originale.py (CODICI).';
