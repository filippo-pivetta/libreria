# Semina del catalogo — come procedere

Ordine obbligato. Il passo 3 non si salta: le migrazioni Supabase si
applicano da sole al merge, il backend **no**, e un lavoro accodato senza
il suo gestore fallisce subito e senza ritentare (`worker.py`: un tipo
senza gestore non è transitorio).

---

## 0. Prima di tutto: la quota di Google Books

Aprire Google Cloud Console → API e servizi → Books API → Quote.

Il file `accoda_opere.sql` è generato per **una semina ogni 180 secondi**
(~480 al giorno, ~3,8 giorni per 1815 opere). Un'aggiunta consuma più di
una chiamata, e le ricerche degli Utenti pescano dalla stessa chiave: una
semina che esaurisce la quota non rallenta se stessa, fa fallire la
ricerca a chi sta usando l'app.

Se la quota è più stretta, rigenerare con un passo più largo:

```bash
python3 backend/dati/semina/genera_accodamento.py 300   # una ogni 5 minuti
```

## 1. Merge su `main`

L'integrazione GitHub di Supabase applica da sola
`20260827130000_semina_catalogo.sql` al progetto hosted.

Verifica in SQL editor:

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'chk_lavoro_tipo';
```

Deve contenere `semina_libro`.

## 2. Deploy del backend — a mano

```bash
cd backend && fly deploy
```

La CI non lo fa. Senza questo passo il gestore `semina_libro` non esiste
in produzione.

## 3. Verifica che il gestore sia vivo

Accodare **un solo** lavoro di prova e guardare cosa succede:

```sql
insert into public.lavoro (tipo, chiave, payload)
values ('semina_libro', 'PROVA', '{"titolo":"Il nome della rosa","autori":["Umberto Eco"]}');
```

Dopo un minuto:

```sql
select stato, errore from public.lavoro where chiave = 'PROVA';
```

- `riuscito` → si procede.
- `fallito` con *«Nessun gestore per il tipo…»* → il deploy del passo 2
  non è andato. Fermarsi qui.

Poi si ripulisce: `delete from public.lavoro where chiave = 'PROVA';`

## 4. Accodare

Incollare **tutto** `accoda_opere.sql` in SQL editor. Una volta sola —
ma è rientrante, rieseguirlo non accoda doppioni.

Attesi: 1815 righe. Il worker gira già in produzione
(`min_machines_running = 1`), non c'è niente da avviare.

## 5. Controllare, il giorno dopo

Le query stanno in `stato_semina.sql`. Le tre che contano:

1. **Avanzamento** — quante fatte, quante mancano, quando finisce.
2. **Fallimenti raggruppati** — durante una semina arrivano quasi sempre
   tutti dalla stessa causa. Se dice *quota esaurita*, allargare il passo
   e rigenerare prima di riaccodare.
3. **Lavori figli** — è lì che finiscono spazio delle copertine e spesa
   del modello.

Due cose da guardare fuori dalle query, perché il PRD le dichiara senza
tetto e nessuno le sorveglia da solo:

- **Spazio Supabase** (Storage → bucket `copertine`). Stima: ~100 KB per
  libro, quindi ~200 MB su 1 GB di piano gratuito per l'intera lista.
- **Spesa OpenAI.** Con `gpt-4o-mini` l'intera semina sta sotto i pochi
  euro, ma è la sola voce che può crescere senza preavviso.

## 6. Fermare, o riprendere

**Fermare tutto ciò che non è ancora partito:**

```sql
delete from public.lavoro where tipo = 'semina_libro' and stato = 'in_attesa';
```

Le schede già nate restano, e sono schede normali.

**Riaccodare i falliti** (tipico dopo un esaurimento di quota: i tentativi
si consumano in dodici minuti, quindi una quota finita di notte lascia
fallita tutta quella finestra anche se la causa è passata): query 5 di
`stato_semina.sql`, da decommentare.

## 7. A semina finita

Query 6 di `stato_semina.sql`: le opere che non hanno prodotto nulla.

Non è un errore. Il caso più frequente è il titolo in una terza lingua —
la lista porta il titolo canonico di Open Library, che per *L'alchimista*
è *O Alquimista*, e Google interrogato con `country=IT` non li collega. Si
riseminano a mano correggendo il titolo nel payload.

---

## Cosa NON serve fare

- **Avviare processi.** Il worker gira dentro l'API, sempre acceso.
- **Toccare il frontend.** Una scheda seminata è indistinguibile da una
  aggiunta da un Utente: nessuna colonna le separa, e nessuna schermata
  cambia.
- **Preoccuparsi dei duplicati con schede esistenti.** Il riconoscimento
  avviene sugli identificativi, prima della catena costosa e di nuovo
  prima di creare; in produzione ogni scheda ne ha almeno uno
  (`risoluzione.py`, il riferimento `google_books` è incondizionato).
