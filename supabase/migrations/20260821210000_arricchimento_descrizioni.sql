-- Montaigne — standardizzazione assistita delle descrizioni fuori standard
--
-- Emendamento a docs/design-frontend.md §24 (21 agosto 2026): alcune voci
-- Wikipedia si riducono a una sola frase ("Le notti bianche è un racconto
-- giovanile di Fëdor Dostoevskij."), sotto lo standard di prosa breve
-- della scheda del libro; altre — soprattutto le trame di Google Books —
-- lo superano abbondantemente. Un lavoro in secondo piano porta a
-- 400-600 caratteri le sole descrizioni fuori da quella fascia (sotto i
-- 200 o sopra i 900), espandendo o accorciando secondo il caso, ancorato
-- solo al testo sorgente e ai dati già in database — mai alla conoscenza
-- generale del modello. La regola "mai inventato" resta sui FATTI, non
-- sulla formulazione: da qui la colonna `riformulata`, stesso
-- trattamento di trasparenza di `anno_dedotto`/`lingua_dedotta`.
--
-- Chiamato "standardizzazione" e non "arricchimento": un nome che
-- promette solo di espandere sarebbe disonesto per un lavoro che accorcia
-- altrettanto spesso.

alter table public.libro_descrizione add column riformulata boolean not null default false;

comment on column public.libro_descrizione.riformulata is
  'Vero quando il testo è stato riformulato dal modello (espanso se troppo corto, accorciato se troppo lungo) a partire dalla sola descrizione sorgente e dai dati già verificati (titolo/autori/anno/generi) — mai dalla conoscenza generale del modello (docs/design-frontend.md §24, emendamento 21 agosto 2026). L''etichetta di trasparenza in scheda è stata costruita e poi tolta dall''interfaccia (emendamento 22 agosto 2026): questo campo resta comunque scritto, per un''eventuale reintroduzione futura.';

alter table public.lavoro drop constraint chk_lavoro_tipo;
alter table public.lavoro add constraint chk_lavoro_tipo
  check (tipo in ('copertina', 'descrizione', 'arricchimento_bibliografico',
                   'riconduzione_autore', 'deduplicazione_libro', 'standardizzazione_descrizione'));
