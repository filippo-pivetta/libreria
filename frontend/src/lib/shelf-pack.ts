import type { VoceConLibro } from "@/lib/api/voci";
import { chiaveOrdinamentoAutore } from "@/lib/autori";

import type { MisureScaffale } from "@/lib/use-container-width";

/**
 * Spessore grezzo della costa (design doc §7): "lo spessore è il numero di
 * pagine. Non l'altezza". Il taglio ai due estremi — `--spine-min` e
 * `--spine-max` — lo fa la `clamp()` di `.volume__spine` in tokens.css, e non
 * più questa funzione: il tetto scende sotto i 640px (14px invece di 28) e un
 * componente non deve sapere su che schermo sta per disegnare una costa.
 *
 * Le voci senza pagine adottate non passano di qui: `Volume` non scrive
 * affatto `--spine-w`, e la mediana arriva da `.volume[data-no-pages]`.
 */
const SPINE_PER_PAGE = 22;

export function spessoreGrezzo(pagineAdottate: number): number {
  return Math.round(pagineAdottate / SPINE_PER_PAGE);
}

/**
 * Lo stesso spessore *dopo* la clamp, che è ciò di cui ha bisogno chi
 * impacchetta: qui i limiti servono per forza, perché il conto va fatto prima
 * che il browser disegni. Arrivano letti dai token (`useMisureScaffale`), mai
 * ricopiati come costanti.
 */
export function spessoreCosta(pagineAdottate: number | null, misure: MisureScaffale): number {
  if (pagineAdottate == null) return (misure.costaMin + misure.costaMax) / 2;
  return Math.min(misure.costaMax, Math.max(misure.costaMin, spessoreGrezzo(pagineAdottate)));
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

/**
 * La tacca non occupa più larghezza: sta dentro il gap che già separava i due
 * volumi (`.shelf-tick` in tokens.css, larghezza zero e margini negativi di
 * mezzo gap). Costava trenta pixel — un quarto di volume su un telefono — ed
 * era la ragione per cui una mensola ne teneva due invece di tre.
 *
 * Il gap NON è qui dentro: è lo spazio FRA due elementi, non un pezzo che
 * ciascuno porta con sé, e `impacchetta` lo aggiunge a parte, una sola volta
 * fra un elemento e il successivo — mai dopo l'ultimo, perché il CSS reale
 * (`gap` sulla riga flessibile) non ne disegna uno in coda. Prima lo portava
 * ogni volume: una mensola di tre volumi ne contava così due gap veri più un
 * terzo che il CSS non disegna mai, ed era quel gap fantasma — non i numeri
 * di `--cover-w` — a far chiudere la riga a due libri invece di tre proprio
 * dove il margine è più stretto (telefoni sui 340-375px, la fascia più
 * comune).
 */
function larghezzaElemento(item: ShelfItem, misure: MisureScaffale): number {
  if (item.type === "tick") return 0;
  return spessoreCosta(item.voce.pagineAdottate, misure) + misure.copertina;
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
  misure: MisureScaffale,
): ShelfItem[][] {
  if (larghezzaDisponibile <= 0) return items.length > 0 ? [items] : [];
  const righe: ShelfItem[][] = [];
  let corrente: ShelfItem[] = [];
  let usato = 0;
  for (const item of items) {
    const proprio = larghezzaElemento(item, misure);
    // Zero se `item` aprirebbe una riga nuova (vuota): niente gap prima del
    // primo elemento, lo stesso motivo per cui non ce n'è uno visibile lì.
    const gap = corrente.length > 0 ? misure.gap : 0;
    if (usato + gap + proprio > larghezzaDisponibile && corrente.length > 0) {
      righe.push(corrente);
      corrente = [item];
      usato = proprio;
    } else {
      corrente.push(item);
      usato += gap + proprio;
    }
  }
  if (corrente.length > 0) righe.push(corrente);
  return righe;
}
