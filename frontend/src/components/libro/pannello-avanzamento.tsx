"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registraAvanzamento, type Avanzamento } from "@/lib/api/avanzamenti";
import { getAccessToken } from "@/lib/api/access-token";
import type { Lettura, VoceDettaglio } from "@/lib/api/voci";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";

// Token stabili sollevati dal trigger trg_avanzamento_valida
// (docs/adr/0015), tradotti qui invece che nel messaggio grezzo di
// Postgres, che arriva in italiano ma non è pensato per essere mostrato
// così com'è.
const MESSAGGI_ERRORE: Record<string, string> = {
  avanzamento_data_futura: "La data non può essere nel futuro.",
  avanzamento_data_regressiva: "La data precede l'ultimo avanzamento registrato.",
  avanzamento_pagina_regressiva: "La pagina è inferiore a quella già raggiunta.",
  avanzamento_pagina_supera_successivo: "La pagina supera un avanzamento successivo.",
  avanzamento_data_supera_successivo: "La data supera un avanzamento successivo.",
  avanzamento_oltre_pagine_adottate: "La pagina supera le pagine adottate per questa copia.",
};

type ContestoOttimistico = { precedente: VoceDettaglio | undefined };
type ValoriAvanzamento = { pagina: number; data: string };

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registrazione dell'avanzamento (design doc §12). Numero e data, con
 * salvataggio ottimistico. Il segnalibro trascinabile del design doc
 * ("Inserimento") non è implementato qui — rimosso su richiesta esplicita
 * dopo un primo tentativo, resta come descrizione nel design doc per un
 * secondo passaggio futuro, non nel codice.
 *
 * Niente limiti dichiarati in anticipo ("tra X e Y", "non prima del..."):
 * un tentativo fuori scala produce un rifiuto (toast), non un
 * avvertimento preventivo — deviazione esplicita da design-frontend.md
 * §12, annotata nel documento.
 */
export function PannelloAvanzamento({
  voceId,
  lettura,
  pagineAdottate,
  onPaginaChange,
}: {
  voceId: string;
  lettura: Lettura;
  pagineAdottate: number | null;
  /** Riportata alla scheda a ogni tocco del campo, così la barra sopra
   * (design doc §9, punto 8: "quello che avevi in ink-soft, quello che
   * aggiungi adesso in accent") può colorare il tratto in più — nessun
   * trascinamento coinvolto, solo il valore del campo numerico. `null`
   * dopo un salvataggio riuscito: il tratto in più torna a far parte di
   * quello "già letto" non appena i dati freschi arrivano. */
  onPaginaChange?: (valore: number | null) => void;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const ultimo = lettura.avanzamenti.at(-1);
  const minimo = ultimo?.pagina ?? 0;
  const dataMinima = ultimo?.data ?? lettura.dataInizio;
  const [pagina, setPagina] = useState(String(minimo));
  const [data, setData] = useState(oggiISO);

  const mutazione = useMutation<Avanzamento, Error, ValoriAvanzamento, ContestoOttimistico>({
    mutationFn: async ({ pagina: valore, data: dataScelta }) => {
      const token = await getAccessToken();
      const result = await registraAvanzamento(token, lettura.id, valore, dataScelta);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "non_valido"
            ? (MESSAGGI_ERRORE[result.errorCode] ?? result.message)
            : result.status === "not_found"
              ? "La lettura non esiste più."
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    // Salvataggio ottimistico (design doc §12): il numero si aggiorna
    // subito, la conferma arriva dopo. Se fallisce, onError riporta la
    // cache com'era prima e mostra un toast.
    onMutate: async ({ pagina: valore, data: dataScelta }) => {
      await queryClient.cancelQueries({ queryKey: ["voce", voceId] });
      const precedente = queryClient.getQueryData<VoceDettaglio>(["voce", voceId]);

      queryClient.setQueryData<VoceDettaglio>(["voce", voceId], (voce) => {
        if (!voce) return voce;
        return {
          ...voce,
          letture: voce.letture.map((l) =>
            l.id === lettura.id
              ? {
                  ...l,
                  avanzamenti: [
                    ...l.avanzamenti,
                    {
                      id: `ottimistico-${Date.now()}`,
                      pagina: valore,
                      data: dataScelta,
                      generatoAutomaticamente: false,
                    },
                  ],
                }
              : l,
          ),
        };
      });

      return { precedente };
    },
    onError: (error, _valori, context) => {
      if (context?.precedente) {
        queryClient.setQueryData(["voce", voceId], context.precedente);
      }
      showError(error.message);
    },
    onSuccess: () => {
      onPaginaChange?.(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valore = Number(pagina);
    if (!Number.isFinite(valore) || valore < 0) {
      showError("Inserisci un numero di pagina valido.");
      return;
    }
    mutazione.mutate({ pagina: valore, data });
  }

  const valoreNumerico = Number(pagina);
  const paginaValida = Number.isFinite(valoreNumerico) ? valoreNumerico : minimo;
  const incremento = paginaValida >= minimo ? paginaValida - minimo : null;

  // noValidate: la convalida nativa del browser mostra un fumetto non
  // testuale, contro la regola di scrittura del design doc (§19).
  // min/max restano come suggerimento per tastiera numerica e screen
  // reader; il rifiuto vero resta lato server (trg_avanzamento_valida).
  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2" noValidate>
      <label className="t-label" htmlFor="pagina-avanzamento">
        Pagina raggiunta
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="pagina-avanzamento"
          type="number"
          inputMode="numeric"
          min={minimo}
          max={pagineAdottate ?? undefined}
          value={pagina}
          onChange={(event) => {
            setPagina(event.target.value);
            const valore = Number(event.target.value);
            if (Number.isFinite(valore)) onPaginaChange?.(valore);
          }}
          className="w-24"
        />
        <CampoData
          ariaLabel="Data dell'avanzamento"
          value={data}
          min={dataMinima}
          max={oggiISO()}
          onChange={setData}
        />
        <Button type="submit" size="sm" disabled={mutazione.isPending}>
          Salva
        </Button>
      </div>
      {/* Design doc §12: mostra l'incremento mentre lo si crea — "è
      anche l'unico numero gratificante", insegna il modello (somma degli
      incrementi) facendolo. Non è un limite dichiarato in anticipo. */}
      {incremento !== null && incremento > 0 && (
        <p className="t-meta t-num">+{incremento} pagine</p>
      )}
    </form>
  );
}
