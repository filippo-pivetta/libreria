/**
 * Chrome dell'area pubblica (non autenticata): nessuna navigazione,
 * solo il contenuto centrato. Oggi ospita `/login`; l'accesso è
 * l'unica via d'ingresso prevista dal PRD (nessuna registrazione
 * autonoma, credenziali create fuori dall'app dal Manutentore).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
