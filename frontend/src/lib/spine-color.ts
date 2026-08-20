/**
 * Colore del dorso, calcolato lato client come segnaposto deterministico
 * per libro finché non esiste la pipeline reale (design doc §7: "colore
 * del dorso calcolato lato server alla nascita della scheda... con
 * sharp-vibrant"). Quella pipeline appartiene all'ingestion dei libri
 * (issue #4, non ancora costruita) e richiede una copertina da cui
 * estrarre il colore — qui non c'è alcuna copertina.
 *
 * Il segnaposto tipografico previsto dal design per copertina assente
 * ("titolo e autore, composto in Fraunces sul colore del dorso", §13)
 * resta senza sorgente di colore se ogni dorso è identico: un hash
 * stabile dell'id del Libro in una tinta OKLCH dà a ogni libro un
 * colore proprio e coerente tra le sessioni, senza inventare un dato
 * bibliografico. Va sostituito, non esteso, quando la pipeline reale
 * arriva.
 */
export function coloreDorso(libroId: string): string {
  let hash = 0;
  for (let i = 0; i < libroId.length; i++) {
    hash = (hash * 31 + libroId.charCodeAt(i)) >>> 0;
  }
  const tonalita = hash % 360;
  // Luminanza/croma fissi (vicini all'ancoraggio di default di .spine in
  // tokens.css), solo la tonalità varia: mantiene leggibile il testo
  // chiaro sovrapposto in ogni caso, indipendentemente dall'hue.
  return `oklch(0.42 0.10 ${tonalita})`;
}
