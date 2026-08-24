"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { aggiungiVoce, type Voce } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { PastigliaStato } from "@/components/ui/pastiglia-stato";
import { useTranslations } from "next-intl";

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
  const t = useTranslations();

  const mutazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await aggiungiVoce(token, libroId);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? t("assenze.libroSparito") : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) =>
      showError(error instanceof Error ? error.message : t("errori.libroNonAggiunto")),
  });

  return (
    <section className="plane-2 grain p-5">
      <h2 className="t-section">Nella tua libreria</h2>
      {propriaVoce ? (
        <div className="mt-3 flex flex-col items-start gap-2.5">
          <PastigliaStato stato={propriaVoce.stato} />
          {(propriaVoce.voto !== null || formattaContenuti(propriaVoce)) && (
            <p className="t-meta">
              {propriaVoce.voto !== null && `${propriaVoce.voto} stelle`}
              {propriaVoce.voto !== null && formattaContenuti(propriaVoce) && " · "}
              {formattaContenuti(propriaVoce)}
            </p>
          )}
        </div>
      ) : (
        <p className="t-body mt-2 text-sm text-ink-soft">Non ce l&rsquo;hai.</p>
      )}

      <div className="mt-4">
        {propriaVoce ? (
          <Button render={<Link href={`/libro/${propriaVoce.id}`} />} variant="outline" className="w-full">
            Vai alla tua copia
          </Button>
        ) : (
          // L'unica azione della pagina, e agisce sulla TUA libreria, non
          // sulla sua: per questo è piena, e per questo sta in una carta a
          // sé sul piano 2 invece che dentro la scheda (§15).
          <Button className="w-full" disabled={mutazione.isPending} onClick={() => mutazione.mutate()}>
            Aggiungilo
          </Button>
        )}
      </div>
    </section>
  );
}
