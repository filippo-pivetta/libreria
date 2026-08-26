"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getMetriche, type Metriche } from "@/lib/api/metriche";
import { getAccessToken } from "@/lib/api/access-token";
import { CarteMetriche } from "@/components/annali/carte-metriche";
import { IntestazioneAnnali } from "@/components/annali/intestazione-annali";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { useTranslations } from "next-intl";

function messaggioErrore(
  result: { status: string; message?: string },
  t: (chiave: string) => string,
): string {
  if (result.status === "anno_futuro") return "Gli anni futuri non sono selezionabili.";
  if (result.status === "error" && result.message) return result.message;
  return t("errori.metricheNonCaricate");
}

/**
 * Pagina Annali propria (design-frontend.md §14, issue #7). Fetch
 * iniziale lato server (`app/(protected)/annals/page.tsx`), idratato qui
 * in TanStack Query per il cambio d'anno — stesso pattern di
 * `ElencoLettori`/`SezioneCollegamenti`: l'anno iniziale arriva già
 * risolto dal backend (PRD, anno corrente in Europa centrale), i cambi
 * successivi rifanno la richiesta con l'anno scelto.
 */
export function PaginaAnnali({ metricheIniziali }: { metricheIniziali: Metriche }) {
  const t = useTranslations();
  const [anno, setAnno] = useState(metricheIniziali.anno);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["metriche", anno],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMetriche(token, anno);
      if (result.status !== "ok") throw new Error(messaggioErrore(result, t));
      return result.data;
    },
    initialData: anno === metricheIniziali.anno ? metricheIniziali : undefined,
    // Senza questo, cambiare anno faceva sparire la carta intera per un
    // istante (`isPending` torna vero su una chiave nuova senza dati):
    // stesso scatto che `pensiero-che-torna.tsx` documenta e risolve
    // allo stesso modo. Con `keepPreviousData` l'anno VECCHIO resta a
    // schermo mentre il nuovo arriva in sottofondo.
    placeholderData: keepPreviousData,
  });

  if (isPending) return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroAnnali />
      </div>
    );
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t("errori.metricheNonCaricate")}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <IntestazioneAnnali
        anno={anno}
        annoMinimo={data.annoMinimo}
        annoMassimo={data.annoMassimo}
        onCambiaAnno={setAnno}
      />
      <CarteMetriche metriche={data} />
    </div>
  );
}
