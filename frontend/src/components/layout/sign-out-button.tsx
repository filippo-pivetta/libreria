import { useNavigate } from "react-router";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Unico punto che invoca `signOut()`: usato sia dalla navigazione
 * dell'area protetta sia dallo stato bloccante di un account non ancora
 * provisionato, che altrimenti non avrebbe via d'uscita (un link a
 * /login da una sessione ancora valida rimbalzerebbe indietro).
 * La cache delle query la svuota la guardia dell'area protetta, che
 * sente l'uscita (`components/layout/require-auth.tsx`).
 */
export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  const navigate = useNavigate();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <Button variant={variant} size="sm" onClick={handleSignOut}>
      Esci
    </Button>
  );
}
