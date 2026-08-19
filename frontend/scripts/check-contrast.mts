/* =============================================================================
 * Verifica di contrasto sulla luce continua.
 *
 * Controllare i quattro ancoraggi NON basta: ognuno preso da solo è a norma,
 * ma le posizioni intermedie no. Questo script campiona ogni dieci minuti su un
 * anno intero, ricalcola la palette interpolata e verifica che il testo resti
 * leggibile in ogni istante.
 *
 * Uso:  pnpm check:contrast   ("tsx scripts/check-contrast.mts")
 * Va in CI: è l'unico modo per accorgersi che un valore toccato a mano rompe
 * una fascia oraria che nessuno guarda mai.
 * ========================================================================== */

import { currentPalette, type Oklch } from "../src/lib/light.js";

const MIN_BODY = 4.5;   // AA su testo normale
const MIN_LARGE = 3.0;  // AA su testo grande

function oklchToSrgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  const enc = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return [enc(r), enc(g), enc(bl)];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(oklchToSrgb(a));
  const lb = relativeLuminance(oklchToSrgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

type Check = { name: string; min: number; pick: (p: ReturnType<typeof currentPalette>) => [Oklch, Oklch] };

const CHECKS: Check[] = [
  { name: "ink su surface-1",           min: MIN_BODY,  pick: (p) => [p.ink, p.surface1] },
  { name: "ink su surface-0",           min: MIN_BODY,  pick: (p) => [p.ink, p.surface0] },
  { name: "ink su surface-2",           min: MIN_BODY,  pick: (p) => [p.ink, p.surface2] },
  { name: "ink-soft su surface-1",      min: MIN_BODY,  pick: (p) => [p.inkSoft, p.surface1] },
  { name: "ink-soft su surface-0",      min: MIN_BODY,  pick: (p) => [p.inkSoft, p.surface0] },
  { name: "accent-strong su surface-1", min: MIN_BODY,  pick: (p) => [p.accentStrong, p.surface1] },
  { name: "alert su surface-0",         min: MIN_LARGE, pick: (p) => [p.alert, p.surface0] },
];

const worst = new Map<string, { ratio: number; when: string }>();

for (let day = 0; day < 365; day++) {
  for (let min = 0; min < 1440; min += 10) {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() + day);
    d.setUTCMinutes(min);
    const p = currentPalette(d);
    for (const chk of CHECKS) {
      const [fg, bg] = chk.pick(p);
      const r = contrast(fg, bg);
      const prev = worst.get(chk.name);
      if (!prev || r < prev.ratio) {
        worst.set(chk.name, {
          ratio: r,
          when: d.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }),
        });
      }
    }
  }
}

let failed = false;
for (const chk of CHECKS) {
  const w = worst.get(chk.name)!;
  const ok = w.ratio >= chk.min;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok  " : "ROTTO"} ${chk.name.padEnd(26)} minimo ${w.ratio.toFixed(2)}:1 (soglia ${chk.min}) il ${w.when}`
  );
}

if (failed) {
  console.error("\nUn valore della palette rompe il contrasto in almeno una fascia oraria.");
  process.exit(1);
}
console.log("\nContrasto a norma in ogni istante dell'anno.");
