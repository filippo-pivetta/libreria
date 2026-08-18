"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Navigazione dell'area protetta. Oggi mostra solo l'identità di sessione
 * (email da Supabase Auth, non un dato di dominio) e il logout; le voci
 * di menu arriveranno con le prime schermate reali.
 */
export function ProtectedNav({ email }: { email: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-medium text-foreground">Montaigne</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{email}</span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Esci
          </Button>
        </div>
      </div>
    </header>
  );
}
