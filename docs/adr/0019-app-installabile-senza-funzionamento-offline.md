# 0019. App installabile, senza funzionamento offline

Stato: accettata
Data: 2026-08-28

## Contesto
Il manifesto (`frontend/src/app/manifest.ts`) c'era da tempo, ma l'app non era installabile: dichiarava una sola icona, `favicon.ico`, e Chrome non offre "installa" senza un PNG da 192 e uno da 512. Il pulsante non è mai comparso a nessuno.

Rendere installabile un'applicazione, però, non è solo aggiungere due immagini: cambia il modo in cui la si apre. Un'app lanciata dalla schermata home non ha barra degli indirizzi né pulsante "ricarica". Se al primo avvio manca la rete, quello che si vede è la pagina d'errore del browser — il dinosauro di Chrome, un foglio bianco su iOS — dentro una finestra da cui non si esce se non chiudendola. Con la barra degli indirizzi quella schermata è un fastidio; senza, è l'app che sembra rotta.

Nel frattempo `docs/prd.md` mette il "funzionamento offline" tra le cose fuori perimetro, insieme alle app native e agli obiettivi di lettura. La domanda che questo ADR risolve non è quindi "installabile sì o no", ma dove passa il confine fra rendere l'app installabile e cominciare a farla funzionare senza rete.

## Decisione
Montaigne diventa installabile — manifesto completo, tre icone generate dal marchio (`frontend/scripts/build-icone.mts`, `npm run icone`) — e registra un service worker (`frontend/public/sw.js`) il cui unico compito è **avere una pagina da mostrare quando la rete non c'è**: `/senza-rete`, due righe e un collegamento, con le parole e la luce del resto dell'app.

Non funziona offline, e il confine è tracciato da una regola sola: **in cache non entra nulla che riguardi qualcuno.** Ci finiscono solo tre categorie di file impersonali — i file statici del build (`/_next/static/…`, che hanno l'impronta del contenuto nel nome), le icone, e la pagina `/senza-rete`. Navigazioni, payload RSC, chiamate all'API e copertine attraversano il service worker senza lasciare traccia.

La regola non è prudenza generica: una risposta dell'API conservata lì sopravviverebbe alla disconnessione, alla cancellazione dell'account — che è immediata e senza copie (ADR 0011) — e al passaggio del telefono a un'altra persona, in un prodotto in cui nulla è leggibile senza sessione (ADR 0006, regola 6 del PRD).

Ne segue anche che `sw.js` e `/senza-rete` stanno fuori dalla guardia di autenticazione (l'elenco di esclusioni in `frontend/src/proxy.ts`): il primo perché il browser lo richiede fuori dal contesto della pagina e riceverebbe l'HTML del login al posto di JavaScript; la seconda perché una pagina che deve comparire quando il server non si raggiunge non può dipendere da una sessione che quel server dovrebbe validare. Nessuna delle due espone alcun dato.

## Alternative scartate
**Le icone e basta, senza service worker.** Sarebbe bastato per far comparire "installa", ed è la scorciatoia più diffusa. Ma è proprio l'installazione a creare il problema del dinosauro: si sarebbe consegnata l'icona sulla schermata home e, insieme, l'unico modo di incontrare quella schermata senza via d'uscita.

**Offline vero: cache dei dati di lettura, coda delle scritture, sincronizzazione al ritorno della rete.** È la cosa che il PRD esclude, ed è molto più di una decisione tecnica — vuol dire conservare la libreria di qualcuno sul dispositivo e decidere cosa fare di due modifiche in conflitto. Se un giorno servirà, sarà un ADR suo, non un effetto collaterale di questo.

**`next-pwa` o Serwist.** Generano il service worker e il suo manifesto di precache dal build. Portano una dipendenza e un passaggio di build per un file che qui è lungo un centinaio di righe, e per giunta con il valore predefinito sbagliato per questo prodotto: conservano l'HTML delle pagine, cioè esattamente ciò che qui non deve entrare in cache. Scriverlo a mano costa meno che disattivarne i comportamenti.

**`experimental.useOffline` di Next 16.** Risolve un problema diverso e complementare: tiene in sospeso — invece di far fallire — le navigazioni soft e le Server Action mentre la rete manca, dentro una pagina già aperta. Non serve al caso di questo ADR (l'avvio a freddo dell'app installata, che ha bisogno di HTML da qualche parte) ed è dichiarato sperimentale. Resta un candidato ragionevole per il giorno in cui si vorrà curare anche la rete che cade a metà sessione.

## Conseguenze
- Le icone si rigenerano con `npm run icone` e sono versionate: lo script ha bisogno di Chrome in locale, non gira nel build né in CI.
- Cambiando ciò che il service worker conserva, va alzata la costante `VERSIONE` in `frontend/public/sw.js`: è ciò che svuota le cache vecchie alla prossima attivazione.
- La pagina `/senza-rete` mostra la luce (design-frontend.md §3) del momento in cui è stata messa in cache, non quella dell'ora in cui la si legge. Non c'è modo di evitarlo senza chiedere al server che ora è, cioè senza la rete che lì manca.
- Chi sviluppa non ha il service worker attivo: in `next dev` viene disinstallato invece che registrato (`frontend/src/components/layout/registra-service-worker.tsx`), perché conserva `/_next/static/…` dando per scontato che quei nomi siano immutabili — vero nel build, falso in sviluppo.
