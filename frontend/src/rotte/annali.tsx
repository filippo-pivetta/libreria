import { Suspense } from "react";

import { metricheMie } from "@/lib/dati/metriche";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { PaginaAnnali } from "@/components/annali/pagina-annali";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Annali (design-frontend.md §14, issue #7): le proprie metriche di
 * lettura, aggregato su anno solare — mai un dato conservato (ADR 0004),
 * ricalcolato a ogni richiesta. L'anno corrente lo sceglie il backend
 * quando `anno` è omesso (PRD: fuso Europa centrale), e `PaginaAnnali`
 * idrata il risultato in TanStack Query per il cambio d'anno successivo.
 */
export default function AnnalsPage() {
  return (
    <Suspense fallback={<ScheletroAnnali />}>
      <Annali />
    </Suspense>
  );
}

async function Annali() {
  const result = await metricheMie();

  if (result.status !== "ok") {
    return (
      <ErrorState
        message={await messaggioErrore(
          "metricheNonCaricate",
          result.status === "error" ? result.errore : undefined,
        )}
      />
    );
  }

  return <PaginaAnnali metricheIniziali={result.data} />;
}
