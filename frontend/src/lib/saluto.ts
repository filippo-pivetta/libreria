import { nowInRomeHours } from "@/lib/light";

/**
 * Il saluto in cima alla Libreria (design-frontend.md §7, revisione delle
 * testate).
 *
 * Perché sta qui e non è un titolo. La Libreria è l'unica pagina senza
 * titolo, e il §7 aveva ragione a toglierlo: «La tua libreria» non diceva
 * niente che uno scaffale di libri propri non dica da sé. Restava però la
 * riga della porta del profilo — un cerchietto allineato a destra e
 * nient'altro — in cima alla pagina più visitata. Da quando la barra del
 * titolo (`.barra-titolo`) garantisce l'orientamento allo scorrimento,
 * quella riga non deve più fare wayfinding e può dire qualcosa.
 *
 * Perché l'orologio e non l'ancoraggio della luce. Sarebbe stato più
 * elegante agganciare il saluto ai quattro momenti che `light.ts` già
 * calcola, e per un momento è sembrata la scelta giusta: sarebbe stato
 * l'unico punto in cui la stanza si dice a parole invece che in colore.
 * Non regge alla prova. Gli ancoraggi sono SOLARI — `schedule()` tiene
 * «giorno» fino a un'ora e mezza prima del tramonto — quindi a giugno
 * alle 19:30 la stanza è ancora in «giorno» e il saluto direbbe
 * «buongiorno» a chi in italiano si aspetta «buonasera». I saluti
 * seguono le convenzioni dell'orologio, non il sole.
 *
 * Resta comune ciò che conta davvero: la stessa sorgente d'ora
 * (`nowInRomeHours`, fuso CET fisso) e la stessa disciplina — calcolato
 * lato server a ogni cambio pagina, mai nel browser, mai da
 * `localStorage`, nessuno script anti-lampeggio.
 */
export type Momento = "mattino" | "pomeriggio" | "sera" | "notte";

/** Il momento del giorno secondo l'orologio di Roma. */
export function momentoDelGiorno(d: Date = new Date()): Momento {
  const { hours } = nowInRomeHours(d);
  if (hours >= 5 && hours < 13) return "mattino";
  if (hours >= 13 && hours < 18) return "pomeriggio";
  if (hours >= 18 && hours < 24) return "sera";
  return "notte";
}

const SALUTI: Record<Momento, string> = {
  mattino: "Buongiorno",
  pomeriggio: "Buon pomeriggio",
  sera: "Buonasera",
  // Fra mezzanotte e le cinque. «Buonanotte» detto a chi sta per andare
  // a dormire è un congedo, ma detto a chi apre la propria libreria a
  // quell'ora è ciò che una persona direbbe davvero, ed è l'unico saluto
  // che l'italiano offra per quella fascia. L'alternativa era non
  // salutare affatto: peggio, perché la riga esiste comunque.
  notte: "Buonanotte",
};

/**
 * «Buonasera, filippo». Il nome è quello scelto dall'Utente (ADR 0013) e
 * non viene ritoccato: non è un errore di battitura da correggere con una
 * maiuscola d'ufficio.
 */
export function saluto(nomeUtente: string, d: Date = new Date()): string {
  return `${SALUTI[momentoDelGiorno(d)]}, ${nomeUtente}`;
}
