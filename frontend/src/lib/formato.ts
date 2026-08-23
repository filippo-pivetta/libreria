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
