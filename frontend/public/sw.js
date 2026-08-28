/* =============================================================================
 * Montaigne · service worker
 *
 * COSA FA, E SOPRATTUTTO COSA NON FA.
 *
 * Non fa funzionare Montaigne senza rete: il funzionamento offline è fuori
 * perimetro per dichiarazione esplicita del PRD ("App native, funzionamento
 * offline, obiettivi di lettura, sfide, scaffali multipli", docs/prd.md).
 * Questo file esiste per il problema opposto, che l'installazione crea e che
 * senza un service worker non ha rimedio: un'app aperta dalla schermata home
 * non ha barra degli indirizzi né pulsante "ricarica", quindi senza rete
 * mostrerebbe la pagina d'errore del browser — un dinosauro, o un foglio
 * bianco — dentro una finestra da cui non si esce se non chiudendola.
 *
 * Qui invece serve la pagina `/senza-rete`, che è di Montaigne: dice cosa
 * manca, con le parole e la luce del resto dell'app.
 *
 * NIENTE DATI DI LETTURA IN CACHE. Mai. Non è una svista di
 * implementazione, è la regola che tiene insieme tre decisioni già prese:
 * l'accesso è sempre autenticato (docs/adr/0006), la cancellazione
 * dell'account è immediata e senza copie (docs/adr/0011), e nessuna pagina è
 * indicizzabile o leggibile senza sessione (regola 6 del PRD). Una risposta
 * dell'API conservata qui sopravviverebbe alla disconnessione, alla
 * cancellazione dell'account e al passaggio del telefono a un'altra persona.
 * Perciò dalla cache passano solo tre categorie di cose, tutte impersonali:
 *
 *   1. i file statici del build (`/_next/static/…`), che hanno l'impronta
 *      del contenuto nel nome e quindi non diventano mai obsoleti;
 *   2. le icone dell'app;
 *   3. la pagina `/senza-rete`, che non contiene nulla di nessuno.
 *
 * Tutto il resto — navigazioni, payload RSC, chiamate all'API, copertine —
 * attraversa il service worker senza lasciare traccia.
 * ========================================================================== */

/* Cambiando questo numero si svuotano tutte le cache alla prossima attivazione
   (vedi `activate` sotto): è la via per invalidare a mano ciò che il nome col
   contenuto non invalida da sé. */
const VERSIONE = "v1";

const GUSCIO = `montaigne-guscio-${VERSIONE}`;
const RIPARO = `montaigne-riparo-${VERSIONE}`;
const MIE = new Set([GUSCIO, RIPARO]);

const PAGINA_SENZA_RETE = "/senza-rete";

const ICONE = [
  "/icone/icona-192.png",
  "/icone/icona-512.png",
  "/icone/icona-mascherabile-512.png",
];

/* Un tetto al numero di file statici conservati. I nomi contengono
   l'impronta del contenuto, quindi nessuno di essi va mai "aggiornato": a
   ogni deploy si aggiungono nomi nuovi e i vecchi restano lì per sempre.
   Senza un tetto, la cache cresce a ogni deploy per tutta la vita
   dell'installazione. 120 voci coprono abbondantemente il guscio di una
   sessione (JS, CSS, i tre caratteri). */
const TETTO_GUSCIO = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const riparo = await caches.open(RIPARO);
      // `cache: "reload"` scavalca la cache HTTP del browser: senza, il
      // riparo appena installato potrebbe nascere già vecchio, copiato da
      // una risposta ferma nella cache del browser da prima del deploy.
      await riparo.addAll(ICONE.map((url) => new Request(url, { cache: "reload" })));
      await conservaRiparo();
      // Prende il posto del service worker precedente senza aspettare che
      // tutte le schede aperte si chiudano. È sicuro proprio perché qui non
      // si conservano pagine: al massimo cambia quale copia di un file
      // immutabile viene servita.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomi = await caches.keys();
      await Promise.all(
        nomi.filter((n) => n.startsWith("montaigne-") && !MIE.has(n)).map((n) => caches.delete(n)),
      );
      // La navigazione precaricata: il browser parte con la richiesta di rete
      // in parallelo all'avvio del service worker, invece di aspettarlo. Senza,
      // ogni navigazione paga l'avvio di questo file — decine di millisecondi
      // su telefono, su una richiesta che il più delle volte finisce comunque
      // in rete.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

/* Il riparo va tenuto allineato al deploy corrente: l'HTML di `/senza-rete`
   rimanda a fogli di stile e caratteri con l'impronta del build nel nome, e
   dopo un deploy quei nomi non esistono più — la pagina si vedrebbe nuda,
   proprio nel momento in cui è l'unica cosa che si vede. Si rinfresca una
   volta per ogni avvio del service worker, in coda a una navigazione andata
   a buon fine (quindi con la rete che c'è, e senza rallentare nulla). */
let riparoRinfrescato = false;

async function rinfrescaRiparo() {
  if (riparoRinfrescato) return;
  riparoRinfrescato = true;
  try {
    await conservaRiparo();
  } catch {
    // Nessun rimedio e nessun rumore: resta la copia di prima, che è
    // esattamente ciò che serviva. Si riproverà al prossimo avvio.
    riparoRinfrescato = false;
  }
}

