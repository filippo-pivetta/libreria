import { EmptyState } from "@/components/states/empty-state";

/**
 * Placeholder (design doc §14 "Annali"/Annals): metrics per year. Waiting
 * on the domain entities (Lettura/Reading, Avanzamento/Progress) on the
 * backend — app/models is still empty, see AGENTS.md — this route already
 * exists in the right place, ready for the real screen.
 */
export default function AnnalsPage() {
  return (
    <EmptyState
      title="Annali"
      description="Le metriche per anno arrivano con le prime letture registrate. Questa pagina è pronta ad accoglierle."
    />
  );
}
