# 0020. Frontend come SPA React + Vite, al posto di Next.js

Stato: accettata
Data: 2026-11-03

## Contesto
Il frontend era un'applicazione Next.js 16 (App Router) che disegnava la prima pagina sul server:
Server Component con `"use cache: private"`, un Proxy che rinnovava la sessione Supabase via cookie
a ogni richiesta, la luce calcolata sul server da un cookie `httpOnly`, la lingua risolta da
`next-intl` sull'`Accept-Language` della richiesta.

Montaigne però non ha nulla che si avvantaggi di quel lavoro lato server. Sta tutta dietro login
(ADR 0006), non è indicizzabile, gira soprattutto installata sul telefono (ADR 0019), e ogni dato
viene da FastAPI, che verifica il JWT su ogni rotta (ADR 0012). Il server Next faceva da
intermediario fra il browser e il backend: ogni navigazione passava da Vercel, poi da Fly, poi da
Supabase, e una buona parte del codice esisteva per gestire quel passaggio (cache private, confini
di Suspense sopra `<html>`, regione delle funzioni allineata a quella del backend, `router.refresh`
per far ricalcolare al server ciò che il browser sapeva già).

## Decisione
Il frontend diventa una **single-page application statica**: Vite 8, React 19, React Router 8 in
modalità dati, servita da Vercel come file statici. Il backend non cambia. Il modello è quello già
in uso in altri progetti dello stesso Manutentore.

- **Dati.** React Query è l'unico strato. Le letture delle pagine stanno in `lib/dati/*` come
  `queryOptions` che restituiscono l'esito dei fetcher (`{ status: … }`) senza lanciare. Ogni rotta
  è `lazy`, e il suo loader fa partire i dati **senza aspettarli** (`rotte/precarica.ts`): codice e
  dati viaggiano insieme, la navigazione non si ferma sulla rete. Lo stesso precaricamento parte
  all'intenzione (passaggio del puntatore, tocco, focus: `components/ui/link.tsx`).
- **Sessione.** `@supabase/supabase-js` nel browser, con la sessione in `localStorage`. La guardia
  (`components/layout/require-auth.tsx`) governa solo l'interfaccia; il confine resta il backend.
- **Luce.** Stessa logica di `lib/light.ts`, ora eseguita nel browser: `vite.config.ts` compila
  `lib/luce-avvio.ts` in uno script inline in cima all'`<head>`, che scrive la luce su `<html>`
  prima del primo disegno. Si ricalcola al cambio pagina e al ritorno in primo piano, mai con un
  timer. La preferenza a tre stati sta in `localStorage` (`mtg-luce`). L'ora resta quella di Roma
  (`Intl.DateTimeFormat` con `timeZone: "Europe/Rome"`), quindi due collegati vedono ancora la
  stessa stanza alla stessa ora.
- **Lingua.** `use-intl` (il motore sotto `next-intl`, stesse API) con la lingua da
  `navigator.languages`, la stessa da cui il browser compone l'`Accept-Language` che il backend
  usa per scegliere le varianti salvate (issue #34).
- **Hosting.** `vercel.json` rimanda ogni percorso a `index.html` e porta gli header di sicurezza
  (`frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `X-Robots-Tag`) e le
  regole di cache: `/assets/*` immutabile per un anno (nomi con l'impronta del contenuto), `sw.js`
  `no-store` (è il file che decide cosa servire a tutti gli altri), `/icone/*` una settimana (un
  marchio nuovo deve poter arrivare), tutto il resto `no-cache`.
- **App installata.** `public/sw.js` resta con la stessa regola (ADR 0019: nessun dato di lettura
  in cache), con `/assets/` al posto di `/_next/static/` e `/senza-rete.html` come pagina offline,
  scritta a mano e con i testi presi dal catalogo al build. Al ritorno in primo piano l'app
  confronta `/version.json` con la versione con cui è stata costruita e, se è cambiata, ricarica.

## Ragioni
- **Navigazione immediata.** Il browser chiama direttamente il backend e tiene i dati in memoria:
  tornare su una pagina vista non costa nulla, e la prima visita parte con codice e dati in
  parallelo.
- **Meno codice di adattamento.** Spariscono il Proxy, i client Supabase per server e Proxy,
  l'inoltro manuale di `Accept-Language`, la memoization di richiesta, le direttive di cache, la
  Server Action della luce, i confini di Suspense imposti dal prerender.
- **Meno superficie che cambia sotto i piedi.** Next 16 aveva rotture rispetto alle versioni
  precedenti (`proxy.ts`, Cache Components, `retry` al posto di `reset`) che andavano rincorse.
- **Hosting statico.** Nessuna funzione sul server da tenere nella regione del backend.

## Conseguenze
- **La regola «la luce si calcola lato server» è ribaltata.** Il perché originale (§3) era evitare
  un mismatch di idratazione e il lampo della stanza sbagliata. In una SPA non c'è idratazione, e
  il lampo lo evita lo script inline, che gira prima del primo disegno. `crossesNight` e il
  controllo dei contrasti (`npm run check:contrast`) restano identici, perché la logica è la stessa.
- **Il token sta in `localStorage`** invece che in un cookie gestito dal server. Il JWT è
  comunque verificato dal backend su ogni richiesta e scade da sé; cresce l'esposizione in caso di
  XSS, che resta da prevenire come prima (nessun HTML non fidato reso come tale).
- **Il primo avvio a freddo** scarica il bundle prima di chiedere i dati. Lo attenuano il codice
  diviso per pagina, il service worker che serve `/assets/` dalla cache dopo il primo avvio, e il
  precaricamento della libreria appena la sessione c'è.
- **Prima lettura dopo l'accesso.** PostgREST confronta l'emissione del token con un orologio
  aggiornato una volta al secondo: un token usato nello stesso secondo in cui è nato torna come
  "emesso nel futuro". Con la SPA succede, perché la libreria si chiede subito dopo il login. Le
  letture di `lib/dati` riprovano una volta un guasto del server (`conUnSecondoTentativo`).
- **Al primo avvio dopo il deploy ogni utente rifà l'accesso una volta**: la sessione nel cookie di
  `@supabase/ssr` non è quella che supabase-js legge da `localStorage`.
- **Su Vercel** il progetto va impostato con framework Vite e le variabili rinominate da
  `NEXT_PUBLIC_*` a `VITE_*`; la regione delle funzioni non serve più.
