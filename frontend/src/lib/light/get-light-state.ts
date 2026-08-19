import { cookies } from "next/headers";

import { formatOklch } from "./oklch";
import { ancoraggi, mixToken, type NomeAncoraggio, type TokenMateria } from "./palette";
import { albaTramonto, oraCetFissa } from "./solar";

/**
 * Nome del cookie che porta l'interruttore a tre stati del design doc
 * (§3: giorno/notte/auto). Non esiste ancora un'interfaccia che lo
 * scriva — arriverà con le impostazioni della Torre — ma la lettura è
 * pronta da subito: quando quello schermo esisterà, gli basterà
 * impostare questo cookie.
 */
const COOKIE_MODALITA_LUCE = "montaigne-luce";

export interface StatoLuce {
  /** Variabili CSS da applicare come style inline sull'elemento radice. */
  variabili: Record<string, string>;
  /** Se l'ancoraggio dominante è "notte": guida la classe .dark e il verso dell'incisione. */
  notte: boolean;
}

function variabiliDaToken(token: TokenMateria): Record<string, string> {
  return {
    "--montaigne-background": formatOklch(token.background),
    "--montaigne-surface": formatOklch(token.surface),
    "--montaigne-foreground": formatOklch(token.foreground),
    "--montaigne-primary": formatOklch(token.primary),
    "--montaigne-engrave-highlight": formatOklch(token.engraveHighlight),
    "--montaigne-engrave-shadow": formatOklch(token.engraveShadow),
  };
}

interface PuntoAncoraggio {
  nome: NomeAncoraggio;
  ora: number;
}

function ancoraggiOrdinati(alba: number, mezzogiorno: number, tramonto: number): PuntoAncoraggio[] {
  const mezzanotteSolare = (mezzogiorno + 12) % 24;
  const punti: PuntoAncoraggio[] = [
    { nome: "alba", ora: alba },
    { nome: "giorno", ora: mezzogiorno },
    { nome: "tramonto", ora: tramonto },
    { nome: "notte", ora: mezzanotteSolare },
  ];
  return punti.sort((a, b) => a.ora - b.ora);
}

/** Fra quali due ancoraggi cade l'ora corrente, e a che punto della transizione. */
function intervalloPerOra(ora: number, punti: PuntoAncoraggio[]): { da: NomeAncoraggio; a: NomeAncoraggio; t: number } {
  for (let i = 0; i < punti.length; i++) {
    const corrente = punti[i];
    const successivo = punti[(i + 1) % punti.length];
    const oraSuccessivo = successivo.ora <= corrente.ora ? successivo.ora + 24 : successivo.ora;
    const oraCorrente = ora < corrente.ora ? ora + 24 : ora;
    if (oraCorrente >= corrente.ora && oraCorrente < oraSuccessivo) {
      return { da: corrente.nome, a: successivo.nome, t: (oraCorrente - corrente.ora) / (oraSuccessivo - corrente.ora) };
    }
  }
  // I quattro punti coprono l'intero cerchio delle 24 ore: non si arriva qui.
  return { da: punti[0].nome, a: punti[0].nome, t: 0 };
}

/**
 * Calcola la palette del momento — lato server, mai nel browser, così
 * due collegati vedono la stessa stanza alla stessa ora e non c'è
 * mismatch di idratazione in Next.js (design doc §3). Va chiamata una
 * sola volta per richiesta, tipicamente nel layout radice: si aggiorna
 * al cambio pagina, mai con un timer.
 */
export async function getLightState(adesso: Date = new Date()): Promise<StatoLuce> {
  const cookieStore = await cookies();
  const modalita = cookieStore.get(COOKIE_MODALITA_LUCE)?.value;

  if (modalita === "giorno") {
    return { variabili: variabiliDaToken(ancoraggi.giorno), notte: false };
  }
  if (modalita === "notte") {
    return { variabili: variabiliDaToken(ancoraggi.notte), notte: true };
  }

  const { alba, tramonto, mezzogiorno } = albaTramonto(adesso);
  const punti = ancoraggiOrdinati(alba, mezzogiorno, tramonto);
  const { da, a, t } = intervalloPerOra(oraCetFissa(adesso), punti);

  const token = mixToken(ancoraggi[da], ancoraggi[a], t);
  const pesoNotte = (da === "notte" ? 1 - t : 0) + (a === "notte" ? t : 0);

  return { variabili: variabiliDaToken(token), notte: pesoNotte > 0.5 };
}
