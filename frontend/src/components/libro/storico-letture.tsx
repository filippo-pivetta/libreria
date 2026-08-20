"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancellaLettura } from "@/lib/api/letture";
import { getAccessToken } from "@/lib/api/access-token";
import type { Lettura } from "@/lib/api/voci";
import { formattaData } from "@/lib/formato";
import { useToast } from "@/providers/toast-provider";

const ETICHETTA_ESITO: Record<string, string> = {
  conclusa: "conclusa",
  abbandonata: "abbandonata",
};

/**
 * Storico delle Letture (design doc §9: "in un pannello che si apre").
 * Sui libri con una Lettura sola ancora aperta, la maggioranza, non
 * compare nulla — è già raccontata dal pannello sopra. Ma una singola
 * Lettura CHIUSA non è raccontata da nessuna altra parte: nasconderla
 * qui la renderebbe invisibile e irraggiungibile (il bug osservato
 * cancellando una Lettura da uno storico di due: quella rimasta,
 * essendo sola, spariva anche lei — nel database restava intatta, un
 * solo DELETE, mai due).
 *
 * La cancellazione (`DELETE /letture/{id}`, qualunque Lettura — PRD:
 * "l'Utente può... cancellare ogni contenuto proprio") sta dentro il
 * menù della riga (design doc §9, punto 5, correzione del 20 agosto
 * 2026: "non un collegamento sottolineato ripetuto due volte"), non in
 * linea. Un primo clic sul menù apre "Cancella davvero"/"Annulla" al
 * posto delle date; niente modale.
 */
export function StoricoLetture({
  voceId,
  letture,
  isOwner,
}: {
  voceId: string;
  letture: Lettura[];
  /** Niente menù "⋯" di cancellazione sul libro di un collegato (issue
   * #3, Regola 5): l'RLS bloccherebbe comunque la scrittura, ma
   * l'affordance stessa non va mostrata (design doc §15, "nessuna
   * traccia di dove sarebbero" i comandi di scrittura). L'elenco in
   * sola lettura resta visibile: è un dato di lettura reciprocamente
   * condiviso (Regola 4). */
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [inConfermaId, setInConfermaId] = useState<string | null>(null);
  // Chiusura ritardata del menù "⋯" (non al primo mouseleave): un
  // timer per riga, non uno solo — righe diverse possono essere aperte
  // e richiuse in rapida successione (design doc §9).
  const timerAltreAzioni = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function annullaChiusuraAltreAzioni(letturaId: string) {
    const timer = timerAltreAzioni.current.get(letturaId);
    if (timer) {
      clearTimeout(timer);
      timerAltreAzioni.current.delete(letturaId);
    }
  }

  function programmaChiusuraAltreAzioni(letturaId: string, dettagli: HTMLDetailsElement) {
    timerAltreAzioni.current.set(
      letturaId,
      setTimeout(() => {
        dettagli.open = false;
        timerAltreAzioni.current.delete(letturaId);
      }, 350),
    );
  }

  const mutazione = useMutation({
    mutationFn: async (letturaId: string) => {
      const token = await getAccessToken();
      const result = await cancellaLettura(token, letturaId);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? "Questa lettura non esiste più." : result.message,
        );
      }
    },
    onSuccess: () => {
      setInConfermaId(null);
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile cancellare la lettura.",
      );
    },
  });

  const unicaLetturaAperta = letture.length === 1 && letture[0].dataFine === null;
  if (letture.length === 0 || unicaLetturaAperta) return null;

  return (
    <details className="mt-6" open={letture.length === 1}>
      <summary className="t-label cursor-pointer">Storico delle letture</summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {letture.map((lettura) => (
          <li key={lettura.id} className="flex items-center justify-between gap-2">
            {inConfermaId === lettura.id ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={mutazione.isPending}
                  onClick={() => mutazione.mutate(lettura.id)}
                  className="t-meta text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  Cancella davvero
                </button>
                <button
                  type="button"
                  onClick={() => setInConfermaId(null)}
                  className="t-meta text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  Annulla
                </button>
              </span>
            ) : (
              <span className="t-meta">
                {formattaData(lettura.dataInizio)}
                {lettura.dataFine ? ` – ${formattaData(lettura.dataFine)}` : " – in corso"}
                {lettura.esito ? ` · ${ETICHETTA_ESITO[lettura.esito]}` : ""}
                {" · "}
                {lettura.avanzamenti.length}{" "}
                {lettura.avanzamenti.length === 1 ? "avanzamento" : "avanzamenti"}
              </span>
            )}

            {isOwner && inConfermaId !== lettura.id && (
              <details
                className="relative shrink-0"
                onMouseEnter={() => annullaChiusuraAltreAzioni(lettura.id)}
                onMouseLeave={(event) => programmaChiusuraAltreAzioni(lettura.id, event.currentTarget)}
              >
                <summary
                  aria-label="Altre azioni"
                  className="t-meta flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-object text-ink-soft hover:bg-surface-2 hover:text-ink"
                >
                  ⋯
                </summary>
                {/* `pt-1.5` invece di un margine: niente spazio morto fra
                    "⋯" e il menù dove il mouse potrebbe uscire dal
                    `<details>` a metà del movimento. */}
                <div className="absolute top-full right-0 z-10 pt-1.5">
                  <div className="min-w-32 rounded-field border border-line bg-surface-1 p-1.5 shadow-plane-2">
                    <button
                      type="button"
                      onClick={() => setInConfermaId(lettura.id)}
                      className="w-full rounded-object px-3 py-2 text-left font-ui text-sm text-ink hover:bg-surface-2"
                    >
                      Cancella
                    </button>
                  </div>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
