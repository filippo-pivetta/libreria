# 0018. Le funzioni assistite personali stanno in un modulo separato, con il consenso letto in un punto solo

Stato: accettata
Data: 2026-08-22

## Contesto
Fino all'issue #6 ogni chiamata al fornitore di modelli portava solo dato bibliografico condiviso, e `app/cataloghi/llm.py` lo dichiarava come invariante nel proprio docstring: "tutte lavorano solo su dato bibliografico condiviso, mai su `voce_di_libreria`/`lettura`/`insight`/`recensione`". ADR 0017 costruisce su quella frase la sua argomentazione sulla regola 19 ("la regola è rispettata per costruzione dell'accesso ai dati dei gestori che le invocano, non per una verifica a runtime dentro il client").

L'issue #6 costruisce le prime funzioni che quell'invariante non può più coprire: la preview personalizzata invia lo storico e i testi dell'Utente, e la ricerca semantica invia la sua domanda e conserva embedding dei suoi insight. Serviva anche un modello di embedding, che la colonna `indice_semantico.embedding` dava per deciso a 1536 dimensioni senza che nessuna decisione l'avesse presa, e un punto in cui il consenso viene letto — il PRD subordina cinque funzioni allo stesso interruttore, e ne rimanda tre a dopo.

## Decisione
Le chiamate che portano contenuti dell'Utente vivono in `app/cataloghi/llm_personale.py`, separate da quelle bibliografiche di `llm.py`; il trasporto comune (richiesta, errori, structured output, embedding) sta in `app/cataloghi/openai_client.py`. Il modello di embedding è `text-embedding-3-small`, 1536 dimensioni, come la colonna già prevedeva. Il consenso si legge in `app/services/consenso.py` e in nessun altro punto dello strato applicativo; un consenso mancante è un 409 con `error_code: consenso_revocato`, mai un 403 e mai una risposta vuota. La proprietà dei dati inviati è garantita due volte, dal filtro esplicito su `utente_id` nelle query di `preview_repository` e nella RPC `cerca_semantico`, oltre che dalla RLS.

ADR 0017 resta valida parola per parola: `chiama_json` è il suo `_chiama`, con lo stesso timeout, la stessa assenza di ritentativi, lo stesso trattamento del JSON fuori schema, e le stesse funzioni tipizzate al posto di un client "chat" generico.

## Alternative scartate
**Aggiungere le funzioni personali a `llm.py`.** Un file in meno, ma cancella la proprietà su cui ADR 0017 poggia la regola 19: oggi si può dire "in quel file non c'è nulla di personale" senza leggere un prompt, e con la fusione la verifica sarebbe tornata a essere una rilettura completa a ogni modifica.

**Un controllo del consenso dentro il client, prima di ogni chiamata personale.** Sembra più sicuro perché sta al confine, ma darebbe al client l'accesso al database che oggi non ha, e trasformerebbe cinque funzioni che oggi falliscono in modo dichiarabile ("questa funzione è spenta") in cinque errori indistinguibili da un fornitore irraggiungibile.

**Un consenso per funzione.** Già scartato da ADR 0008 e non riaperto qui: la decisione dell'Utente resta una sola, se i propri testi escono o no.

**`text-embedding-3-large` (3072 dimensioni).** Migliore su compiti di recupero difficili, ma raddoppia lo spazio sul piano gratuito — che il PRD dichiara come limite — per una differenza che alla scala di poche centinaia di insight per utente non è misurabile. Cambiare idea costa un `alter column` più una ricostruzione in blocco, che è esattamente la procedura che l'interruttore del consenso già esegue.

## Conseguenze
Diventa più facile aggiungere le tre funzioni personali rimandate (suggerimenti, sintesi tematica, acquisizione da foto): ereditano il cancello, il trasporto e il modulo, e la domanda "da che parte del confine sta?" ha già un posto in cui si risponde. Diventa più difficile condividere codice fra le due categorie senza pensarci, che è l'attrito voluto. Invertire la decisione significa rifondere i due moduli e riscrivere il docstring che dichiara l'invariante, non toccare i service.
