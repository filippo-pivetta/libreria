"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiPagine } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";

/**
 * Correzione delle pagine adottate (design doc §12): si clicca sul
 * numero, si scrive, si esce dal campo — salva da solo, senza un
 * bottone "Salva" a parte. Campo vuoto = nessun totale
 * (`pagine_adottate = null`): la Voce continua ad accettare avanzamenti
 * senza tetto (PRD, regola 14).
 *
 * Il blur non è di per sé un gesto di conferma come lo è un clic su
 * "Salva": una riga discreta ("Salvato.") compare per un momento e
 * sparisce, mai un toast — quello resta riservato agli errori (design
 * doc §19).
 */
export function CorreggiPagine({
  voceId,
  pagineAdottate,
}: {
  voceId: string;
  pagineAdottate: number | null;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const t = useTranslations();
  const [valore, setValore] = useState(pagineAdottate !== null ? String(pagineAdottate) : "");
  // Ultimo valore confermato — dalla prop in arrivo o da una scrittura
  // riuscita: usato per non salvare quando si esce dal campo senza
  // averlo cambiato, e per tornare indietro se il nuovo valore non è
  // valido o la scrittura fallisce. Se `pagineAdottate` cambia da fuori,
  // si adegua durante il render invece che in un effetto — pattern
  // React documentato per "adjusting state when a prop changes", niente
  // rendering doppio, niente ref toccata in render.
  const [salvato, setSalvato] = useState(pagineAdottate);
  if (pagineAdottate !== salvato) {
    setSalvato(pagineAdottate);
    setValore(pagineAdottate !== null ? String(pagineAdottate) : "");
  }
  const conferma = useConfermaEffimera();

  const mutazione = useMutation({
    mutationFn: async (nuovoValore: number | null) => {
      const token = await getAccessToken();
      const result = await correggiPagine(token, voceId, nuovoValore);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "conflitto"
            ? "Il nuovo totale è inferiore a un avanzamento già registrato."
            : result.status === "not_found"
              ? t("assenze.voceSparita")
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    onSuccess: (voce) => {
      setSalvato(voce.pagineAdottate);
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
      conferma.mostra();
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : t("errori.pagineNonCorrette"),
      );
      setValore(salvato !== null ? String(salvato) : "");
    },
  });

  function salvaSeCambiato() {
    if (valore.trim() === "") {
      if (salvato !== null) mutazione.mutate(null);
      return;
    }
    const numero = Number(valore);
    if (!Number.isFinite(numero) || numero <= 0) {
      showError(t("errori.pagineNonValide"));
      setValore(salvato !== null ? String(salvato) : "");
      return;
    }
    if (numero !== salvato) {
      mutazione.mutate(numero);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={valore}
        placeholder="correggi"
        aria-label="Pagine totali di questa copia"
        onChange={(event) => setValore(event.target.value)}
        onBlur={salvaSeCambiato}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setValore(salvato !== null ? String(salvato) : "");
            event.currentTarget.blur();
          }
        }}
        className="w-16 border-0 border-b border-dashed border-line-strong bg-transparent p-0 font-ui text-sm text-ink outline-none placeholder:text-ink-soft focus-visible:border-solid focus-visible:border-ink"
      />
      <Messaggio tono="conferma">{conferma.visibile ? "Salvato." : ""}</Messaggio>
    </span>
  );
}
