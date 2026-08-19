import { EmptyState } from "@/components/states/empty-state";

/**
 * Root of the protected area: will become the Libreria/Library (design
 * doc §7 "shelf of spines as the default view"), which depends on the
 * Book/Entry entity not yet present on the backend (AGENTS.md, app/models
 * is empty). For now it only verifies that layout, navigation and
 * redirect work.
 */
export default function ProtectedHomePage() {
  return (
    <EmptyState
      title="Nessun contenuto"
      description="Questa pagina è intenzionalmente vuota: verifica il layout dell'area protetta e il redirect al login, non ancora una funzionalità di dominio. Diventerà la Libreria."
    />
  );
}
