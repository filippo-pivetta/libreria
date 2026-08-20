/**
 * Le date si leggono, mai in ISO grezzo (design-frontend.md §19: "date e
 * numeri seguono la lingua del browser"; §9 correzione del 20 agosto
 * 2026). `Intl.DateTimeFormat` sulla lingua dell'interfaccia — oggi
 * sempre "it" (l'interfaccia bilingue è debito noto, non ancora
 * implementata, AGENTS.md).
 */
export function formattaData(iso: string): string {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  if (!anno || !mese || !giorno) return iso;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(anno, mese - 1, giorno)),
  );
}

/** La lingua originale è una parola ("italiano"), non un codice ("it"). */
export function formattaLingua(codice: string): string {
  try {
    const nomi = new Intl.DisplayNames(["it"], { type: "language" });
    return nomi.of(codice) ?? codice;
  } catch {
    return codice;
  }
}
