import type { VoceConLibro } from "@/lib/api/voci";
import { chiaveOrdinamentoAutore } from "@/lib/autori";

/**
 * Spessore della costa (design doc §7, riscritto il 20 agosto 2026):
 * "lo spessore è il numero di pagine. Non l'altezza". `clamp(6px, pagine /
 * 22, 28px)`. Le voci senza pagine adottate prendono uno spessore mediano,
 * coerente col trattamento "l'assenza di dato si dichiara" (bordo
 * tratteggiato, nessun riempimento — vedi .volume[data-no-pages] in
 * tokens.css).
 */
const SPINE_MIN = 6;
const SPINE_MAX = 28;
const SPINE_PER_PAGE = 22;
const SPINE_MEDIANA = (SPINE_MIN + SPINE_MAX) / 2;

export function spessoreCosta(pagineAdottate: number | null): number {
  if (pagineAdottate == null) return SPINE_MEDIANA;
  return Math.round(Math.min(SPINE_MAX, Math.max(SPINE_MIN, pagineAdottate / SPINE_PER_PAGE)));
}

export type VoceItem = { type: "volume"; voce: VoceConLibro; key: string };
export type TickItem = { type: "tick"; letter: string; key: string };
export type ShelfItem = VoceItem | TickItem;

/**
 * Ordina per cognome dell'autore (stabile, a parità per titolo — design
 * doc §7) e interpone una tacca ad ogni cambio di lettera iniziale, "una
 * tacca fra un volume e l'altro, non un ripiano a sé".
 */
export function costruisciElementi(voci: VoceConLibro[]): ShelfItem[] {
  const ordinate = voci.toSorted((a, b) => {
    const chiave = chiaveOrdinamentoAutore(a.libro.autori).localeCompare(
      chiaveOrdinamentoAutore(b.libro.autori),
      "it",
    );
    return chiave !== 0
      ? chiave
      : a.libro.titoloCanonico.localeCompare(b.libro.titoloCanonico, "it");
  });

  const elementi: ShelfItem[] = [];
  let letteraPrecedente: string | null = null;
  for (const voce of ordinate) {
    const cognome = chiaveOrdinamentoAutore(voce.libro.autori);
    const lettera = cognome ? cognome[0].toUpperCase() : "";
    if (lettera && lettera !== letteraPrecedente) {
      elementi.push({ type: "tick", letter: lettera, key: `tick-${lettera}-${voce.id}` });
      letteraPrecedente = lettera;
    }
    elementi.push({ type: "volume", voce, key: voce.id });
  }
  return elementi;
}

const TICK_WIDTH = 18;
const GAP = 12; // --sp3

function larghezzaElemento(item: ShelfItem, coverWidth: number): number {
  if (item.type === "tick") return TICK_WIDTH + GAP;
  return spessoreCosta(item.voce.pagineAdottate) + coverWidth + GAP;
}

/**
 * "Le mensole si riempiono sulla larghezza reale, non su un numero fisso
 * di libri" (design doc §7, regola 5): impacchetta gli elementi finché
 * entrano nella larghezza disponibile, poi chiude la mensola e ne apre
 * una nuova. Un elemento troppo largo per stare da solo in una mensola
 * vuota ci finisce comunque (mai un ciclo infinito).
 */
export function impacchetta(
  items: ShelfItem[],
  larghezzaDisponibile: number,
  coverWidth: number,
): ShelfItem[][] {
  if (larghezzaDisponibile <= 0) return items.length > 0 ? [items] : [];
  const righe: ShelfItem[][] = [];
  let corrente: ShelfItem[] = [];
  let usato = 0;
  for (const item of items) {
    const larghezza = larghezzaElemento(item, coverWidth);
    if (usato + larghezza > larghezzaDisponibile && corrente.length > 0) {
      righe.push(corrente);
      corrente = [];
      usato = 0;
    }
    corrente.push(item);
    usato += larghezza;
  }
  if (corrente.length > 0) righe.push(corrente);
  return righe;
}
