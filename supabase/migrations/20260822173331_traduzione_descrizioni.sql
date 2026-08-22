-- Montaigne — traduzione assistita delle descrizioni mancanti (issue #24)
--
-- Sotto-issue rimanente di #20 (punto 6, bassa priorità): quando un'opera ha una
-- descrizione reale in una delle due lingue dell'interfaccia (it/en) ma non nell'altra
-- (tipicamente: testo inglese da Wikipedia, nessuna voce italiana), un lavoro in
-- secondo piano traduce il testo esistente — mai lo genera da zero (PRD, entità
-- Descrizione: "se nessuna fonte ha una descrizione dell'opera, il campo resta vuoto").
--
-- Trattamento di trasparenza: decisione presa in questa issue di riusare
-- `libro_descrizione.riformulata` invece di introdurre un campo dedicato — il
-- significato della colonna si allarga da "riformulato (espanso/accorciato)" a
-- "il testo di questa riga non è la citazione letterale della fonte in questa
-- lingua", che ora copre anche la traduzione.

alter table public.lavoro drop constraint chk_lavoro_tipo;
alter table public.lavoro add constraint chk_lavoro_tipo
  check (tipo in ('copertina', 'descrizione', 'arricchimento_bibliografico',
                   'riconduzione_autore', 'deduplicazione_libro', 'standardizzazione_descrizione',
                   'indicizzazione_semantica', 'ricostruzione_indici', 'traduzione_descrizione'));

comment on column public.libro_descrizione.riformulata is
  'Vero quando il testo non è la citazione letterale della fonte in quella lingua: riformulato dal modello (espanso se troppo corto, accorciato se troppo lungo, design-frontend.md §24) oppure tradotto da un''altra lingua quando la fonte non copriva questa (issue #24, emendamento 22 agosto 2026) — sempre a partire da un testo sorgente reale e da fatti già verificati, mai dalla conoscenza generale del modello. L''etichetta di trasparenza in scheda è stata costruita e poi tolta dall''interfaccia (emendamento 22 agosto 2026): questo campo resta comunque scritto, per un''eventuale reintroduzione futura.';
