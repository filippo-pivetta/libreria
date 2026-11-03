import { useEffect } from "react";
import { useLocation } from "react-router";

import { applicaLuce } from "@/lib/luce-browser";

/**
 * Tiene la luce al passo con l'ora mentre l'app resta aperta.
 *
 * Lo script inline in `index.html` la calcola una volta, al caricamento. In
 * una SPA il documento non si ricarica più, quindi qui la si ricalcola negli
 * stessi due momenti in cui prima la ricalcolava il server: al cambio pagina,
 * e al ritorno in primo piano (l'app installata resta in memoria per ore).
 *
 * Mai con un timer: un salto mentre si sta leggendo o scrivendo è proprio ciò
 * che `crossesNight` in `lib/light.ts` tiene lontano dagli occhi.
 */
export function LuceViva() {
  const { pathname } = useLocation();

  useEffect(() => {
    applicaLuce();
  }, [pathname]);

  useEffect(() => {
    const alRitorno = () => {
      if (document.visibilityState === "visible") applicaLuce();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => document.removeEventListener("visibilitychange", alRitorno);
  }, []);

  return null;
}
