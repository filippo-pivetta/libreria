import { EmptyState } from "@/components/states/empty-state";

/**
 * Unica pagina dell'area protetta in questo scheletro: verifica che
 * layout, navigazione e redirect funzionino, senza alcuna schermata di
 * dominio. Le prime schermate reali sostituiranno questo contenuto.
 */
export default function ProtectedHomePage() {
  return (
    <EmptyState
      title="Nessun contenuto"
      description="Questa pagina è intenzionalmente vuota: verifica il layout dell'area protetta e il redirect al login, non ancora una funzionalità di dominio."
    />
  );
}
