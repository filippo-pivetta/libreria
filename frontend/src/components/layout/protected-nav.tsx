import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * Navigazione dell'area protetta. Mostra il nome utente (dato di
 * dominio, mai l'email: "le email non esistono nel prodotto", docs/prd.md)
 * e il logout; le voci di menu arriveranno con le prime schermate reali.
 * Nessun branding "Montaigne" qui: il design doc riserva quel nome alla
 * sola schermata di login.
 */
export function ProtectedNav({ nomeUtente }: { nomeUtente: string }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-medium text-foreground">{nomeUtente}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
