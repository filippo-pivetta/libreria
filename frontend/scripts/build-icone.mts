/* =============================================================================
 * Le icone dell'app installata.
 *
 * Fino a qui il marchio esisteva in due misure sole — `src/app/favicon.ico`
 * (16/32) e `src/app/apple-icon.png` (180) — e nessuna delle due basta a
 * un'installazione: Chrome pretende un PNG da 192 e uno da 512 nel manifesto
 * prima di offrire "installa", e Android ne vuole una terza versione
 * *mascherabile*, cioè con il fondo che arriva al bordo, perché il lanciatore
 * ritaglia lui la forma (cerchio, goccia, squircle — cambia da telefono a
 * telefono) e su un'icona con gli angoli già arrotondati e trasparenti
 * ritaglierebbe gli angoli due volte.
 *
 * Perché rigenerarle invece di ingrandire il PNG che c'era: 180 → 512 è un
 * ingrandimento di quasi tre volte, e su una lettera fatta di aste dritte e
 * grazie sottili la sfocatura si vede tutta, proprio nella misura che Android
 * usa più grande di tutte (lo schermo di avvio).
 *
 * I valori qui sotto non sono inventati: sono misurati sull'icona storica
 * (`src/app/apple-icon.png`), decodificandone i pixel — fondo #2B2018,
 * lettera #F7F3EC, altezza della M pari al 44,4% del lato. Ne segue che la M
 * dell'icona è Fraunces con `wght` 900 e `opsz` 9: rendendola con quegli assi
 * il riquadro della lettera torna a 106×79 px contro i 110×80 dell'originale.
 * L'icona storica resta dov'è, intatta: questo script non la tocca.
 *
 * ATTENZIONE all'asse `wght`. Va dichiarato dentro `font-variation-settings`
 * e non con `font-weight`: quando la proprietà è presente vince lei, e un
 * `font-weight: 900` accanto a un `font-variation-settings` che non nomina
 * `wght` viene ignorato in silenzio — la lettera esce a peso 400 e sembra
 * solo "un po' diversa" invece che sbagliata. È successo scrivendo questo
 * file.
 *
 * COME SI ESEGUE: `npm run icone`. Non gira nel build (a differenza di
 * `npm run tokens`) e non gira in CI: ha bisogno di Chrome installato in
 * locale, e i PNG che produce sono versionati nella repo. Si rilancia solo
 * se cambia il marchio — colore, lettera, proporzione.
 *
 * Perché Chrome e non una libreria di rendering: i caratteri della repo sono
 * woff2 (`src/fonts/`), e woff2 è esattamente il formato che satori/resvg —
 * la via che Next offre con `next/og` — non sanno leggere. Chrome invece è
 * l'unico motore che disegna quella M esattamente come la disegna nell'app,
 * assi variabili compresi, ed è già sulla macchina di chi sviluppa.
 * ========================================================================== */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Il fondo e la lettera, letti dai pixel di `src/app/apple-icon.png`. */
const FONDO = "#2B2018";
const LETTERA = "#F7F3EC";

/** Altezza della M (dalla linea di base all'altezza delle maiuscole) in
 * frazione del lato dell'icona: 80/180 nell'icona storica. */
const ALTEZZA_M = 0.444;

/** Raggio degli angoli, sempre in frazione del lato: è il valore che usa iOS
 * per le sue icone (22,37% ≈ il "superellisse" di Apple approssimato da un
 * raggio semplice), e coincide con quello dell'icona storica. */
const RAGGIO = 0.2237;

/** Altezza delle maiuscole di Fraunces in frazione del corpo (em). Serve a
 * ricavare il corpo dall'altezza voluta: `text-box-trim` sotto ritaglia il
 * riquadro del testo alle maiuscole, quindi è questo rapporto — non
 * l'interlinea — a decidere quanto grande esce la M. Misurato rendendo la
 * lettera a corpo noto e leggendo il riquadro nei pixel: 79 px su un corpo
 * di 111,6. */
