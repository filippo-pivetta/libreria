"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiPagine } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Correzione delle pagine adottate (design doc §12, "Correggi il
 * totale": "via d'uscita visibile nel momento del blocco"). Campo vuoto
 * = nessun totale (`pagine_adottate = null`): la Voce continua ad
 * accettare avanzamenti senza tetto (PRD, regola 14).
 */
export function CorreggiPagine({
  voceId,
  pagineAdottate,
  onChiudi,
}: {
  voceId: string;
  pagineAdottate: number | null;
  onChiudi: () => void;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [valore, setValore] = useState(pagineAdottate !== null ? String(pagineAdottate) : "");

  const mutazione = useMutation({
    mutationFn: async (nuovoValore: number | null) => {
      const token = await getAccessToken();
      const result = await correggiPagine(token, voceId, nuovoValore);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "conflitto"
            ? "Il nuovo totale è inferiore a un avanzamento già registrato."
            : result.status === "not_found"
              ? "Questa voce non esiste più."
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
      onChiudi();
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile correggere le pagine.",
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valore.trim() === "") {
      mutazione.mutate(null);
      return;
    }
    const numero = Number(valore);
    if (!Number.isFinite(numero) || numero <= 0) {
      showError("Inserisci un numero di pagine valido.");
      return;
    }
    mutazione.mutate(numero);
  }

  return (
    // noValidate: l'errore resta un toast (design doc §19, deviazione
    // annotata), mai il fumetto nativo del browser.
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2" noValidate>
      <label className="t-label" htmlFor="pagine-adottate">
        Pagine totali di questa copia
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="pagine-adottate"
          type="number"
          inputMode="numeric"
          min={1}
          value={valore}
          onChange={(event) => setValore(event.target.value)}
          className="w-24"
          placeholder="nessuna"
        />
        <Button type="submit" size="sm" disabled={mutazione.isPending}>
          Salva
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onChiudi}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
