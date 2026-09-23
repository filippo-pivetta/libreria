# Manutenzione

## Nessuna sezione amministrativa dentro Montaigne

[ADR 0007](adr/0007-amministrazione-fuori-dal-prodotto.md) regge su un argomento solo, ma basta da
solo: non esiste alcuna infrastruttura di ruoli. `app/core/security.py` non li conosce, `utente`
non ha una colonna ruolo, non c'è claim custom. Un `/admin` in-app richiederebbe policy RLS con un
ramo «a meno che non sia admin» su ogni tabella, e un backend che per quelle rotte usi
`service_role` invece dell'identità dell'Utente — la deroga che ADR 0006 e ADR 0016 tengono
stretta.

Il costo non è la pagina. È quel ramo, moltiplicato per ogni tabella, per sempre.

La manutenzione si fa quindi in Supabase Studio: invito dei membri, correzione dei generi,
creazione manuale delle schede assenti dai cataloghi, fusione dei duplicati.

## Cosa NON fare

- **Metriche utenti.** Studio dà già i conteggi. E `GET /utenti` non calcola apposta il totale
  membri: è una scelta di prodotto, non una dimenticanza da colmare.
- **Correggere le pagine sul Libro.** Il conteggio autorevole è `voce_di_libreria.pagine_adottate`,
  per Utente ([ADR 0003](adr/0003-conteggio-pagine-su-voce-di-libreria.md)). Sul Libro c'è solo
  `pagine_mediane_catalogo`, che precompila e non entra in nessuna metrica: correggerlo non ripara
  niente di retroattivo.
- **Riscrivere descrizioni a mano.** Le producono i lavori `standardizzazione_descrizione` e
  `traduzione_descrizione`. Il rimedio è riaccodare, non editare.

## Due voci senza tetto, da guardare a mano

Non le sorveglia nessuno e nessun degrado automatico le protegge:

- **Spazio immagini** (Storage → bucket `copertine`). Cresce col catalogo condiviso, non col numero
  di utenti. Stima: ~100 KB per libro.
- **Spesa dei modelli.** È la sola voce che può crescere senza preavviso.

I progetti Supabase gratuiti vengono inoltre sospesi dopo una settimana di scarsa attività.

## Popolamento del catalogo

La semina fa nascere schede che nessun Utente ha ancora chiesto, così che il catalogo locale non
parta vuoto. **Percorre la stessa catena delle aggiunte, non una parallela**: il gestore
`app/lavori/semina.py` trova l'opera su Google e la passa a `ricerca_service.assicura_scheda`, la
stessa funzione che serve `POST /libri`. Una scheda seminata è indistinguibile da una aggiunta da
un Utente e nessuna colonna le separa — se lo facesse, ADR 0002 avrebbe due identità invece di una.
L'unica cosa che la semina non fa è creare una Voce.

| dove | cosa |
|---|---|
| `backend/dati/semina/raccogli_da_open_library.py` | raccoglie i candidati da Open Library |
| `backend/dati/semina/opere.json` | la lista, 1815 opere |
| `backend/dati/semina/genera_accodamento.py` | produce l'SQL, con il ritmo come parametro |
| `supabase/manutenzione/semina/accoda_opere.sql` | l'istruzione da incollare in SQL editor |
| `supabase/manutenzione/semina/stato_semina.sql` | avanzamento, fallimenti, riaccodamento |
| `backend/app/lavori/semina.py` | il gestore |

Procedura passo per passo: `supabase/manutenzione/semina/COME_PROCEDERE.md`.

**Il ritmo sta nel dato, non nel codice.** L'`insert` scagliona `esegui_dopo`, perché il vincolo
non è la coda — che ne smaltirebbe una al secondo — ma la quota giornaliera di Google Books,
condivisa con le ricerche degli Utenti. Una semina che la esaurisce non rallenta se stessa: fa
fallire la ricerca a chi sta usando l'app.

Tre cose imparate costruendola, che varrebbe la pena non riscoprire:

1. **La lista di Open Library non è un canone.** `sort=readinglog` dà la classifica del suo
   pubblico, che è self-help anglofono; `sort=editions` da solo fa entrare atlanti, agende e libri
   da colorare. Servono due rami e una soglia di lettori sul secondo.
2. **Il confronto sul titolo si normalizza sul più LUNGO dei due.** Misurato: cercando "Nineteen
   Eighty-Four" di Orwell, Google restituisce un'antologia intitolata "George Orwell: 1984 /
   Nineteen Eighty-Four", che contiene tutte le parole attese. Normalizzando sul più corto
   prendeva punteggio pieno, e la scheda nasceva con l'anno dell'antologia (1980) al posto di
   quello dell'opera (1949) — un errore plausibile, quindi invisibile.
3. **I titoli in una terza lingua non si agganciano.** La lista porta il titolo canonico di Open
   Library, che per "L'alchimista" è "O Alquimista"; Google interrogato con `country=IT` non li
   collega e l'opera non viene seminata. È un esito, non un errore: la query 6 di
   `stato_semina.sql` le fa riemergere, e si riseminano a mano.

Nota di perimetro: «nessuna importazione da servizi terzi» riguarda la **libreria di un Utente**
da Goodreads e simili, non la semina del catalogo condiviso. `libri_popolari` non è toccata: legge
`voce_di_libreria`, non `libro`.
