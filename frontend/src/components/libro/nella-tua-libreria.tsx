"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { aggiungiVoce, type Voce } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { ASSENZE, ERRORI } from "@/messaggi/it";

const ETICHETTA_STATO: Record<string, string> = {
  da_leggere: "Da leggere",
  in_lettura: "In lettura",
  in_pausa: "In pausa",
  letto: "Letto",
  abbandonato: "Abbandonato",
};

/** "una recensione, tre insight" — un conteggio, non un'anteprima:
 * nessun gating spoiler in gioco qui. */
function formattaContenuti(voce: Voce): string {
  const parti: string[] = [];
  if (voce.haRecensione) parti.push("una recensione");
  if (voce.numeroInsight > 0) {
    parti.push(voce.numeroInsight === 1 ? "un insight" : `${voce.numeroInsight} insight`);
  }
  return parti.join(", ");
}

/**
 * "Nella tua libreria" (design doc §9, §15): sta fuori dalla scheda del
 * collegato, con un'etichetta che dice di chi è — la sua pagina resta
 * senza un solo comando che agisca sui SUOI dati. Il bottone "Aggiungi"
 * agisce sulla tua libreria, non sulla sua: non nasce una via
 * d'ingresso nuova, la scheda esiste già nel sistema (è l'issue #4 a
 * costruire la ricerca, non questo).
 */
export function NellaTuaLibreria({
  libroId,
  propriaVoce,
}: {
  libroId: string;
  propriaVoce: Voce | null;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();

  const mutazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await aggiungiVoce(token, libroId);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? ASSENZE.libroSparito : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) =>
      showError(error instanceof Error ? error.message : ERRORI.libroNonAggiunto),
  });

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card border border-line-strong bg-surface-2 p-5">
      <div className="min-w-0">
        <p className="t-label mb-1">Nella tua libreria</p>
        {propriaVoce ? (
          <p className="font-ui text-sm text-ink">
            {ETICHETTA_STATO[propriaVoce.stato]}
            {propriaVoce.voto ? ` · ${propriaVoce.voto} stelle` : ""}
            {formattaContenuti(propriaVoce) && ` · ${formattaContenuti(propriaVoce)}`}
          </p>
        ) : (
          <p className="font-ui text-sm text-ink-soft">Non è nella tua libreria.</p>
        )}
      </div>
      <div className="ml-auto shrink-0">
        {propriaVoce ? (
          <Link
            href={`/libro/${propriaVoce.id}`}
            className="t-meta inline-flex h-7 items-center rounded-field border border-line-strong px-2.5 text-ink hover:bg-surface-1"
          >
            Vai alla tua copia
          </Link>
        ) : (
          <Button size="sm" disabled={mutazione.isPending} onClick={() => mutazione.mutate()}>
            Aggiungi
          </Button>
        )}
      </div>
    </div>
  );
}
