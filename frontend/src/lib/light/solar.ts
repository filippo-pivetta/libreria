/**
 * Alba e tramonto a latitudine fissa (design doc §3): "da tabella a
 * latitudine fissa, non dalla posizione dell'utente — due collegati
 * devono vedere la stessa stanza alla stessa ora". Invece di una
 * tabella letterale, il suo equivalente calcolato: la formula solare
 * standard (NOAA), alla latitudine della tenuta di Saint-Michel-de-
 * Montaigne, con lo stesso risultato — deterministico, identico per
 * chiunque, indipendente dal fuso del browser.
 *
 * Il fuso è CET fisso (UTC+1 costante): il PRD lo impone uguale per
 * tutti, e calcolarlo nel browser produrrebbe un mismatch di
 * idratazione in Next.js. "CET fisso" significa anche mai l'ora
 * legale: in agosto la Francia reale è già in CEST (UTC+2), quindi
 * gli orari qui risultano un'ora "presto" rispetto all'orologio a
 * muro — è la conseguenza voluta della regola, non un errore.
 */

const LATITUDINE = 44.83;
const LONGITUDINE = 0.09;

function gradiInRadianti(gradi: number): number {
  return (gradi * Math.PI) / 180;
}

function radiantiInGradi(radianti: number): number {
  return (radianti * 180) / Math.PI;
}

function giornoDellAnno(anno: number, mese: number, giorno: number): number {
  const inizio = Date.UTC(anno, 0, 1);
  const data = Date.UTC(anno, mese, giorno);
  return Math.floor((data - inizio) / 86_400_000) + 1;
}

/** La data corrente spostata di un'ora, così leggerne i campi UTC equivale a leggere l'ora CET fissa. */
export function dataCetFissa(adesso: Date): Date {
  return new Date(adesso.getTime() + 60 * 60 * 1000);
}

export function oraCetFissa(adesso: Date): number {
  const cet = dataCetFissa(adesso);
  return cet.getUTCHours() + cet.getUTCMinutes() / 60 + cet.getUTCSeconds() / 3600;
}

export interface AlbaTramonto {
  /** Ora dell'alba, in ore decimali del fuso CET fisso. */
  alba: number;
  /** Ora del tramonto, in ore decimali del fuso CET fisso. */
  tramonto: number;
  /** Mezzogiorno solare, in ore decimali del fuso CET fisso. */
  mezzogiorno: number;
}

/** Alba, tramonto e mezzogiorno solare per la data indicata (letta in CET fisso), alla latitudine fissa della tenuta. */
export function albaTramonto(adesso: Date): AlbaTramonto {
  const cet = dataCetFissa(adesso);
  const n = giornoDellAnno(cet.getUTCFullYear(), cet.getUTCMonth(), cet.getUTCDate());

  const gamma = ((2 * Math.PI) / 365) * (n - 1 + 12 / 24);

  const equazioneDelTempo =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declinazione =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = gradiInRadianti(LATITUDINE);
  // 90.833°: rifrazione atmosferica più il raggio del disco solare, la convenzione standard per alba/tramonto.
  const zenit = gradiInRadianti(90.833);
  const cosAngoloOrario =
    Math.cos(zenit) / (Math.cos(latRad) * Math.cos(declinazione)) - Math.tan(latRad) * Math.tan(declinazione);
  // Fuori da [-1, 1] alle latitudini estreme in pieno sole di mezzanotte o notte polare — qui inerte, ma innocuo da limitare.
  const angoloOrario = radiantiInGradi(Math.acos(Math.min(1, Math.max(-1, cosAngoloOrario))));

  const mezzogiornoSolareUtc = 12 - LONGITUDINE / 15 - equazioneDelTempo / 60;
  const oreAngoloOrario = angoloOrario / 15;

  const inCetFisso = (oreUtc: number) => (((oreUtc + 1) % 24) + 24) % 24;

  return {
    alba: inCetFisso(mezzogiornoSolareUtc - oreAngoloOrario),
    tramonto: inCetFisso(mezzogiornoSolareUtc + oreAngoloOrario),
    mezzogiorno: inCetFisso(mezzogiornoSolareUtc),
  };
}
