"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiVoto } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { IconaStella } from "@/components/ui/icone";
import { ErroreApp, assenza } from "@/lib/api/errore";
import { useAvvisa } from "@/lib/messaggi-errore";

const STELLE = [1, 2, 3, 4, 5] as const;

/** Esportata per la striscia "libri in comune" degli Annali del
 * collegato: stesso formato di un voto ovunque compaia. */
export function formattaVoto(voto: number): string {
  return Number.isInteger(voto) ? String(voto) : voto.toFixed(1).replace(".", ",");
}

/**
 * Una stella, riempita da 0 a 1 (0,5 = mezza).
 *
 * Prima erano i caratteri `★` e `☆`, con l'aletta piena ritagliata in
 * percentuale sopra il contorno vuoto. Funzionava, ma un glifo è testo:
 * il disegno, il peso e la larghezza li sceglie il carattere che il
 * sistema decide di usare per quel codepoint, e non è quasi mai quello
 * dell'app. Ora è un tracciato su griglia 24, e il mezzo riempimento è un
 * gradiente a due fermate sullo stesso punto invece di un ritaglio.
 *
 * Esportata per la striscia "libri in comune" degli Annali.
 */
export function Stella({ riempimento, chiave }: { riempimento: number; chiave: string }) {
  return (
    <IconaStella
      riempimento={riempimento}
      gradientId={`stella-${chiave}`}
      className="size-full"
    />
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
  const avvisa = useAvvisa();
  const [anteprima, setAnteprima] = useState<number | null>(null);

  const mutazione = useMutation({
    mutationFn: async (nuovoVoto: number) => {
      const token = await getAccessToken();
      const result = await correggiVoto(token, voceId, nuovoVoto === voto ? null : nuovoVoto);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown, nuovoVoto: number) =>
      avvisa(showError, "votoNonSalvato", error, () => mutazione.mutate(nuovoVoto)),
  });

  if (!isOwner) {
    if (voto === null) return null;
    return (
      <div className="flex items-center gap-3.5">
        <span className="flex gap-0.5 text-ink-soft">
          {STELLE.map((n) => (
            <span key={n} className="size-6">
              <Stella riempimento={voto - (n - 1)} chiave={`suo-${voceId}-${n}`} />
            </span>
          ))}
        </span>
        <span className="t-body text-sm text-ink-soft">il suo voto · {formattaVoto(voto)}</span>
      </div>
    );
  }

  const mostrato = anteprima ?? voto ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div
        role="group"
        aria-label={`Il tuo voto, ${voto !== null ? formattaVoto(voto) : "nessuno"} stelle su cinque`}
        className="flex gap-1 text-accent-strong sm:gap-0.5"
        onMouseLeave={() => setAnteprima(null)}
      >
        {STELLE.map((n) => (
          // La stella cresce dove c'è un dito: `--stella` vale 28px col
          // mouse e 40px sotto `pointer: coarse` (tokens.css). È un gesto
          // di precisione — mezze stelle, cioè due bersagli dentro la
          // larghezza di uno — e l'unico modo di renderlo praticabile al
          // tocco è ingrandire la stella, perché i due bersagli non
          // possono allargarsi ciascuno per conto suo.
          <span
            key={n}
            className="relative inline-block size-(--stella) transition-[translate] duration-(--dur-micro) ease-(--ease-rise) hover:z-10 hover:-translate-y-0.5"
          >
            <Stella riempimento={mostrato - (n - 1)} chiave={`mio-${voceId}-${n}`} />
            <span className="absolute inset-0 flex">
              <button
                type="button"
                disabled={mutazione.isPending}
                aria-label={`${formattaVoto(n - 0.5)} stelle`}
                onMouseEnter={() => setAnteprima(n - 0.5)}
                onFocus={() => setAnteprima(n - 0.5)}
                onClick={() => mutazione.mutate(n - 0.5)}
                className="h-full w-1/2 rounded-l-sm outline-none"
              />
              <button
                type="button"
                disabled={mutazione.isPending}
                aria-label={`${formattaVoto(n)} stelle`}
                onMouseEnter={() => setAnteprima(n)}
                onFocus={() => setAnteprima(n)}
                onClick={() => mutazione.mutate(n)}
                className="h-full w-1/2 rounded-r-sm outline-none"
              />
            </span>
          </span>
        ))}
      </div>
      <span className="t-body text-sm">
        {voto !== null ? (
          <>
            {formattaVoto(voto)} su 5
            <span className="text-ink-soft"> · premi di nuovo per toglierlo</span>
          </>
        ) : (
          <span className="text-ink-soft">Non l&rsquo;hai ancora votato</span>
        )}
      </span>
    </div>
  );
}
