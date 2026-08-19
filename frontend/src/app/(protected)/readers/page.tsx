import { EmptyState } from "@/components/states/empty-state";

/**
 * Placeholder (design doc §16 "Lettori"/Readers): list of connected
 * members. Waiting on the Collegamento/Connection entity on the backend —
 * this route already exists in the right place, ready for the real
 * screen.
 */
export default function ReadersPage() {
  return (
    <EmptyState
      title="Lettori"
      description="L'elenco dei collegati arriva con la prima richiesta di collegamento. Questa pagina è pronta ad accoglierlo."
    />
  );
}
