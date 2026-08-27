# Manutenzione e osservabilità

Conclusioni di un'esplorazione del 27 agosto 2026. Niente di questo è
costruito: è la strada da prendere quando servirà, con le ragioni per cui
è quella e non un'altra.

## La decisione di fondo

Nessuna sezione amministrativa dentro Montaigne. [ADR 0007](adr/0007-amministrazione-fuori-dal-prodotto.md)
resta valida, ma per **un** solo dei suoi due argomenti.

- **Scaduto:** «poche persone». Il PRD del 24 agosto ha alzato la scala a
  migliaia di membri. Non è più un argomento.
- **Regge, e basta da solo:** non esiste alcuna infrastruttura di ruoli.
  `app/core/security.py` non li conosce, `utente` non ha una colonna
  ruolo, non c'è claim custom. Un `/admin` in-app richiederebbe policy RLS
  con un ramo «a meno che non sia admin» su ogni tabella, e un back end
  che per quelle rotte usi `service_role` invece dell'identità
  dell'Utente — la deroga che ADR 0006 e ADR 0016 tengono stretta.

Il costo non è la pagina. È quel ramo, moltiplicato per ogni tabella, per
sempre.

## Cosa fare invece, quando servirà

### Primo: sei query salvate in `supabase/manutenzione/`

Un file per domanda, da incollare in Studio. Coprono l'80% del bisogno,
perché il bisogno reale è «non ho la query sotto mano», non «non ho una
UI». Costo: mezza giornata, nessuna migrazione, niente da mantenere.

| file | risponde a |
|---|---|
| `proposte_in_attesa.sql` | duplicati da rivedere, coi due libri affiancati |
| `lavori_falliti.sql` | cosa si è rotto in coda, per tipo, con l'ultimo errore |
| `copertine_fallite.sql` | libri con `copertina_stato = 'fallita'` |
| `libri_incompleti.sql` | senza genere, senza descrizione, senza pagine |
| `spazio_copertine.sql` | la risorsa più scarsa del sistema (PRD) |
| `polso.sql` | conteggi d'insieme: libri, voci, utenti, proposte, coda |

Studio dà già dimensioni tabelle, log e conteggi righe: quelle query
servono per lo stato **di dominio**, che Studio non conosce.

### Secondo: una CLI in `backend/app/manutenzione/`, solo se i numeri la giustificano

Stesso stampo di `python -m app.lavori`, `argparse` della stdlib, nessuna
dipendenza nuova. Comandi: `proposte` / `fondi <id>` / `scarta <id>` /
`lavori --falliti` / `riaccoda <tipo> <chiave>`.

Due motivi per cui batte le query, e sono gli unici due:

1. **`fondi` chiude un buco reale.** Oggi `fondi_libro` e la scrittura di
   `proposta_fusione_libro.stato` sono due passi separati fatti a mano.
   Alla decima fusione te ne sei dimenticato tre volte e la tabella delle
   proposte non è più affidabile — cioè hai perso proprio lo strumento.
   Un comando fa i due passi in una transazione.
2. **`importa` non è esprimibile in SQL.** Far nascere una scheda è la
   catena di risoluzione in Python, non una `insert`.

Costo: circa un giorno.

**La CLI si connette come `postgres` e scavalca la RLS.** Da qui due
regole: mai esporla come rotta, e la stringa di produzione in un file
d'ambiente separato che si carica apposta, mai nel `.env` di default.

### Terzo: `/health` esteso, solo se vuoi un monitor esterno

Oggi dice `database: ok` e nient'altro. Aggiungere profondità della coda,
lavori falliti nelle 24h e stato copertine, dietro un header segreto,
costa mezza giornata e ha un effetto collaterale utile: i progetti
Supabase gratuiti vengono sospesi dopo una settimana di scarsa attività, e
un monitor che lo interroga lo previene.

Restano fuori banda per forza le due voci che il PRD dichiara senza tetto:
spesa dei modelli e spazio immagini.

## Cosa NON fare

- **Metriche utenti.** Studio dà già i conteggi. E `GET /utenti` non
  calcola apposta il totale membri: è una scelta di prodotto, non una
  dimenticanza da colmare.
