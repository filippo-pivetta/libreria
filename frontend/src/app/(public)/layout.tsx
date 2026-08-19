/**
 * Chrome dell'area pubblica: nessuna navigazione, solo il contenuto
 * centrato. Ospita `/login` e `/completa-account` — le due sole vie
 * d'ingresso previste dal PRD: l'istanza resta chiusa a invito (il
 * Manutentore lo crea fuori dall'app, docs/adr/0013), non c'è
 * registrazione aperta.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // materia-legno (design doc §2 e §1 "la torre"): la sola cornice dell'app dove il legno affiora, dietro le due
    // uniche vie d'ingresso — coerente con "il nome Montaigne compare solo sulla schermata d'accesso": qui è la
    // materia a portare il riferimento, mai il nome scritto (quello resta sul solo /login).
    <div className="materia-legno flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
