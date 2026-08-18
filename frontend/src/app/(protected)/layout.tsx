import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProtectedNav } from "@/components/layout/protected-nav";

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

  return (
    <div className="flex min-h-screen flex-col">
      <ProtectedNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}
