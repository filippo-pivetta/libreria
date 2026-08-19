import { redirect } from "next/navigation";

import { getMe } from "@/lib/api/me";
import { createClient } from "@/lib/supabase/server";
import { ProtectedNav } from "@/components/layout/protected-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ErrorState } from "@/components/states/error-state";

/**
 * Chrome dell'area protetta: guardia di autenticazione lato server più
 * navigazione. Il Proxy (src/proxy.ts) fa già da prima linea e redirige
 * prima che questa pagina venga renderizzata; il controllo qui è un
 * secondo livello indipendente, nel caso un matcher del Proxy non copra
 * una rotta — la stessa logica di difesa in profondità già scelta per la
 * RLS lato database, applicata qui lato routing.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Sicuro solo perché getUser() sopra ha già validato la sessione con
  // Supabase: qui si legge il token già verificato, non ci si fida di un
  // cookie non controllato.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const me = session ? await getMe(session.access_token) : { status: "error" as const, message: "Sessione assente." };

  if (me.status === "not_provisioned") {
    // Sessione valida ma account non ancora completato: capita a chi ha
    // chiuso la scheda a metà del completamento dell'invito (docs/adr/0013)
    // e torna più tardi navigando direttamente in un'altra pagina. Non è
    // più un vicolo cieco — la via d'uscita è finire quel passaggio.
    redirect("/completa-account");
  }

  if (me.status !== "ok") {
    return (
      <div className="plane-0-lit flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-sm">
          <ErrorState title="Qualcosa è andato storto" message={me.message} />
        </div>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="plane-0-lit flex min-h-screen flex-col">
      <ProtectedNav userName={me.data.nomeUtente} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6 text-ink">{children}</main>
    </div>
  );
}
