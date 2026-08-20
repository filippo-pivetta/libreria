"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cambiaStato, type StatoVoce, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";

type Transizione = { stato: StatoVoce; etichetta: string; chiedeData?: boolean };

/**
 * Rispecchia esattamente la matrice validata da `cambia_stato_voce`
 * (supabase/migrations/20260820065144_ciclo_di_lettura.sql, docs/adr/0015):
 * "l'interfaccia non offre mai una transizione vietata, invece di
 * offrirla e poi rifiutarla" (design doc §9). Se la matrice della RPC
 * cambia, questa tabella va aggiornata insieme.
 */
const TRANSIZIONI: Record<StatoVoce, Transizione[]> = {
  da_leggere: [{ stato: "in_lettura", etichetta: "Inizia a leggere" }],
  in_lettura: [
    { stato: "in_pausa", etichetta: "Metti in pausa" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  in_pausa: [
    { stato: "in_lettura", etichetta: "Riprendi" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  letto: [
    { stato: "in_lettura", etichetta: "Rileggi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
  abbandonato: [
    { stato: "in_lettura", etichetta: "Riprendi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
};

// Le due azioni frequenti restano sempre in vista, in contorno (mai
// piene: l'unica azione piena della pagina è "Salva" dell'avanzamento).
// Tutte le altre — comprese quelle che annullano una lettura — stanno
// sotto "Altro", in tono piano: design doc §9, punto 1, correzione del
// 20 agosto 2026 ("oggi quattro comandi hanno lo stesso peso e uno di
// essi cancella la lettura in corso"). Gli stati con due sole transizioni
// non hanno bisogno del menù: nascondere l'unica alternativa non
// semplifica nulla.
const FREQUENTI: Partial<Record<StatoVoce, StatoVoce[]>> = {
  in_lettura: ["in_pausa", "letto"],
  in_pausa: ["in_lettura", "letto"],
};

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransizioniStato({ voce }: { voce: VoceDettaglio }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [pendente, setPendente] = useState<Transizione | null>(null);
  const [data, setData] = useState<string>(oggiISO);

  const mutazione = useMutation({
    mutationFn: async ({ stato, conData }: { stato: StatoVoce; conData?: string }) => {
      const token = await getAccessToken();
      const result = await cambiaStato(token, voce.id, stato, conData);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "conflitto"
            ? result.message
            : result.status === "not_found"
              ? "Questa voce non esiste più."
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    onSuccess: () => {
      setPendente(null);
      void queryClient.invalidateQueries({ queryKey: ["voce", voce.id] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : "Non è stato possibile cambiare stato.");
    },
  });

  const opzioni = TRANSIZIONI[voce.stato];
  if (opzioni.length === 0) return null;

  const nomiFrequenti = FREQUENTI[voce.stato];
  const frequenti = nomiFrequenti
    ? opzioni.filter((o) => nomiFrequenti.includes(o.stato))
    : opzioni;
  const altre = nomiFrequenti ? opzioni.filter((o) => !nomiFrequenti.includes(o.stato)) : [];

  function avvia(opzione: Transizione) {
    if (opzione.chiedeData) {
      setData(oggiISO());
      setPendente(opzione);
    } else {
      mutazione.mutate({ stato: opzione.stato });
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {frequenti.map((opzione) => (
          <Button
            key={opzione.stato}
            variant="outline"
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => avvia(opzione)}
          >
            {opzione.etichetta}
          </Button>
        ))}

        {altre.length > 0 && (
          <details className="relative">
            <summary className="t-meta inline-flex h-7 cursor-pointer list-none items-center px-1 text-ink-soft hover:text-ink">
              Altro
            </summary>
            <div className="absolute top-full left-0 z-10 mt-1 flex min-w-40 flex-col gap-0.5 rounded-field border border-line bg-surface-1 p-1 shadow-plane-2">
              {altre.map((opzione) => (
                <button
                  key={opzione.stato}
                  type="button"
                  disabled={mutazione.isPending}
                  onClick={() => avvia(opzione)}
                  className="rounded-object px-2 py-1.5 text-left font-ui text-sm text-ink hover:bg-surface-2"
                >
                  {opzione.etichetta}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>

      {pendente && (
        <div className="flex flex-wrap items-center gap-2">
          <CampoData
            id="data-transizione"
            ariaLabel="Data"
            value={data}
            max={oggiISO()}
            onChange={setData}
          />
          <Button
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => mutazione.mutate({ stato: pendente.stato, conData: data })}
          >
            Conferma
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendente(null)}>
            Annulla
          </Button>
        </div>
      )}
    </div>
  );
}
