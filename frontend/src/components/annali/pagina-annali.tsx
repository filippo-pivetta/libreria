"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getMetriche, type Metriche } from "@/lib/api/metriche";
import { getAccessToken } from "@/lib/api/access-token";
import { CarteMetriche } from "@/components/annali/carte-metriche";
import { IntestazioneAnnali } from "@/components/annali/intestazione-annali";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { ERRORE_SERVER, ErroreApp, erroreDi, regola } from "@/lib/api/errore";
import type { ErroreApi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/**
 * Gli esiti non-ok delle metriche, tradotti in `ErroreApi`.
 *
 * Prima era una `messaggioErrore(result, t)` per file, che scriveva le
 * frasi a mano — "Gli anni futuri non sono selezionabili." era italiano
 * fisso in due copie, e il caso `error` ricadeva su `result.message`,
 * cioè sulla stringa di trasporto. Qui si classifica soltanto: la frase
 * la compone `spiega()` più in basso, dal catalogo.
 */
function erroreDelRisultato(result: {
  status: string;
  errore?: ErroreApi;
}): ErroreApi {
  if (result.status === "anno_futuro") return regola("anno_futuro");
  return result.errore ?? ERRORE_SERVER;
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
  const spiega = useMessaggioErrore();
  const [anno, setAnno] = useState(metricheIniziali.anno);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["metriche", anno],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMetriche(token, anno);
      if (result.status !== "ok") throw new ErroreApp(erroreDelRisultato(result));
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
        message={spiega("metricheNonCaricate", erroreDi(error))}
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
