"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiVoto } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";

const STELLE = [1, 2, 3, 4, 5] as const;

/** Esportata per la striscia "libri in comune" degli Annali del
 * collegato (issue #7, docs/rimandato-annali-collegato.md §4): stesso
 * formato di un voto ovunque compaia. */
export function formattaVoto(voto: number): string {
  return Number.isInteger(voto) ? String(voto) : voto.toFixed(1).replace(".", ",");
}

/** Una stella, riempita da 0 a 1 (0.5 = mezza stella): un'aletta piena
 * ritagliata in percentuale sopra il contorno vuoto, non due glifi
 * scelti a scatti — l'unico modo per rendere una mezza stella con un
 * carattere di testo. Esportata per lo stesso motivo di `formattaVoto`. */
export function Stella({ riempimento }: { riempimento: number }) {
  return (
    <span className="relative inline-block" aria-hidden>
      <span className="text-line-strong">☆</span>
      {riempimento > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${Math.min(1, riempimento) * 100}%` }}
        >
          ★
        </span>
      )}
    </span>
  );
}

/**
 * Voto in stelle, mezze comprese (design doc §9). Proprietario: ogni
 * stella è due zone cliccabili (metà sinistra = X,5, metà destra = X) e
 * si solleva al passaggio del mouse — un bersaglio più grande per un
 * gesto di precisione, stesso linguaggio del sollevamento sullo
 * scaffale (§7). Un secondo clic sul valore già scelto cancella il
 * voto. Collegato: sola lettura, "il suo voto" — e nessuna riga se non
 * ha votato ("l'assenza è muta", §15).
 */
export function VotoStelle({
  voceId,
  voto,
  isOwner,
}: {
  voceId: string;
  voto: number | null;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [anteprima, setAnteprima] = useState<number | null>(null);

  const mutazione = useMutation({
    mutationFn: async (nuovoVoto: number) => {
      const token = await getAccessToken();
      const result = await correggiVoto(token, voceId, nuovoVoto === voto ? null : nuovoVoto);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? "Questa voce non esiste più." : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) =>
      showError(error instanceof Error ? error.message : "Non è stato possibile salvare il voto."),
  });

  if (!isOwner) {
    if (voto === null) return null;
    return (
      <div className="mb-4 flex items-center gap-3">
        <span className="flex text-lg text-accent-strong">
          {STELLE.map((n) => (
            <Stella key={n} riempimento={voto - (n - 1)} />
          ))}
        </span>
        <span className="t-meta">il suo voto · {formattaVoto(voto)}</span>
      </div>
    );
  }

  const mostrato = anteprima ?? voto ?? 0;

  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        role="group"
        aria-label={`Il tuo voto, ${voto !== null ? formattaVoto(voto) : "nessuno"} stelle su cinque`}
        className="flex text-lg text-accent-strong"
        onMouseLeave={() => setAnteprima(null)}
      >
        {STELLE.map((n) => (
          <span
            key={n}
            className="relative inline-block transition-transform duration-150 ease-out hover:z-10 hover:scale-125"
          >
            <Stella riempimento={mostrato - (n - 1)} />
            <span className="absolute inset-0 flex">
              <button
                type="button"
                disabled={mutazione.isPending}
                aria-label={`${formattaVoto(n - 0.5)} stelle`}
                onMouseEnter={() => setAnteprima(n - 0.5)}
                onFocus={() => setAnteprima(n - 0.5)}
                onClick={() => mutazione.mutate(n - 0.5)}
                className="h-full w-1/2 outline-none"
              />
              <button
                type="button"
                disabled={mutazione.isPending}
                aria-label={`${formattaVoto(n)} stelle`}
                onMouseEnter={() => setAnteprima(n)}
                onFocus={() => setAnteprima(n)}
                onClick={() => mutazione.mutate(n)}
                className="h-full w-1/2 outline-none"
              />
            </span>
          </span>
        ))}
      </div>
      <span className="t-meta">{voto !== null ? `il tuo voto · ${formattaVoto(voto)}` : "il tuo voto"}</span>
    </div>
  );
}
