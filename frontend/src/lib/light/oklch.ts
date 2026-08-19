/**
 * Primitive OKLCH minime per il sistema di luce (design doc §3).
 * Interpolare in OKLCH invece che in sRGB tiene i mezzitoni saturi e
 * leggibili: in sRGB il passaggio fra alba e giorno darebbe un
 * mezzogiorno grigio e fangoso.
 */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolazione circolare della tinta: prende sempre la via più corta sulla ruota dei 360°. */
function lerpHue(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  return {
    l: lerp(a.l, b.l, t),
    c: lerp(a.c, b.c, t),
    h: lerpHue(a.h, b.h, t),
  };
}
