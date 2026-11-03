import { Outlet } from "react-router";

import { Chrome } from "@/components/layout/chrome";

/**
 * Il guscio dell'area protetta: quale barra mostrare — quella globale o
 * nessuna, nel contesto di un collegato — lo decide `Chrome` (design doc
 * §5/§15). La guardia sta sopra, in `components/layout/require-auth.tsx`.
 *
 * Non attende nulla: i dati della barra li consuma `Chrome` dentro confini di
 * attesa propri, e il contenuto della pagina compare senza aspettarli.
 */
export default function AreaProtetta() {
  return (
    <Chrome>
      <Outlet />
    </Chrome>
  );
}
