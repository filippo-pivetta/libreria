/* =============================================================================
 * Montaigne · caratteri
 *
 * Tre famiglie, tre ruoli, tutte variabili, tutte SIL Open Font License 1.1.
 * I binari stanno in `src/fonts` e sono versionati nella repo: il browser non
 * parla mai con Google, e nemmeno il build.
 *
 * Le variabili CSS prodotte qui sono le stesse che `tokens.css` si aspetta:
 *   --font-fraunces     display: insegna, titoli di pagina, titoli dei libri
 *   --font-literata     lettura: insight, recensioni, note, testi lunghi
 *   --font-inter-tight  UI: etichette, comandi, date, numeri, metriche
 * ========================================================================== */

import localFont from "next/font/local";

/* Fraunces, assi opsz 9..144, wght 100..900, SOFT 0..100, WONK 0..1.
   Serve il file con tutti gli assi perché il design usa SOFT sui titoli. */
export const fraunces = localFont({
  src: [{ path: "../fonts/Fraunces-Variable-latin.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-fraunces",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
});

/* Literata, assi opsz 7..72, wght 200..900.
   L'asse ottico è ciò che permette a sentenza (19px) e appunto (15px) di essere
   lo stesso carattere con due voci diverse: non sostituire con il file solo-wght. */
export const literata = localFont({
  src: [
    { path: "../fonts/Literata-Variable-latin.woff2", style: "normal", weight: "200 900" },
    { path: "../fonts/Literata-Variable-Italic-latin.woff2", style: "italic", weight: "200 900" },
  ],
  variable: "--font-literata",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
});

/* Inter Tight, asse wght 100..900. Nessun corsivo: la UI non ne usa. */
export const interTight = localFont({
  src: [{ path: "../fonts/InterTight-Variable-latin.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-inter-tight",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

/** Da mettere sul className di <html> nel layout radice. */
export const fontVariables = `${fraunces.variable} ${literata.variable} ${interTight.variable}`;
