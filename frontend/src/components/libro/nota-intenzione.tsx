"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiNotaIntenzione } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { ASSENZE, ERRORI } from "@/messaggi/it";

/**
 * Nota di intenzione (design doc §9): solo il proprietario la vede, mai
 * un collegato — questo componente non riceve mai `isOwner`, perché
 * chi chiama (Scheda) non lo monta affatto per una voce altrui.
 *
 * Si scrive e si esce dal campo: salva da solo, senza "Salva"/"Annulla"
 * — stesso pattern di `CorreggiPagine`. A differenza di un bottone
 * esplicito, il blur non è di per sé un gesto di conferma: una riga
 * discreta ("Salvato.") compare per un momento e sparisce, mai un
 * toast — quello resta riservato agli errori (design doc §19).
 */
export function NotaIntenzione({
  voceId,
  notaIntenzione,
}: {
  voceId: string;
  notaIntenzione: string | null;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [aperta, setAperta] = useState(notaIntenzione !== null);
  const [testo, setTesto] = useState(notaIntenzione ?? "");
  const conferma = useConfermaEffimera();

  const mutazione = useMutation({
    mutationFn: async (valore: string | null) => {
      const token = await getAccessToken();
      const result = await correggiNotaIntenzione(token, voceId, valore);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? ASSENZE.voceSparita : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      conferma.mostra();
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : ERRORI.notaNonSalvata);
      setTesto(notaIntenzione ?? "");
    },
  });

  function salvaSeCambiato() {
    const finale = testo.trim() === "" ? null : testo.trim();
    if (finale !== (notaIntenzione ?? null)) {
      mutazione.mutate(finale);
    }
  }

  if (!aperta) {
    return (
      <button
        type="button"
        onClick={() => setAperta(true)}
        className="t-meta tocco-esteso mb-5 block w-fit underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        Aggiungi una nota di intenzione
      </button>
    );
  }

  return (
    <div className="pannello mb-5 rounded-card border border-line bg-surface-2 p-4">
      <p className="t-label mb-2">Nota di intenzione</p>
      <textarea
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        onBlur={salvaSeCambiato}
        rows={3}
        placeholder="Perché vuoi leggerlo, o chi te l’ha consigliato…"
        className="w-full resize-none border-0 bg-transparent font-ui text-sm text-ink outline-none placeholder:text-ink-soft"
      />
      <Messaggio tono="conferma" className="mt-2">{conferma.visibile ? "Salvato." : ""}</Messaggio>
    </div>
  );
}