const CAP_PER_EM = 0.716;

/** La zona sicura di un'icona mascherabile è il cerchio centrale di diametro
 * pari all'80% del lato: fuori di lì il lanciatore può tagliare. La lettera
 * quindi rimpicciolisce della stessa frazione, il fondo invece arriva al
 * bordo e gli angoli non si arrotondano — ci pensa la maschera. */
const ZONA_SICURA = 0.8;

type Icona = { file: string; lato: number; mascherabile: boolean };

const ICONE: Icona[] = [
  { file: "icona-192.png", lato: 192, mascherabile: false },
  { file: "icona-512.png", lato: 512, mascherabile: false },
  { file: "icona-mascherabile-512.png", lato: 512, mascherabile: true },
];

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function pagina({ lato, mascherabile }: Icona, carattere: string): string {
  const corpo = (lato * ALTEZZA_M * (mascherabile ? ZONA_SICURA : 1)) / CAP_PER_EM;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {
  font-family: Fraunces;
  src: url(data:font/woff2;base64,${carattere}) format("woff2");
  font-weight: 100 900;
  /* "block" e non "swap": se il carattere non fosse pronto al momento dello
     scatto, "swap" disegnerebbe la M in Times e lo screenshot sarebbe muto
     sull'errore. Così invece la lettera non compare affatto. */
  font-display: block;
}
html, body { margin: 0; padding: 0; background: transparent; }
.icona {
  width: ${lato}px; height: ${lato}px;
  background: ${FONDO};
  border-radius: ${mascherabile ? 0 : lato * RAGGIO}px;
  display: flex; align-items: center; justify-content: center;
}
.emme {
  font-family: Fraunces;
  color: ${LETTERA};
  /* Vedi l'avvertenza in testa al file: 'wght' qui dentro, mai come
     font-weight accanto. */
  font-variation-settings: "wght" 900, "opsz" 9, "SOFT" 20, "WONK" 0;
  font-size: ${corpo.toFixed(2)}px;
  line-height: 1;
  /* Ritaglia il riquadro del testo all'altezza delle maiuscole: senza,
     centrare vorrebbe dire centrare l'interlinea — la M finirebbe un paio di
     punti sopra il centro ottico, come succede a metà delle icone-lettera in
     circolazione. */
  text-box-trim: trim-both;
  text-box-edge: cap alphabetic;
}
</style></head><body><div class="icona"><span class="emme">M</span></div></body></html>`;
}

const radice = new URL("..", import.meta.url).pathname;
const carattere = readFileSync(join(radice, "src/fonts/Fraunces-Variable-latin.woff2")).toString(
  "base64",
);
const destinazione = join(radice, "public/icone");
mkdirSync(destinazione, { recursive: true });

const lavoro = join(tmpdir(), `montaigne-icone-${process.pid}`);
mkdirSync(lavoro, { recursive: true });

try {
  for (const icona of ICONE) {
    const html = join(lavoro, `${icona.file}.html`);
    writeFileSync(html, pagina(icona, carattere));
    const uscita = join(destinazione, icona.file);

    execFileSync(
      CHROME,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        // Senza, il fondo della finestra è bianco opaco e gli angoli
        // arrotondati diventerebbero quattro triangoli bianchi.
        "--default-background-color=00000000",
        // Lo scatto non aspetta `document.fonts.ready`: questo dà al tempo
        // della pagina un budget da consumare subito, entro cui il woff2
        // (che è già in memoria, come data URI) viene decodificato.
        "--virtual-time-budget=3000",
        `--window-size=${icona.lato},${icona.lato}`,
        `--screenshot=${uscita}`,
        `file://${html}`,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );

    const peso = statSync(uscita).size;
    if (peso < 500) throw new Error(`${icona.file}: PNG sospetto (${peso} byte)`);
    console.log(`${icona.file.padEnd(30)} ${icona.lato}×${icona.lato}  ${peso} byte`);
  }
} finally {
  rmSync(lavoro, { recursive: true, force: true });
}
