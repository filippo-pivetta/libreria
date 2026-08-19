import { EmptyState } from "@/components/states/empty-state";

/**
 * Placeholder (design doc §17 "Torre"/Tower): connections and settings
 * (visibility notice, assisted-processing consent, account deletion). The
 * two long-form texts already exist, word for word, in
 * app/(public)/completa-account/page.tsx (where the user accepts them the
 * first time) and should be carried over identically when this screen
 * gets built. This route already exists in the right place.
 */
export default function TowerPage() {
  return (
    <EmptyState
      title="Torre"
      description="Collegamenti e impostazioni arrivano con l'entità Collegamento lato backend. Questa pagina è pronta ad accoglierli."
    />
  );
}
