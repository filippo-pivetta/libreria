"use client";

import { useState } from "react";

import type { VoceClassifica } from "@/lib/api/metriche";
// Stessa forma di un voto in stelle (virgola, un decimale, interi senza
// zero superfluo): riusata invece di reimplementarla, esattamente il
// motivo per cui è esportata da voto-stelle.tsx.
import { formattaVoto as formattaPeso } from "@/components/libro/voto-stelle";
import { Button } from "@/components/ui/button";
import { TitoloConChiosa } from "@/components/ui/chiosa";

const MOSTRATE_INIZIALMENTE = 5;

/**
 * "Autori più letti" (design-frontend.md §14): classifica a cinque voci
 * con "mostra tutti", barre in `accent`, mai una scala di colori diversi
 * per voce, perché misurano la stessa grandezza su soggetti diversi.
 * L'elenco arriva già ordinato e completo dal backend
 * (`metriche_service._classifica`): il troncamento a cinque è
 * responsabilità di questo componente.
 *
 * Due correzioni rispetto a prima:
 *
 * - il binario della barra era `bg-surface-2` su una carta `surface-1`,
 *   cioè 0,985 contro 0,965 di luminanza: invisibile. Una barra corta
 *   non si distingueva da una barra assente, che è precisamente ciò che
 *   un binario esiste per evitare. Ora è l'inchiostro del tema con
 *   alpha, come ogni altra linea dell'app;
 * - il comando diceva "mostra tutte" sotto "Autori più letti", ma il
 *   referente è maschile plurale.
 */
export function Classifica({
  titolo,
  righe,
  nota,
}: {
  titolo: string;
  righe: VoceClassifica[];
  /** Spiega i decimali del peso ripartito: senza, "sembrano un errore
   * di calcolo" (design-frontend.md §14). Sta nella chiosa accanto al
   * titolo, non in coda alla carta: è sempre la stessa frase, quindi non
   * merita di occupare spazio a ogni visita. */
  nota: string;
}) {
  const [espansa, setEspansa] = useState(false);

  const mostrate = espansa ? righe : righe.slice(0, MOSTRATE_INIZIALMENTE);
  const pesoMassimo = righe[0]?.peso ?? 0;

  return (
    <div>
      <TitoloConChiosa titolo={titolo} chiosa={<p>{nota}</p>} />

      {righe.length === 0 ? (
        // "Quest'anno" sarebbe scorretto: questo componente vale per
        // qualunque anno selezionato, non solo per quello corrente (un
        // anno intermedio senza letture mostra zeri, non un errore:
        // PRD, comportamento #12).
        <p className="t-meta mt-2">Nessun dato per l&apos;anno selezionato.</p>
      ) : (
        <>
          {/* Sotto i 640px il nome sale sopra la barra invece di occupare
              una colonna fissa: a 390px una colonna nome lascerebbe alla
              barra meno di 90px, cioè una barra che non misura più
              niente. Da 640px in su resta la riga singola, più densa. */}
          <ul className="mt-4 flex flex-col gap-4 sm:gap-3.5">
            {mostrate.map((riga) => (
              <li key={riga.id} className="sm:flex sm:items-center sm:gap-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 sm:mb-0 sm:contents">
                  <span
                    className="min-w-0 truncate font-ui text-[15px] text-ink sm:w-40 sm:shrink-0 sm:text-sm"
                    title={riga.nome}
                  >
                    {riga.nome}
                  </span>
                  <span className="t-num t-meta shrink-0 sm:order-last sm:w-10 sm:text-right">
                    {formattaPeso(riga.peso)}
                  </span>
                </div>
                <span className="block h-1.5 overflow-hidden rounded-full bg-ink/7 sm:flex-1">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (riga.peso / pesoMassimo) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          {righe.length > MOSTRATE_INIZIALMENTE && (
            <Button
              variant="quiet"
              size="testo"
              className="mt-4"
              onClick={() => setEspansa((v) => !v)}
            >
              {espansa ? "mostra meno" : `mostra tutti e ${righe.length}`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
