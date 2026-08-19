"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Unico punto che invoca `signOut()`: usato sia dalla navigazione
 * dell'area protetta sia dallo stato bloccante di un account non ancora
 * provisionato, che altrimenti non avrebbe via d'uscita (un link a
 * /login da una sessione ancora valida rimbalzerebbe indietro, vedi
 * src/lib/supabase/proxy.ts).
 */
export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant={variant} size="sm" onClick={handleSignOut}>
      Esci
    </Button>
  );
}
