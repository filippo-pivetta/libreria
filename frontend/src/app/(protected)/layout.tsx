import { Chrome } from "@/components/layout/chrome";
import { datiBarra } from "@/lib/dati/barra";

/**
 * Il guscio dell'area protetta: quale barra mostrare — quella globale o
 * nessuna, nel contesto di un collegato — è deciso da `Chrome` (design
 * doc §5/§15, emendamento 20 agosto 2026).
 *
 * **Questo layout non attende più nulla**, ed è ciò che permette alle
 * rotte dell'area protetta di avere un guscio prerenderizzato da
 * prefetchare: finché qui si aspettavano la verifica della sessione e
 * `GET /me`, ogni pagina restava dinamica e ogni clic era un'andata e
 * ritorno completa prima che comparisse qualunque cosa. I dati della
 * barra partono come promessa e li consuma `Chrome`, dentro confini di
 * attesa propri che non toccano il contenuto.
 *
 * **Dov'è finita la guardia.** Stava qui, `getClaims()` prima di ogni
 * render, come secondo livello dopo il Proxy (`src/proxy.ts`). Non è
 * stata tolta: è scesa in `lib/dati/sessione.ts`, dove ora vale per OGNI
 * lettura di dati di questa richiesta e non più solo per la prima
 * pagina — prima gli altri undici punti si accontentavano di
 * `getSession`, che il cookie lo legge senza verificarne la firma.
 * Spostandola lì si guadagna anche il fatto che nessun dato può essere
 * chiesto prima di averla passata, perché è la stessa funzione a
 * procurare il token. Il confine vero resta comunque più in basso: il
 * backend verifica il JWT su ogni rotta (`app/core/security.py`) e la
 * RLS su ogni riga.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Chrome dati={datiBarra()}>{children}</Chrome>;
}

