/**
 * Chrome dell'area pubblica: nessuna navigazione, solo il contenuto
 * centrato. Ospita `/login` e `/completa-account` — le due sole vie
 * d'ingresso previste dal PRD: l'istanza resta chiusa a invito (il
 * Manutentore lo crea fuori dall'app, docs/adr/0013), non c'è
 * registrazione aperta.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
