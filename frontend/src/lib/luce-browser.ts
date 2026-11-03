/* =============================================================================
 * Montaigne · la luce nel browser
 *
 * Scrive su `<html>` la luce calcolata da `lib/light.ts`. Lo usano due
 * chiamanti:
 *
 *   - `lib/luce-avvio.ts`, compilato e messo inline nell'`<head>` di
 *     `index.html` da `vite.config.ts`: gira prima del primo disegno, quindi
 *     la prima pittura è già nella stanza giusta e non c'è lampeggio;
 *   - `components/layout/luce-viva.tsx`, che la riapplica al cambio pagina e al
 *     ritorno in primo piano, e `components/profilo/scelta-luce.tsx` al cambio
 *     di preferenza.
 *
 * Nessun import di React qui: questo modulo finisce nello script inline, e ogni
 * byte in più è un byte che blocca il primo disegno.
 * ========================================================================== */

import {
  CHIAVE_LUCE,
  attributiLuce,
  preferenzaValida,
  risolviLuce,
  themeColorHex,
  type PreferenzaLuce,
} from "@/lib/light";

/** La preferenza salvata. `localStorage` può mancare o lanciare (navigazione
 * privata, dati del sito bloccati): in quel caso vale "Segui l'ora". */
export function leggiPreferenza(): PreferenzaLuce {
  try {
    return preferenzaValida(window.localStorage.getItem(CHIAVE_LUCE));
  } catch {
    return "ora";
  }
}

/** Salva la preferenza. Lancia se il browser non la conserva: il comando nel
 * Profilo deve poterlo dire invece di far finta che la scelta resti. */
export function salvaPreferenza(preferenza: PreferenzaLuce): void {
  window.localStorage.setItem(CHIAVE_LUCE, preferenzaValida(preferenza));
}

/** Calcola la luce del momento e la scrive su `<html>` e sul colore della
 * chrome del browser. */
export function applicaLuce(preferenza: PreferenzaLuce = leggiPreferenza()): void {
  const luce = risolviLuce(preferenza);
  const { "data-light": ancoraggio, style } = attributiLuce(luce);
  const radice = document.documentElement;

  radice.setAttribute("data-light", ancoraggio);
  for (const [nome, valore] of Object.entries(style)) {
    radice.style.setProperty(nome, valore);
  }
  radice.style.colorScheme = ancoraggio === "notte" ? "dark" : "light";

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColorHex(luce.palette);
}
