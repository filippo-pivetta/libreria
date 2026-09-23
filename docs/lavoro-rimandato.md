# Lavoro rimandato

Punti di design non ancora costruiti e senza priorità per aprire un'issue dedicata adesso.
Le voci con un'issue propria sono tracciate lì, non qui.

## Azioni rapide dal volume

Registrare un avanzamento o cambiare stato con un tocco lungo (mobile) senza aprire la scheda del
libro. Con la copertina vera lo spazio libero sul volume è ridotto rispetto al vecchio dorso, il
gesto va ridisegnato da zero. Oggi il volume è solo un link alla scheda.

## Nessuna difesa dalle richieste indesiderate

**Decisione consapevole di non costruire, non una svista.** Fra persone invitate dalla stessa
persona un blocco è un'arma sproporzionata, ed è per questo che non c'è.

Quello che manca, in concreto: un rifiuto non lascia traccia visibile a chi ha chiesto e la
richiesta è reinviabile senza limite, quindi nulla impedisce a qualcuno di rimandarla
indefinitamente. Chi la subisce non ha alcun comando da usare — né blocco, né silenziamento, né
limite temporale al reinvio — e la richiesta ricompare in cima a Lettori ogni volta.

Le tre strade valutate, in ordine di peso:

1. **Blocco per utente.** Una tabella con RLS, un endpoint, una riga nel profilo. Il bloccato non
   può reinviare, non trova più l'altro nella ricerca e sparisce dal suo elenco; nessuna notifica,
   coerente con "chi viene rimosso non riceve alcun avviso". È la sola difesa reale.
2. **Limite temporale al reinvio.** Nessuna entità nuova: dopo un rifiuto la stessa persona non
   può reinviare per un periodo, applicato lato server. Molto più leggero, ma non ferma chi
   insiste nel tempo e non toglie il proprio nome dalla sua ricerca.
3. **Niente**, che è dove siamo.

Va affrontata se l'istanza smette di essere una cerchia di persone che si conoscono fra loro.

## L'app installata: due cose lasciate fuori

Montaigne è installabile e ha una pagina propria quando la rete manca (ADR 0019). Restano fuori
due cose, entrambe per scelta:

- **Nessun invito a installare su iOS.** Su Android il browser offre "installa" da sé, appena il
  manifesto è valido; Safari no, l'unica via è "Condividi → Aggiungi a Home" e nessun sito può
  aprirla o suggerirla se non con un cartellino scritto a mano. Costruirlo vuol dire decidere dove
  vive, quando compare e come si congeda per sempre — cioè un pezzo di prodotto che
  `docs/design-frontend.md` non descrive.
- **La rete che cade a metà sessione.** Oggi una navigazione o un salvataggio falliti mentre l'app
  è già aperta danno il messaggio d'errore del catalogo, che è onesto ma è tutto. Next 16 offre
  `experimental.useOffline`: tiene la richiesta in sospeso e la ripete quando la connessione
  torna, più un `useOffline()` per dirlo a schermo. Quando non sarà più sperimentale, vale la
  prova.

## Interfaccia bilingue: il perimetro che resta

I messaggi (errori, rassicurazioni, rimedi, regole, assenze, accesso, sessione, titoli, avvisi,
conferme, attesa) sono tutti nel catalogo `frontend/messages/{it,en}.json`. Comandi, etichette e
intestazioni restano inline in italiano: perimetro deliberato, non debito dimenticato. Insieme ai
numeri non ancora sensibili alla lingua e al contenuto assistito, è tracciato in
[#40](https://github.com/filippo-pivetta/libreria/issues/40).

## Issue aperte per lavoro non ancora costruito

- Acquisizione di una citazione da foto — [#32](https://github.com/filippo-pivetta/libreria/issues/32)
- Rito di apertura (View Transitions) — [#35](https://github.com/filippo-pivetta/libreria/issues/35)
- Interfaccia bilingue, il resto del lavoro dopo il framework — [#40](https://github.com/filippo-pivetta/libreria/issues/40)
- URL delle pagine tutte in inglese, oggi miste con l'italiano — [#41](https://github.com/filippo-pivetta/libreria/issues/41)
