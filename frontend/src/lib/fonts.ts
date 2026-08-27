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
   lo stesso carattere con due voci diverse: non sostituire con il file solo-wght.

   IL CORSIVO NON È PIÙ CARICATO (27 agosto 2026, sessione sulle prestazioni).
   Il file c'è ancora in `src/fonts`, ma non è più dichiarato qui: erano 111 KB
   — il 29% del peso dei caratteri — messi in `preload` su ogni pagina e non
   usati da nessuna parte. Verificato prima di toglierlo: nessuna regola
   `font-style: italic` in `tokens.css`, nessuna classe `italic` in
   `src/components` o `src/app`, e `docs/design-frontend.md` non nomina il
   corsivo in nessun punto.
   Il giorno che il design lo vorrà, si rimette la riga `style: "italic"` qui
   sotto e torna: è una riga, e il binario è già versionato. Finché quel
   giorno non arriva, un eventuale corsivo scritto per distrazione uscirà
   obliquo per sintesi del browser invece che nel disegno vero — differenza
   visibile a chi la cerca, e comunque preferibile a spedirlo a tutti per
   nessuno. */
export const literata = localFont({
  src: [{ path: "../fonts/Literata-Variable-latin.woff2", style: "normal", weight: "200 900" }],
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
