import { iniziali } from "@/lib/iniziali";
import { PulsanteEsci } from "@/components/layout/pulsante-esci";

/**
 * Barra contestuale del libro di un collegato (design doc §9, §15):
 * stessa logica di `BarraContesto` di Lettori — la barra globale sparisce
 * per intero, sostituita da questa, piena larghezza e fissa in alto.
 * "‹ [nome]" torna alla sua libreria, non all'elenco Lettori: un livello
 * alla volta, la stessa via da cui si è entrati.
 */
export function BarraContestoLibro({
  utenteId,
  nomeUtente,
  titoloLibro,
}: {
  utenteId: string;
  nomeUtente: string;
  titoloLibro: string;
}) {
  return (
    <div
      className="plane-0 sticky top-0 z-30 border-b border-line"
      style={{ paddingTop: "var(--safe-t)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <PulsanteEsci href={`/lettori/${utenteId}`} label={nomeUtente} />
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-sm text-ink-soft"
          >
            {iniziali(nomeUtente)}
          </span>
          <span className="t-title truncate text-xl">{titoloLibro}</span>
        </div>
      </div>
    </div>
  );
}
