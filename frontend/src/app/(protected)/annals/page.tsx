import { getMetriche } from "@/lib/api/metriche";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { PaginaAnnali } from "@/components/annali/pagina-annali";
import { ERRORI, SESSIONE } from "@/messaggi/it";

/**
 * Annali (design-frontend.md §14, issue #7): le proprie metriche di
 * lettura, aggregato su anno solare — mai un dato conservato (ADR 0004),
 * ricalcolato a ogni richiesta. Fetch iniziale lato server per l'anno
 * corrente (il backend lo sceglie da sé quando `anno` è omesso, PRD:
 * fuso Europa centrale), idratato in TanStack Query da `PaginaAnnali`
 * per il cambio d'anno successivo.
 */
export default async function AnnalsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={SESSIONE.scaduta} />;
  }

  const result = await getMetriche(session.access_token);

  if (result.status !== "ok") {
    return (
      <ErrorState
        message={
          result.status === "error"
            ? result.message
            : ERRORI.metricheNonCaricate
        }
      />
    );
  }

  return <PaginaAnnali metricheIniziali={result.data} />;
}
