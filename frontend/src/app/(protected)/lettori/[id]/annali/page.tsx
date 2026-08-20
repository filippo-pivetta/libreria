import { EmptyState } from "@/components/states/empty-state";

/**
 * Scheda "Annali" del contesto di un collegato (design doc §15,
 * emendamento 20 agosto 2026): visibile e raggiungibile — non nascosta,
 * che suggerirebbe che non è prevista — ma senza dati, perché Metriche
 * di lettura (issue #7) non esiste ancora, nemmeno per la propria
 * libreria. L'accesso è già verificato dal layout di questa cartella.
 * Specifica completa di cosa costruire qui quando #7 esiste:
 * docs/rimandato-annali-collegato.md.
 */
export default function AnnaliCollegatoPage() {
  return (
    <EmptyState
      title="Annali"
      description="Le sue metriche di lettura arrivano con la prossima issue. Quando ci saranno: i suoi numeri dell'anno, il confronto con i tuoi, e i libri che avete letto entrambi."
    />
  );
}
