import { getMetriche } from "@/lib/api/metriche";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { PaginaAnnali } from "@/components/annali/pagina-annali";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Annali (design-frontend.md §14, issue #7): le proprie metriche di
 * lettura, aggregato su anno solare — mai un dato conservato (ADR 0004),
 * ricalcolato a ogni richiesta. Fetch iniziale lato server per l'anno
 * corrente (il backend lo sceglie da sé quando `anno` è omesso, PRD:
 * fuso Europa centrale), idratato in TanStack Query da `PaginaAnnali`
 * per il cambio d'anno successivo.
 */
export default async function AnnalsPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const result = await getMetriche(session.access_token, undefined, await accettaLinguaInoltrata());

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
