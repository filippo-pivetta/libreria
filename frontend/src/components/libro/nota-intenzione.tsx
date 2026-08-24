"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiNotaIntenzione } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { Invito } from "@/components/ui/invito";
import { IconaLucchetto } from "@/components/ui/icone";

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
  const t = useTranslations();
  const [aperta, setAperta] = useState(notaIntenzione !== null);
  const [testo, setTesto] = useState(notaIntenzione ?? "");
  const conferma = useConfermaEffimera();

  const mutazione = useMutation({
    mutationFn: async (valore: string | null) => {
      const token = await getAccessToken();
      const result = await correggiNotaIntenzione(token, voceId, valore);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? t("assenze.voceSparita") : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      conferma.mostra();
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : t("errori.notaNonSalvata"));
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
    return <Invito onClick={() => setAperta(true)}>Aggiungi una nota di intenzione</Invito>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="t-section font-medium text-ink-soft">Nota di intenzione</span>
        {/* La nota nasce privata e resta tale, sempre (PRD): non c'è un
            interruttore da offrire, quindi il segno è fermo e lo dice. */}
        <span className="t-meta inline-flex items-center gap-2">
          <IconaLucchetto className="size-[0.9375rem] shrink-0" />
          Solo tua, mai condivisa
        </span>
      </div>
      <div className="pannello rounded-field border border-line bg-surface-2 p-4 sm:px-[1.125rem]">
      <textarea
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        onBlur={salvaSeCambiato}
        rows={3}
        placeholder="Perché vuoi leggerlo, o chi te l’ha consigliato…"
          className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
        />
        <Messaggio tono="conferma" className="mt-2">{conferma.visibile ? "Salvato." : ""}</Messaggio>
      </div>
    </div>
  );
}
