/* =============================================================================
 * Montaigne · calcolo della luce
 *
 * Il PRD fissa il fuso CET uguale per tutti gli Utenti, indipendentemente da
 * dove si trovino. Questo modulo gira SOLO lato server: calcolarlo nel browser
 * produrrebbe un mismatch di idratazione in Next.js, e due collegati devono
 * vedere la stessa stanza alla stessa ora.
 *
 * Alba e tramonto vengono da una tabella a latitudine fissa (43°N, Italia
 * centrale), non dalla posizione dell'utente. È una decisione, non
 * un'approssimazione: la posizione dell'utente renderebbe la stanza diversa
 * per due persone che guardano la stessa libreria nello stesso momento.
 *
 * Il valore si aggiorna al cambio pagina, mai con un timer.
 * ========================================================================== */

export type Anchor = "alba" | "giorno" | "tramonto" | "notte";

export type Oklch = { l: number; c: number; h: number; a?: number };

export type Palette = {
  surface0: Oklch;
  surface1: Oklch;
  surface2: Oklch;
  ink: Oklch;
  inkSoft: Oklch;
  accent: Oklch;
  accentStrong: Oklch;
  alert: Oklch;
  /** La mensola dello scaffale (design-frontend.md §7). DEVE restare più
   * scura di surface0 nei quattro ancoraggi — verificato da
   * scripts/check-contrast.mts — altrimenti il ripiano legge come una
   * striscia di luce e i libri sembrano fluttuare. */
  shelf: Oklch;
  lamp: Oklch;
  shadowAlpha1: number;
  shadowAlpha2: number;
  coverVeil: number;
};

/* -----------------------------------------------------------------------------
 * I quattro ancoraggi.
 *
 * QUESTA È LA SORGENTE DI VERITÀ della palette. `src/styles/tokens.anchors.css`
 * è generato da qui da `scripts/build-tokens.mts` e non va modificato a mano.
 *
 * Contrasti verificati: ink su surface1 fra 12.5:1 e 14.3:1; inkSoft su
 * surface1 mai sotto 6.0:1; accentStrong su surface1 mai sotto 6.1:1.
 * -------------------------------------------------------------------------- */

export const ANCHORS: Record<Anchor, Palette> = {
  alba: {
    surface0: { l: 0.885, c: 0.020, h: 55 },
    surface1: { l: 0.950, c: 0.014, h: 60 },
    surface2: { l: 0.975, c: 0.012, h: 62 },
    ink: { l: 0.270, c: 0.024, h: 45 },
    inkSoft: { l: 0.455, c: 0.020, h: 50 },
    accent: { l: 0.620, c: 0.115, h: 55 },
    accentStrong: { l: 0.470, c: 0.110, h: 58 },
    alert: { l: 0.530, c: 0.170, h: 27 },
    shelf: { l: 0.610, c: 0.042, h: 48 },
    lamp: { l: 0.960, c: 0.045, h: 50, a: 0.50 },
    shadowAlpha1: 0.16,
    shadowAlpha2: 0.24,
    coverVeil: 0,
  },
  giorno: {
    surface0: { l: 0.912, c: 0.014, h: 78 },
    surface1: { l: 0.965, c: 0.010, h: 84 },
    surface2: { l: 0.985, c: 0.008, h: 86 },
    ink: { l: 0.255, c: 0.022, h: 58 },
    inkSoft: { l: 0.455, c: 0.018, h: 62 },
    accent: { l: 0.635, c: 0.105, h: 76 },
    accentStrong: { l: 0.470, c: 0.100, h: 72 },
    alert: { l: 0.545, c: 0.170, h: 27 },
    shelf: { l: 0.640, c: 0.038, h: 62 },
    lamp: { l: 0.985, c: 0.030, h: 85, a: 0.55 },
    shadowAlpha1: 0.18,
    shadowAlpha2: 0.28,
    coverVeil: 0,
  },
  tramonto: {
    surface0: { l: 0.855, c: 0.028, h: 62 },
    surface1: { l: 0.930, c: 0.020, h: 68 },
    surface2: { l: 0.955, c: 0.016, h: 70 },
    ink: { l: 0.265, c: 0.026, h: 50 },
    inkSoft: { l: 0.445, c: 0.022, h: 55 },
    accent: { l: 0.630, c: 0.125, h: 62 },
    accentStrong: { l: 0.455, c: 0.115, h: 62 },
    alert: { l: 0.535, c: 0.170, h: 27 },
    shelf: { l: 0.580, c: 0.050, h: 55 },
    lamp: { l: 0.930, c: 0.060, h: 58, a: 0.62 },
    shadowAlpha1: 0.20,
    shadowAlpha2: 0.32,
    coverVeil: 0.04,
  },
  notte: {
    surface0: { l: 0.185, c: 0.016, h: 66 },
    surface1: { l: 0.245, c: 0.017, h: 70 },
    surface2: { l: 0.295, c: 0.018, h: 72 },
    ink: { l: 0.930, c: 0.014, h: 85 },
    inkSoft: { l: 0.700, c: 0.014, h: 80 },
    accent: { l: 0.775, c: 0.115, h: 82 },
    accentStrong: { l: 0.820, c: 0.110, h: 84 },
    alert: { l: 0.700, c: 0.150, h: 28 },
    // l: 0.130, non 0.300 come da specifica originale: notte.surface0 qui
    // è già a 0.185, quindi 0.300 sarebbe risultato PIÙ CHIARO del fondo,
    // violando l'invariante "la mensola resta più scura del piano 0 nei
    // quattro ancoraggi" (verificato da scripts/check-contrast.mts). La
    // specifica è arrivata senza i valori reali di questo repo — corretto
    // qui mantenendo croma/tonalità e scurendo la luminanza sotto 0.185.
    shelf: { l: 0.130, c: 0.026, h: 64 },
    lamp: { l: 0.820, c: 0.100, h: 78, a: 0.26 },
    shadowAlpha1: 0.42,
    shadowAlpha2: 0.62,
    coverVeil: 0.12,
  },
};

