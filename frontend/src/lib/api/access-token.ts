"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Token della sessione browser corrente, per le mutazioni lato client
 * verso il backend (cambiare stato, registrare un avanzamento — design
 * doc §12, salvataggio ottimistico). Solo per Client Component: i Server
 * Component leggono la sessione da `lib/supabase/server.ts`, come già fa
 * `(protected)/layout.tsx`.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    // Riautenticazione in-pannello senza perdita di testo (PRD, regola
    // 25) è fuori dal perimetro di questa issue: qui l'errore si limita
    // a dirlo, invece di far finta che la scrittura sia possibile.
    throw new Error("La sessione è scaduta. Ricarica la pagina per continuare.");
  }
  return session.access_token;
}
