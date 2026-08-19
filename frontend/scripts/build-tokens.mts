/* =============================================================================
 * Genera src/styles/tokens.anchors.css da src/lib/light.ts.
 *
 * La palette ha una sorgente di verità sola, che è `ANCHORS` in light.ts. Il CSS
 * serve come fallback per l'idratazione e per lo sviluppo senza server: senza
 * generazione, i due file diverge­rebbero in silenzio e il difetto si vedrebbe
 * solo in una fascia oraria che nessuno guarda.
 *
 * Uso:  pnpm tokens        (package.json: "tokens": "tsx scripts/build-tokens.mts")
 * In CI: rigenerare e fallire se il file risulta modificato.
 * ========================================================================== */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ANCHORS, type Anchor, type Palette } from "../src/lib/light.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/styles/tokens.anchors.css");

const fmt = (x: { l: number; c: number; h: number; a?: number }) =>
  x.a !== undefined && x.a < 1
    ? `oklch(${x.l} ${x.c} ${x.h} / ${x.a})`
    : `oklch(${x.l} ${x.c} ${x.h})`;

function block(name: Anchor, p: Palette, selector: string): string {
  return `${selector} {
  --raw-surface-0:     ${fmt(p.surface0)};
  --raw-surface-1:     ${fmt(p.surface1)};
  --raw-surface-2:     ${fmt(p.surface2)};
  --raw-ink:           ${fmt(p.ink)};
  --raw-ink-soft:      ${fmt(p.inkSoft)};
  --raw-accent:        ${fmt(p.accent)};
  --raw-accent-strong: ${fmt(p.accentStrong)};
  --raw-alert:         ${fmt(p.alert)};
  --raw-lamp:          ${fmt(p.lamp)};
  --shadow-alpha-1: ${p.shadowAlpha1};
  --shadow-alpha-2: ${p.shadowAlpha2};
  --cover-veil: ${p.coverVeil};
}`;
}

const order: Anchor[] = ["alba", "giorno", "tramonto", "notte"];

const css = `/* GENERATO DA scripts/build-tokens.mts. NON MODIFICARE A MANO.
   La sorgente di verità è ANCHORS in src/lib/light.ts.

   Il server calcola il valore INTERPOLATO fra i due ancoraggi adiacenti e lo
   inietta come style inline su <html>, che vince su questi blocchi. Restano
   come fallback e come stato di partenza per l'idratazione.

   Non esistono un tema chiaro e un tema scuro: esiste una stanza che dal
   mattino alla notte si scurisce. Questi sono quattro momenti della stessa
   stanza, non quattro temi. */

${block("giorno", ANCHORS.giorno, ':root,\n[data-light="giorno"]')}

${order
  .filter((a) => a !== "giorno")
  .map((a) => block(a, ANCHORS[a], `[data-light="${a}"]`))
  .join("\n\n")}
`;

const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if (prev === css) {
  console.log("tokens.anchors.css già aggiornato");
} else {
  writeFileSync(OUT, css, "utf8");
  console.log(`scritto ${OUT}`);
  if (process.env.CI) {
    console.error("I token generati non erano aggiornati. Esegui `pnpm tokens` e committa.");
    process.exit(1);
  }
}