/**
 * Scarica `/senza-rete` e la mette al riparo — insieme a ciò senza cui è una
 * pagina nuda.
 *
 * Il "insieme a" non è zelo. L'HTML della pagina rimanda al foglio di stile e
 * ai tre caratteri con l'impronta del build nel nome, e quei file di norma
 * arrivano dalla cache HTTP del browser anche senza rete (Next li serve
 * `immutable`) — ma quella cache il browser la svuota quando gli pare, di
 * solito quando lo spazio sul telefono finisce, che è esattamente il tipo di
 * giornata in cui poi manca anche la rete. Senza, resterebbe il testo giusto
 * in Times su fondo bianco: l'unica schermata di Montaigne che non sembra
 * Montaigne, servita nel momento peggiore.
 *
 * Si prendono i `.css` e i `.woff2`, e si riconoscono dall'estensione, non
 * dalla cartella: in Next 16 il foglio di stile sta in
 * `/_next/static/chunks/`, insieme al JavaScript, e una regola scritta sulla
 * cartella (`/css/`, com'era in Next 15) non trova più niente senza dirlo.
 *
 * Il JavaScript invece si lascia fuori apposta: la pagina è scritta per
 * funzionare senza (vedi il commento in testa a
 * `src/app/(public)/senza-rete/page.tsx`), e precaricarlo vorrebbe dire
 * scaricare mezzo guscio dell'app a ogni installazione.
 */
async function conservaRiparo() {
  const risposta = await fetch(new Request(PAGINA_SENZA_RETE, { cache: "reload" }));
  if (!risposta.ok) throw new Error(`/senza-rete: ${risposta.status}`);

  const html = await risposta.clone().text();
  await (await caches.open(RIPARO)).put(PAGINA_SENZA_RETE, risposta);

  const guscio = await caches.open(GUSCIO);
  const percorsi = new Set();
  // La barra rovesciata è esclusa perché l'HTML di Next contiene gli stessi
  // percorsi anche dentro stringhe JSON, dove le virgolette sono sfuggite
  // (`\"/_next/…\"`): senza escluderla, il percorso finiva in cache con una
  // `\` in coda — che il parser di URL trasforma in `/`, quindi la voce non
  // corrispondeva mai a nulla e non se ne accorgeva nessuno.
  for (const [, percorso] of html.matchAll(
    /["'(](\/_next\/static\/[^"'()?\s\\]+\.(?:css|woff2))/g,
  )) {
    percorsi.add(percorso);
  }

  await Promise.all(
    [...percorsi].map(async (percorso) => {
      if (await guscio.match(percorso)) return;
      try {
        const file = await fetch(new Request(percorso, { cache: "reload" }));
        if (file.ok) await guscio.put(percorso, file);
      } catch {
        // Un carattere in meno non vale il fallimento dell'installazione.
      }
    }),
  );
  await pota(guscio);
}

self.addEventListener("fetch", (event) => {
  const richiesta = event.request;
  if (richiesta.method !== "GET") return;

  const url = new URL(richiesta.url);
  // Fuori origine non si tocca niente: Supabase, i cataloghi esterni, le
  // copertine remote. Passano al browser come se questo file non ci fosse.
  if (url.origin !== self.location.origin) return;

  if (richiesta.mode === "navigate") {
    event.respondWith(navigazione(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icone/")) {
    event.respondWith(guscio(richiesta));
    return;
  }

  // Tutto il resto — `?_rsc=`, API, dati — non passa di qui.
});

async function navigazione(event) {
  try {
    // Prima la risposta già avviata dal browser (navigation preload), se c'è.
    const precaricata = await event.preloadResponse;
    const risposta = precaricata ?? (await fetch(event.request));
    event.waitUntil(rinfrescaRiparo());
    return risposta;
  } catch {
    const riparo = await caches.open(RIPARO);
    const senzaRete = await riparo.match(PAGINA_SENZA_RETE);
    // Se anche il riparo mancasse (installazione interrotta a metà) resta la
    // pagina d'errore del browser: peggio di così non si può fare, ma non si
    // finge nemmeno che l'app funzioni.
    return senzaRete ?? Response.error();
  }
}

async function guscio(richiesta) {
  // `caches.match` e non `cache.match`: cerca in tutte le cache, quindi le
  // icone già precaricate nel riparo si servono da lì invece di finire
  // conservate una seconda volta nel guscio.
  const conservata = await caches.match(richiesta);
  if (conservata) return conservata;

  const cache = await caches.open(GUSCIO);
  const risposta = await fetch(richiesta);
  // Solo le risposte intere e valide: una 206 (richiesta parziale) o una
  // risposta opaca in cache si ripresenterebbe troncata a ogni visita.
  if (risposta.ok && risposta.status === 200 && risposta.type === "basic") {
    await cache.put(richiesta, risposta.clone());
    await pota(cache);
  }
  return risposta;
}

/* `cache.keys()` restituisce le voci nell'ordine in cui sono state inserite:
   le più vecchie stanno in testa, e sono quelle dei build passati. */
async function pota(cache) {
  const chiavi = await cache.keys();
  const eccesso = chiavi.length - TETTO_GUSCIO;
  if (eccesso > 0) await Promise.all(chiavi.slice(0, eccesso).map((k) => cache.delete(k)));
}
