import { mixOklch, type Oklch } from "./oklch";

/**
 * Il sottoinsieme di token che varia con l'ora del giorno (design doc
 * §3): fondo, superficie, testo, il colore dell'azione principale e le
 * due tinte dell'incisione. Tutto il resto della palette (secondario,
 * muto, bordi, anello di fuoco) si deriva da questi con `color-mix` in
 * CSS (`globals.css`) — non serve portarlo nell'interpolazione oraria.
 */
export interface TokenMateria {
  background: Oklch;
  surface: Oklch;
  foreground: Oklch;
  primary: Oklch;
  engraveHighlight: Oklch;
  engraveShadow: Oklch;
}

// Le due voci di tabella del design doc (§3): giorno e notte non sono
// l'una l'inversione dell'altra, ogni riga è scelta a sé.
const giorno: TokenMateria = {
  background: { l: 0.86, c: 0.02, h: 75 }, // rovere chiaro, luce da finestra
  surface: { l: 0.97, c: 0.015, h: 85 }, // carta avorio
  foreground: { l: 0.32, c: 0.045, h: 45 }, // inchiostro bruno
  primary: { l: 0.42, c: 0.09, h: 35 }, // legno brunito
  engraveHighlight: { l: 0.99, c: 0.01, h: 85 },
  engraveShadow: { l: 0.24, c: 0.05, h: 40 },
};

const notte: TokenMateria = {
  background: { l: 0.22, c: 0.03, h: 55 }, // noce scuro, luce da lampada
  surface: { l: 0.27, c: 0.035, h: 60 }, // carta ambrata smorzata
  foreground: { l: 0.92, c: 0.02, h: 80 }, // avorio caldo
  // Stessa fascia di luminosità del primary diurno (non l'inverso: un
  // ambra/ottone scuro, non un oro chiaro) così un solo
  // --primary-foreground statico resta leggibile giorno e notte, senza
  // bisogno di sceglierlo per contrasto a ogni istante dell'interpolazione.
  primary: { l: 0.42, c: 0.11, h: 55 },
  engraveHighlight: { l: 0.78, c: 0.07, h: 70 }, // riflesso caldo
  engraveShadow: { l: 0.08, c: 0.02, h: 50 },
};

function mixToken(a: TokenMateria, b: TokenMateria, t: number): TokenMateria {
  return {
    background: mixOklch(a.background, b.background, t),
    surface: mixOklch(a.surface, b.surface, t),
    foreground: mixOklch(a.foreground, b.foreground, t),
    primary: mixOklch(a.primary, b.primary, t),
    engraveHighlight: mixOklch(a.engraveHighlight, b.engraveHighlight, t),
    engraveShadow: mixOklch(a.engraveShadow, b.engraveShadow, t),
  };
}

function torciTinta(token: TokenMateria, gradi: number, aumentoCroma: number): TokenMateria {
  const torci = (o: Oklch): Oklch => ({ ...o, h: (o.h + gradi + 360) % 360, c: o.c + aumentoCroma });
  return {
    background: torci(token.background),
    surface: torci(token.surface),
    foreground: token.foreground, // il testo non si tinge: deve restare leggibile a ogni ora
    primary: torci(token.primary),
    engraveHighlight: torci(token.engraveHighlight),
    engraveShadow: token.engraveShadow,
  };
}

// Il design doc (§3) descrive in tabella solo giorno e notte. Alba e
// tramonto si ottengono a metà strada fra i due ancoraggi vicini, con
// una torsione di tinta che dà il carattere dell'ora — rosata verso
// l'alba, arancio verso il tramonto — invece di inventare da zero
// un'altra coppia di valori.
export const albaToken = torciTinta(mixToken(notte, giorno, 0.5), 20, 0.015);
export const tramontoToken = torciTinta(mixToken(giorno, notte, 0.5), -25, 0.02);
export const giornoToken = giorno;
export const notteToken = notte;

export const ancoraggi = {
  alba: albaToken,
  giorno: giornoToken,
  tramonto: tramontoToken,
  notte: notteToken,
} as const;

export type NomeAncoraggio = keyof typeof ancoraggi;

export { mixToken };
