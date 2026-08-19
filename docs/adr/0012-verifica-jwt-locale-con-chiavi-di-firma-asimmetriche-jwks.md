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
