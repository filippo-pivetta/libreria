# 0012. Verifica JWT locale con chiavi di firma asimmetriche (JWKS)

Stato: accettata
Data: 2026-08-18

## Contesto
Nessuna verifica del token di sessione esiste ancora nel back end: l'unica route oggi è `/health`, che non tocca dati utente. Introdurla è il prerequisito di questa issue (autenticazione, sessione, identità) ed è quindi il momento di scegliere lo schema definitivo, prima che esistano endpoint da riscrivere. Supabase pubblica due schemi di firma per i JWT che emette: un segreto simmetrico condiviso (HS256, il percorso storico, ora legacy) e chiavi di firma asimmetriche pubblicate su un endpoint JWKS (`/auth/v1/.well-known/jwks.json`), verificabili senza possedere alcun segreto. Il progetto, sia in locale sia sulla piattaforma hosted, è oggi ancora sul percorso legacy.

## Decisione
Il back end verifica il token localmente con chiavi di firma asimmetriche ES256: scarica e cachea le chiavi pubbliche dall'endpoint JWKS del progetto, seleziona quella giusta tramite il `kid` dichiarato nell'header del token, e verifica firma, issuer, audience e scadenza senza alcuna chiamata di rete a Supabase per singola richiesta. Il progetto Supabase, locale e hosted, viene migrato dal segreto simmetrico legacy alle chiavi di firma asimmetriche prima di introdurre questa verifica.

## Alternative scartate
**Restare sul segreto simmetrico legacy (HS256).** Più semplice da configurare oggi, ma è il percorso che Supabase sta deprecando: andrebbe comunque rifatto più avanti, quando ci saranno endpoint reali da riscrivere invece di un solo prerequisito da introdurre.

**Verificare chiamando `GET /auth/v1/user` a ogni richiesta.** Elimina la gestione delle chiavi, ma aggiunge un giro di rete e un punto di fallimento esterno a ogni richiesta autenticata del prodotto, non solo al login.

**Chiavi asimmetriche RS256 invece di ES256.** Ugualmente supportate, ma la CLI di Supabase le presenta come alternativa, non come raccomandazione, a parità di garanzie.

## Conseguenze
Nessun segreto condiviso da custodire nel back end. La rotazione delle chiavi lato Supabase non richiede coordinamento: basta il ciclo di refresh della cache locale delle chiavi pubbliche. Il progetto hosted richiede una migrazione una tantum dal dashboard (Project Settings → JWT Keys) prima del primo deploy che usa questa verifica, e il progetto locale richiede una chiave di firma generata e mai committata. Invertire questa decisione significa tornare a un segreto condiviso da distribuire e ruotare manualmente.

---

## Emendamento del 27 agosto 2026 — la stessa verifica anche nel front end

Stato: accettata

### Cosa cambia
`src/proxy.ts` (via `src/lib/supabase/proxy.ts`) e `src/app/(protected)/layout.tsx` verificavano la sessione con `supabase.auth.getUser()`. Ora usano `supabase.auth.getClaims()`.

### Perché
`getUser()` interroga il server di autenticazione via rete a ogni invocazione. Le due chiamate erano **in serie** — prima il Proxy, poi il layout dell'area protetta — e si pagavano su **ogni navigazione** dell'area protetta, prima che il rendering potesse cominciare.

È esattamente l'alternativa che questo ADR aveva già scartato per il back end, terza voce qui sopra: *«Verificare chiamando `GET /auth/v1/user` a ogni richiesta. Elimina la gestione delle chiavi, ma aggiunge un giro di rete e un punto di fallimento esterno a ogni richiesta autenticata del prodotto, non solo al login.»*

Quel ragionamento non era mai stato applicato al front end, che nel frattempo faceva la cosa scartata due volte per pagina. Questo emendamento non ribalta la decisione del 18 agosto: la estende alla metà del sistema che era rimasta fuori.

`getClaims()` è ciò che rende possibile l'estensione: dove il progetto firma con chiavi asimmetriche — cioè la decisione presa qui — verifica la firma in locale con la WebCrypto API, scaricando il JWKS una volta e tenendolo in cache. È la stessa cosa che `app/core/security.py` fa in Python con PyJWKClient.

### Cosa NON cambia
- **Il refresh della sessione.** `getClaims()` rinnova il token quando sta per scadere, prima di verificarlo. Il Proxy continua a fare il lavoro per cui esiste (`updateSession`), e i Server Component continuano a ricevere un token valido.
- **Il confine di sicurezza.** Non era e non è questo controllo. Il commento in `proxy.ts` lo diceva già: *«Redirect di rotta, non un confine di sicurezza: quale dato ciascuno vede resta deciso dalla RLS nel database (docs/adr/0001)»*. La difesa in profondità resta a tre livelli — Proxy, layout, RLS — e solo il costo dei primi due scende.
- **La fiducia nel cookie.** `getSession()` continua a NON essere una fonte di identità attendibile da sola. Nel layout viene chiamata solo *dopo* che `getClaims()` ha verificato la firma, per leggere un token già validato: lo stesso ordine che prima era garantito da `getUser()`.

### Il compromesso, dichiarato
Una verifica locale accetta il token fino alla sua scadenza (circa un'ora) invece di interrogare il server a ogni richiesta. Una sessione revocata a metà di quella finestra continua quindi a passare il controllo di rotta fino alla scadenza del token.

Questo compromesso **era già stato accettato** da questo ADR per il back end, che serve i dati veri; estenderlo al front end, che decide solo se mostrare una shell o un redirect, non allarga l'esposizione — la restringe a una superficie meno importante di quella su cui era già in vigore. E la revoca resta comunque efficace dove conta: la RLS valuta `auth.uid()` sul token a ogni query, e il back end rifiuta un token scaduto.

### Nota operativa
Su un ambiente effimero che non riusa il processo tra una richiesta e l'altra, la cache del JWKS si perde e va riscaricata. Su Vercel le invocazioni calde riusano l'istanza, quindi il caso si presenta solo sui cold start; Supabase serve inoltre quell'endpoint da una cache di edge. Il guadagno resta, ma non è "zero rete in ogni caso": è "zero rete a regime".
