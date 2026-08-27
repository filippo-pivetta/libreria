"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiPagine } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { IconaMatita } from "@/components/ui/icone";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

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
  const spiega = useMessaggioErrore();
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
        // La frase del conflitto non è più scritta qui: arriva
        // dall'`error_code` del 409 (`regole.*` nel catalogo), quindi
        // esiste anche in inglese e non va tenuta allineata a mano con
        // quella del backend.
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
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
        spiega("pagineNonCorrette", erroreDi(error)),
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
      showError(t("regole.pagine_non_valide"));
      setValore(salvato !== null ? String(salvato) : "");
      return;
    }
    if (numero !== salvato) {
      mutazione.mutate(numero);
    }
  }

  // Prima: un campo numerico con il bordo inferiore tratteggiato di 1px e
  // il segnaposto "correggi". Non si leggeva come un comando e non si
  // leggeva nemmeno come un campo. Ora è un bersaglio con la sua matita —
  // resta un campo, non un bottone che apre qualcosa, ma dentro un
  // riquadro che dice di poterci scrivere.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-field border border-line bg-surface-1 py-1 pr-2 pl-2.5 transition-colors duration-(--dur-micro) hover:border-line-strong has-focus-visible:border-line-strong">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={valore}
        placeholder="—"
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
        className="w-[4ch] border-0 bg-transparent p-0 font-ui text-sm tabular-nums text-ink outline-none placeholder:text-ink-soft"
      />
      <IconaMatita aria-hidden className="size-3.5 shrink-0 text-ink-soft" />
      <Messaggio tono="conferma">{conferma.visibile ? t("conferme.salvato") : ""}</Messaggio>
    </span>
  );
}