/* -----------------------------------------------------------------------------
 * Alba e tramonto a 43°N, ora locale italiana, per mese.
 * Tabella invece di una libreria di effemeridi: l'errore massimo è di una
 * ventina di minuti dentro il mese, e su un'interpolazione che dura ore non è
 * distinguibile. Zero dipendenze, zero chiamate.
 * -------------------------------------------------------------------------- */

const SUN: Array<[sunriseH: number, sunsetH: number]> = [
  [7.60, 17.00], // gen
  [7.20, 17.60], // feb
  [6.50, 18.20], // mar
  [6.65, 19.85], // apr (ora legale)
  [5.95, 20.45], // mag
  [5.60, 20.85], // giu
  [5.75, 20.80], // lug
  [6.20, 20.30], // ago
  [6.70, 19.45], // set
  [7.20, 18.60], // ott
  [6.85, 16.85], // nov
  [7.45, 16.70], // dic
];

/** Ora corrente in CET/CEST come numero decimale, indipendente dal fuso del server. */
export function nowInRomeHours(d: Date = new Date()): { hours: number; month: number } {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hours: get("hour") + get("minute") / 60, month: get("month") - 1 };
}

/* -----------------------------------------------------------------------------
 * Interpolazione.
 * In OKLCH e non in sRGB: i mezzitoni restano saturi e leggibili, mentre in
 * sRGB il passaggio fra alba e giorno darebbe un mezzogiorno grigio e fangoso.
 * -------------------------------------------------------------------------- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpola l'hue lungo l'arco più corto, altrimenti si attraversa la ruota. */
function lerpHue(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

function lerpColor(a: Oklch, b: Oklch, t: number): Oklch {
  return {
    l: lerp(a.l, b.l, t),
    c: lerp(a.c, b.c, t),
    h: lerpHue(a.h, b.h, t),
    a: a.a !== undefined || b.a !== undefined ? lerp(a.a ?? 1, b.a ?? 1, t) : undefined,
  };
}

/**
 * Il confine fra chiaro e scuro NON si interpola.
 *
 * Interpolando linearmente da `tramonto` a `notte` si passa per un punto in cui
 * fondo e inchiostro sono entrambi a media luminanza: a metà transizione il
 * contrasto scende sotto 2:1 e il testo diventa illeggibile per una decina di
 * minuti al giorno, due volte al giorno. È un difetto silenzioso, perché nessuna
 * verifica statica sugli ancoraggi lo intercetta.
 *
 * Quindi: dentro la famiglia chiara (alba, giorno, tramonto) si interpola;
 * attraversando il confine con `notte` si scatta all'ancoraggio più vicino.
 * Il salto non si vede mai in faccia all'utente, perché il valore si aggiorna
 * solo al cambio pagina e mai mentre si sta scrivendo.
 */
function crossesNight(a: Anchor, b: Anchor): boolean {
  return (a === "notte") !== (b === "notte");
}

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  const keys = ["surface0","surface1","surface2","ink","inkSoft","accent","accentStrong","alert","shelf","lamp"] as const;
  const out = {} as Palette;
  for (const k of keys) out[k] = lerpColor(a[k], b[k], t);
  out.shadowAlpha1 = lerp(a.shadowAlpha1, b.shadowAlpha1, t);
  out.shadowAlpha2 = lerp(a.shadowAlpha2, b.shadowAlpha2, t);
  out.coverVeil = lerp(a.coverVeil, b.coverVeil, t);
  return out;
}

