"use client";

import { useState } from "react";

import type { VoceClassifica } from "@/lib/api/metriche";
// Stessa forma di un voto in stelle (virgola, un decimale, interi senza
// zero superfluo): riusata invece di reimplementarla, esattamente il
// motivo per cui è esportata da voto-stelle.tsx.
import { formattaVoto as formattaPeso } from "@/components/libro/voto-stelle";

const MOSTRATE_INIZIALMENTE = 5;

/**
 * "Autori più letti" (design-frontend.md §14): classifica a cinque voci
 * con "mostra tutte", barre in `accent` — mai una scala di colori
 * diversi per voce, perché misurano la stessa grandezza su soggetti
 * diversi. L'elenco arriva già ordinato e completo dal backend
 * (`metriche_service._classifica`): il troncamento a cinque è
 * responsabilità di questo componente, non del backend.
 *
 * "Generi principali" ha la sua carta a parte, a ciambella
 * (`torta-generi.tsx`): stessi dati, forma diversa — qui restano solo
 * gli autori.
 */
export function Classifica({
  titolo,
  righe,
  nota,
}: {
  titolo: string;
  righe: VoceClassifica[];
  /** Spiega i decimali del peso ripartito — senza, "sembrano un errore
   * di calcolo" (design-frontend.md §14). */
  nota: string;
}) {
  const [espansa, setEspansa] = useState(false);

  const mostrate = espansa ? righe : righe.slice(0, MOSTRATE_INIZIALMENTE);
  const pesoMassimo = righe[0]?.peso ?? 0;

  return (
    <div>
      <p className="t-label">{titolo}</p>

      {righe.length === 0 ? (
        // "Quest'anno" sarebbe scorretto: questo componente vale per
        // qualunque anno selezionato, non solo per quello corrente (un
        // anno intermedio senza letture mostra zeri, non un errore —
        // PRD, comportamento #12).
        <p className="t-meta mt-2">Nessun dato per l&apos;anno selezionato.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-2.5">
            {mostrate.map((riga) => (
              <li key={riga.id} className="flex items-center gap-3">
                <span
                  className="w-28 shrink-0 truncate font-ui text-sm text-ink sm:w-40"
                  title={riga.nome}
                >
                  {riga.nome}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (riga.peso / pesoMassimo) * 100)}%` }}
                  />
                </span>
                <span className="t-num t-meta w-10 shrink-0 text-right">
                  {formattaPeso(riga.peso)}
                </span>
              </li>
            ))}
          </ul>
          {righe.length > MOSTRATE_INIZIALMENTE && (
            <button
              type="button"
              onClick={() => setEspansa((v) => !v)}
              className="t-meta mt-3 underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              {espansa ? "mostra meno" : "mostra tutte"}
            </button>
          )}
          <p className="t-meta mt-3 border-t border-line pt-3">{nota}</p>
        </>
      )}
    </div>
  );
}