- **Correggere le pagine.** Il conteggio autorevole è
  `voce_di_libreria.pagine_adottate`, per Utente ([ADR 0003](adr/0003-conteggio-pagine-su-voce-di-libreria.md)).
  Sul Libro c'è solo `pagine_mediane_catalogo`, che precompila e non entra
  in nessuna metrica: correggerlo non ripara niente di retroattivo.
- **Riscrivere descrizioni a mano.** Le producono i lavori
  `standardizzazione_descrizione` e `traduzione_descrizione`. Il rimedio è
  riaccodare, non editare.

## Popolamento del catalogo

Costruito il 27 agosto 2026. La semina fa nascere schede che nessun Utente
ha ancora chiesto, cosi' che il catalogo locale non parta vuoto.

**Percorre la stessa catena delle aggiunte, non una parallela.** Il
gestore `app/lavori/semina.py` trova l'opera su Google e la passa a
`ricerca_service.assicura_scheda`, la stessa funzione che serve
`POST /libri` — estratta da li' proprio per non avere due modi di far
nascere una scheda. Una scheda seminata e' indistinguibile da una
aggiunta da un Utente, e nessuna colonna le separa: se lo facesse, ADR
0002 avrebbe due identita' invece di una. L'unica cosa che la semina non
fa e' creare una Voce (ADR 0001).

I pezzi:

| dove | cosa |
|---|---|
| `backend/dati/semina/raccogli_da_open_library.py` | raccoglie i candidati da Open Library |
| `backend/dati/semina/opere.json` | la lista, 1815 opere |
| `backend/dati/semina/genera_accodamento.py` | produce l'SQL, con il ritmo come parametro |
| `supabase/manutenzione/semina/accoda_opere.sql` | l'istruzione da incollare in SQL editor |
| `supabase/manutenzione/semina/stato_semina.sql` | avanzamento, fallimenti, riaccodamento |
| `backend/app/lavori/semina.py` | il gestore |

**Il ritmo sta nel dato, non nel codice.** L'`insert` scagliona
`esegui_dopo`, perche' il vincolo non e' la coda — che ne smaltirebbe una
al secondo — ma la quota giornaliera di Google Books, condivisa con le
ricerche degli Utenti. Una semina che la esaurisce non rallenta se
stessa: fa fallire la ricerca a chi sta usando l'app. Il default e' una
ogni 180 secondi, da tarare sulla quota reale del progetto.

Tre cose imparate costruendola, che varrebbe la pena non riscoprire:

1. **La lista di Open Library non e' un canone.** `sort=readinglog` da'
   la classifica del suo pubblico, che e' self-help anglofono;
   `sort=editions` da solo fa entrare atlanti, agende e libri da
   colorare. Servono due rami e una soglia di lettori sul secondo.
2. **Il confronto sul titolo si normalizza sul piu' LUNGO dei due.**
   Misurato: cercando "Nineteen Eighty-Four" di Orwell, Google
   restituisce un'antologia intitolata "George Orwell: 1984 / Nineteen
   Eighty-Four", che contiene tutte le parole attese. Normalizzando sul
   piu' corto prendeva punteggio pieno, e la scheda nasceva con l'anno
   dell'antologia (1980) al posto di quello dell'opera (1949) — un errore
   plausibile, quindi invisibile.
3. **I titoli in una terza lingua non si agganciano.** La lista porta il
   titolo canonico di Open Library, che per "L'alchimista" e' "O
   Alquimista"; Google interrogato con `country=IT` non li collega e
   l'opera non viene seminata. E' un esito, non un errore: la query 6 di
   `stato_semina.sql` le fa riemergere, e si riseminano a mano.

Nota di perimetro: «Nessuna importazione da servizi terzi» nel Fuori
scope del PRD riguarda l'importazione della **libreria di un Utente** da
Goodreads e simili, non la semina del catalogo condiviso. Non c'e'
conflitto. `libri_popolari` non e' toccata: legge `voce_di_libreria`, non
`libro`.
