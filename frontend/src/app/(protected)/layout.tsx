import { redirect } from "next/navigation";

import { getMe } from "@/lib/api/me";
import { saluto } from "@/lib/saluto";
import { getCollegamenti } from "@/lib/api/collegamenti";
import { createClient } from "@/lib/supabase/server";
import { Chrome } from "@/components/layout/chrome";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ErrorState } from "@/components/states/error-state";

/**
 * Guardia di autenticazione dell'area protetta più i dati che la
 * navigazione condivide (nome utente, contatore richieste): quale barra
 * mostrare — quella globale o nessuna, nel contesto di un collegato —
 * è deciso da `Chrome` (design doc §5/§15, emendamento 20 agosto 2026).
 * Il Proxy (src/proxy.ts) fa già da prima linea e redirige prima che
 * questa pagina venga renderizzata; il controllo qui è un secondo
 * livello indipendente, nel caso un matcher del Proxy non copra una
 * rotta — la stessa logica di difesa in profondità già scelta per la
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
          <ErrorState message={me.message} />
        </div>
        <SignOutButton />
      </div>
    );
  }

  // Il contatore delle richieste ricevute accanto a Lettori (design doc
  // §5): un fallimento qui non deve bloccare il layout, a differenza di
  // getMe sopra — il badge resta semplicemente assente.
  const collegamenti = session
    ? await getCollegamenti(session.access_token)
    : { status: "error" as const, message: "Sessione assente." };
  const receivedRequestCount =
    collegamenti.status === "ok"
      ? collegamenti.data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe).length
      : undefined;

  return (
    <div className="plane-0-lit flex min-h-screen flex-col">
      {/* Il saluto della Libreria si calcola qui, dove si è già lato
          server e si ha il nome: `Chrome` è un componente client e non
          deve leggere l'ora dal browser (la stessa regola della luce,
          design-frontend.md §3). Come la luce, si aggiorna al cambio
          pagina e non durante una permanenza. */}
      <Chrome
        userName={me.data.nomeUtente}
        saluto={saluto(me.data.nomeUtente)}
        receivedRequestCount={receivedRequestCount}
      >
        {children}
      </Chrome>
    </div>
  );
}
