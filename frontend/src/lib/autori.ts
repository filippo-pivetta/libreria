import type { Autore } from "@/lib/api/voci";

/** Gli autori di un Libro come stringa unica, nell'ordine dato dal
 * backend (già per `ordine`, PRD regola 18: il peso di un libro si
 * ripartisce tra i suoi autori). */
export function nomiAutori(autori: Autore[]): string {
  return autori.map((autore) => autore.nomeCanonico).join(", ");
}

/**
 * Ultima parola del nome canonico del primo autore, come chiave per
 * l'ordinamento alfabetico dello scaffale (design doc §7: "Ordinamento
 * alfabetico per autore, stabile"). Semplificazione nota: un cognome
 * composto (es. "García Márquez") si tronca all'ultimo token soltanto;
 * un ordinamento corretto per cognome richiederebbe un campo separato
 * che il modello dell'Autore non porta ancora (docs/prd.md, ADR 0005:
 * l'identità dell'autore è un nome canonico intero, non nome+cognome).
 */
export function chiaveOrdinamentoAutore(autori: Autore[]): string {
  const primo = autori[0];
  if (!primo) return "";
  const parole = primo.nomeCanonico.trim().split(/\s+/);
  return parole[parole.length - 1] ?? primo.nomeCanonico;
}