/**
 * Segmenti della giornata. `notte` copre due tratti, prima dell'alba e dopo il
 * tramonto, e per questo la tabella è espressa come una lista ordinata di
 * (ora, ancoraggio) su cui si cerca la coppia adiacente.
 */
function schedule(month: number): Array<[hour: number, anchor: Anchor]> {
  const [rise, set] = SUN[month];
  return [
    [0, "notte"],
    [rise - 0.5, "notte"],
    [rise + 0.5, "alba"],
    [rise + 2.5, "giorno"],
    [set - 1.5, "giorno"],
    [set + 0.2, "tramonto"],
    [set + 1.5, "notte"],
    [24, "notte"],
  ];
}

/** L'ancoraggio dominante nell'istante dato. Serve per l'attributo data-light. */
export function currentAnchor(d: Date = new Date()): Anchor {
  const { hours, month } = nowInRomeHours(d);
  const s = schedule(month);
  for (let i = 0; i < s.length - 1; i++) {
    if (hours >= s[i][0] && hours < s[i + 1][0]) {
      const t = (hours - s[i][0]) / (s[i + 1][0] - s[i][0]);
      return t < 0.5 ? s[i][1] : s[i + 1][1];
    }
  }
  return "notte";
}

/** La palette interpolata fra i due ancoraggi adiacenti. */
export function currentPalette(d: Date = new Date()): Palette {
  const { hours, month } = nowInRomeHours(d);
  const s = schedule(month);
  for (let i = 0; i < s.length - 1; i++) {
    if (hours >= s[i][0] && hours < s[i + 1][0]) {
      const span = s[i + 1][0] - s[i][0];
      const t = span === 0 ? 0 : (hours - s[i][0]) / span;
      const [from, to] = [s[i][1], s[i + 1][1]];
      if (crossesNight(from, to)) return ANCHORS[t < 0.5 ? from : to];
      return lerpPalette(ANCHORS[from], ANCHORS[to], t);
    }
  }
  return ANCHORS.notte;
}

/* -----------------------------------------------------------------------------
 * Serializzazione in variabili CSS, da iniettare come style inline su <html>.
 * Vince sui blocchi data-light di tokens.css, che restano come fallback e come
 * stato di partenza per l'idratazione.
 * -------------------------------------------------------------------------- */

const fmt = (x: Oklch) =>
  x.a !== undefined && x.a < 1
    ? `oklch(${x.l.toFixed(4)} ${x.c.toFixed(4)} ${x.h.toFixed(2)} / ${x.a.toFixed(3)})`
    : `oklch(${x.l.toFixed(4)} ${x.c.toFixed(4)} ${x.h.toFixed(2)})`;

export function paletteToCssVars(p: Palette): Record<string, string> {
  return {
    "--raw-surface-0": fmt(p.surface0),
    "--raw-surface-1": fmt(p.surface1),
    "--raw-surface-2": fmt(p.surface2),
    "--raw-ink": fmt(p.ink),
    "--raw-ink-soft": fmt(p.inkSoft),
    "--raw-accent": fmt(p.accent),
    "--raw-accent-strong": fmt(p.accentStrong),
    "--raw-alert": fmt(p.alert),
    "--raw-shelf": fmt(p.shelf),
    "--raw-lamp": fmt(p.lamp),
    "--shadow-alpha-1": p.shadowAlpha1.toFixed(3),
    "--shadow-alpha-2": p.shadowAlpha2.toFixed(3),
    "--cover-veil": p.coverVeil.toFixed(3),
  };
}

/**
 * Ciò che va scritto su <html> dal layout del server.
 *
 * Non esiste un interruttore e non esistono due temi: c'è una stanza sola che
 * dal mattino alla notte si scurisce. `data-light` porta l'ancoraggio dominante
 * (serve ai pochi selettori che devono sapere se la stanza è scura: nastri,
 * bordo di luce, velatura delle copertine); `style` porta i valori interpolati,
 * che vincono sui blocchi di fallback in tokens.anchors.css.
 */
export function lightAttrs(d: Date = new Date()): {
  "data-light": Anchor;
  style: Record<string, string>;
} {
  return { "data-light": currentAnchor(d), style: paletteToCssVars(currentPalette(d)) };
}
