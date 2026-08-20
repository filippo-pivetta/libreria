import { EmptyState } from "@/components/states/empty-state";

/**
 * Placeholder (design doc §14 "Annali"/Annals): metrics per year. Lettura
 * and Avanzamento already exist on the backend (repositories, router,
 * schema); what's missing is the metrics/aggregation endpoint itself
 * (issue #7) — this route already exists in the right place, ready for
 * the real screen once that endpoint lands.
 */
export default function AnnalsPage() {
  return (
    <EmptyState
      title="Annali"
      description="Le metriche per anno arrivano con le prime letture registrate. Questa pagina è pronta ad accoglierle."
    />
  );
}
