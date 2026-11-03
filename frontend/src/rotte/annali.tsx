import { useQuery } from "@tanstack/react-query";

import { metricheMie } from "@/lib/dati/metriche";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { PaginaAnnali } from "@/components/annali/pagina-annali";

/**
 * Annali (design-frontend.md §14, issue #7): le proprie metriche di
 * lettura, aggregato su anno solare — mai un dato conservato (ADR 0004),
 * ricalcolato a ogni richiesta. L'anno corrente lo sceglie il backend
 * quando `anno` è omesso (PRD: fuso Europa centrale), e `PaginaAnnali`
 * riceve il risultato come dato iniziale per il cambio d'anno successivo.
 */
export default function AnnalsPage() {
  const spiega = useMessaggioErrore();
  const { data: result, isPending, refetch } = useQuery(metricheMie());

  if (isPending) return <ScheletroAnnali />;

  if (!result || result.status !== "ok") {
    return (
      <ErrorState
        message={spiega(
          "metricheNonCaricate",
          result?.status === "error" ? result.errore : undefined,
        )}
        azione={<RiprovaRotta riprova={refetch} />}
      />
    );
  }

  return <PaginaAnnali metricheIniziali={result.data} />;
}
