/**
 * Le date si leggono, mai in ISO grezzo (design-frontend.md §19: "date e
 * numeri seguono la lingua del browser"; §9 correzione del 20 agosto
 * 2026). `Intl.DateTimeFormat` sulla lingua dell'interfaccia (issue #34):
 * chi chiama passa `useLocale()` di next-intl, non un valore fisso — un
 * componente client legge così la stessa lingua che l'interfaccia intorno
 * sta già mostrando, mai una seconda dedotta qui.
 */
export function formattaData(iso: string, lingua: string): string {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  if (!anno || !mese || !giorno) return iso;
  return new Intl.DateTimeFormat(lingua, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(anno, mese - 1, giorno)),
  );
}

/** La lingua originale è una parola ("italiano"/"Italian"), non un codice
 * ("it"): stessa `lingua` dell'interfaccia di `formattaData`, non quella
 * del libro (`codice` è quella — sono due cose diverse che condividono
 * solo la forma di un tag lingua). */
export function formattaLingua(codice: string, lingua: string): string {
  try {
    const nomi = new Intl.DisplayNames([lingua], { type: "language" });
    return nomi.of(codice) ?? codice;
  } catch {
    return codice;
  }
}

/**
 * Il periodo di una Lettura, in una riga, qualunque cosa se ne sappia.
 *
 * Dalla migrazione 20260827160000 una Lettura può essere registrata a
 * posteriori: senza data di inizio, e chiusa su un giorno, sulla sola
 * annata o su niente. I quattro casi si scrivono in un posto solo perché
 * comparivano in cinque (storico, testata, blocco di stato, insight,
 * segnalibro) e sarebbero divergiti alla prima correzione — è la stessa
 * lezione delle regole ripetute a mano nei prompt.
 *
 * Nessun trattino lungo: la regola vale per l'output del modello, ma qui
 * il trattino fra due date è la lineetta breve dell'intervallo, che è
 * un'altra cosa e resta.
 */
export function periodoLettura(
  lettura: {
    dataInizio: string | null;
    dataFine: string | null;
    annoFine: number | null;
  },
  lingua: string,
): string {
  const { dataInizio, dataFine, annoFine } = lettura;

  if (dataInizio && dataFine) {
    return `${formattaData(dataInizio, lingua)} – ${formattaData(dataFine, lingua)}`;
  }
  if (dataInizio && !dataFine && annoFine === null) {
    return `${formattaData(dataInizio, lingua)} – in corso`;
  }
  // Registrata a posteriori: l'inizio non si conosce, e dirlo per esteso
  // ("dal ... al ...") vorrebbe un dato che non c'è.
  if (dataFine) return `Finito il ${formattaData(dataFine, lingua)}`;
  if (annoFine !== null) return `Finito nel ${annoFine}`;
  return "Finito, data non ricordata";
}
