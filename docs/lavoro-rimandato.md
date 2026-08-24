# Lavoro rimandato

Punti di design non ancora costruiti e senza priorità per aprire un'issue dedicata adesso.
Le voci con un'issue propria sono tracciate lì, non qui.

## Azioni rapide dal volume

Registrare un avanzamento o cambiare stato con un tocco lungo (mobile) senza aprire la scheda del
libro. Con la copertina vera lo spazio libero sul volume è ridotto rispetto al vecchio dorso, il
gesto va ridisegnato da zero. Oggi il volume è solo un link alla scheda.

## Nessuna difesa dalle richieste indesiderate (istanza aperta)

**Decisione consapevole di non costruire, non una svista.** Aprendo l'istanza oltre il gruppo
chiuso (24 agosto 2026) è caduta la motivazione che il PRD dava all'assenza di un blocco:
"non esiste blocco, coerentemente con un gruppo chiuso e a invito". Fra persone invitate dalla
stessa persona era una scelta proporzionata; fra sconosciuti no.

Quello che oggi manca, in concreto: un rifiuto non lascia traccia visibile a chi ha chiesto e la
richiesta è reinviabile senza limite, quindi nulla impedisce a qualcuno di rimandarla
indefinitamente. Chi la subisce non ha alcun comando da usare — né un blocco, né un silenziamento,
né un limite temporale al reinvio — e la richiesta ricompare in cima a Lettori ogni volta.

Le tre strade valutate, in ordine di peso:

1. **Blocco per utente.** Una tabella con RLS, un endpoint, una riga nel profilo. Il bloccato non
   può reinviare, non trova più l'altro nella ricerca e sparisce dal suo elenco; nessuna notifica,
   coerente con "chi viene rimosso non riceve alcun avviso". È lo standard di ogni prodotto sociale
   pubblico e la sola difesa reale.
2. **Limite temporale al reinvio.** Nessuna entità nuova: dopo un rifiuto la stessa persona non può
   reinviare per un periodo, applicato lato server. Molto più leggero, ma non ferma chi insiste nel
   tempo e non toglie il proprio nome dalla sua ricerca.
3. **Niente**, che è dove siamo.

Va affrontata prima che l'istanza abbia utenti che non si conoscono fra loro. Il PRD è stato
corretto in modo da non giustificare più l'assenza con la chiusura del gruppo: la frase mentiva
sullo stato del prodotto, e una motivazione sbagliata è peggio di una lacuna dichiarata.

## Chiuso nella sessione UI

- Interfaccia bilingue (#34): le stringhe sono state estratte in `frontend/src/messaggi/it.ts`
  con chiavi stabili — restava il framework e l'inglese. Completato in una sessione successiva
  (23 agosto 2026): `next-intl`, cataloghi `frontend/messages/{it,en}.json`, backend allineato
  sulla stessa `Accept-Language` (`backend/app/core/lingua.py`). Il resto (estrazione completa,
  numeri non ancora sensibili alla lingua, contenuto assistito) è tracciato in #40.
- Il comando sulla luce, la barra di navigazione in fondo su mobile, i tre canali di
  messaggi e la riscrittura degli errori: vedi `docs/design-frontend.md` §3, §5, §8, §19.

## Issue aperte per lavoro non ancora costruito

- Acquisizione di una citazione da foto — [#32](https://github.com/filippo-pivetta/libreria/issues/32)
- Cancellazione della Voce di libreria intera — [#33](https://github.com/filippo-pivetta/libreria/issues/33)
- Rito di apertura (View Transitions) — [#35](https://github.com/filippo-pivetta/libreria/issues/35)
- Interfaccia bilingue, il resto del lavoro dopo il framework — [#40](https://github.com/filippo-pivetta/libreria/issues/40)
- URL delle pagine tutte in inglese, oggi miste con l'italiano — [#41](https://github.com/filippo-pivetta/libreria/issues/41)
