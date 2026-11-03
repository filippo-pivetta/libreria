import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, type LoaderFunctionArgs } from "react-router";

import { LuceViva } from "@/components/layout/luce-viva";
import { RequireAuth } from "@/components/layout/require-auth";
import { RouteError } from "@/components/states/route-error";
import AreaProtetta from "@/rotte/area-protetta";
import AreaPubblica from "@/rotte/area-pubblica";
import ErroreRadice from "@/rotte/errore-radice";
import { ROTTE } from "@/rotte/precarica";

/**
 * Le rotte dell'app.
 *
 * Ogni pagina è `lazy`: il suo codice sta in un file a parte e si scarica alla
 * prima visita (o prima, all'intenzione: `components/ui/link.tsx`). Il loader
 * fa partire i dati della pagina **senza aspettarli** (`rotte/precarica.ts`):
 * codice e dati viaggiano insieme, la navigazione non si ferma sulla rete, e la
 * pagina mostra il proprio scheletro solo se la risposta non è ancora in cache.
 *
 * Il guscio (guardia, barra, aree) è nel bundle principale: compare subito.
 */

type Modulo = { default: React.ComponentType };

/** Una pagina `lazy` dal suo modulo, che esporta il componente come default. */
function pagina(carica: () => Promise<Modulo>) {
  return async () => ({ Component: (await carica()).default });
}

/** Il loader di una rotta: precarica e ritorna subito. */
function precarica(dati?: (p: LoaderFunctionArgs["params"]) => void) {
  return ({ params }: LoaderFunctionArgs) => {
    dati?.(params);
    return null;
  };
}

function Radice() {
  return (
    <>
      <LuceViva />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Radice />,
    errorElement: <ErroreRadice />,
    // Il primo caricamento aspetta il codice della pagina: un istante, sulla
    // stanza già nella sua luce (lo script inline in `index.html`).
    HydrateFallback: () => null,
    children: [
      {
        element: <AreaPubblica />,
        errorElement: <RouteError />,
        children: [
          { path: "/login", lazy: pagina(() => import("@/rotte/login")) },
          { path: "/completa-account", lazy: pagina(() => import("@/rotte/completa-account")) },
          { path: "/account-eliminato", lazy: pagina(() => import("@/rotte/account-eliminato")) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AreaProtetta />,
            children: [
              {
                // Senza percorso, così un errore resta dentro il guscio, con la
                // navigazione al suo posto.
                errorElement: <RouteError />,
                children: [
                  {
                    path: ROTTE.libreria.percorso,
                    lazy: pagina(() => import("@/rotte/libreria")),
                    loader: precarica(ROTTE.libreria.dati),
                  },
                  { path: ROTTE.aggiungi.percorso, lazy: pagina(() => import("@/rotte/aggiungi")) },
                  {
                    path: ROTTE.annali.percorso,
                    lazy: pagina(() => import("@/rotte/annali")),
                    loader: precarica(ROTTE.annali.dati),
                  },
                  {
                    path: ROTTE.lettori.percorso,
                    lazy: pagina(() => import("@/rotte/lettori")),
                    loader: precarica(ROTTE.lettori.dati),
                  },
                  {
                    path: ROTTE.profilo.percorso,
                    lazy: pagina(() => import("@/rotte/profilo")),
                    loader: precarica(ROTTE.profilo.dati),
                  },
                  { path: ROTTE.quaderni.percorso, lazy: pagina(() => import("@/rotte/quaderni")) },
                  {
                    path: ROTTE.scheda.percorso,
                    lazy: pagina(() => import("@/rotte/scheda-catalogo")),
                    loader: precarica(ROTTE.scheda.dati),
                  },
                  {
                    path: ROTTE.libro.percorso,
                    lazy: pagina(() => import("@/rotte/libro-guscio")),
                    loader: precarica(ROTTE.libro.dati),
                    children: [{ index: true, lazy: pagina(() => import("@/rotte/libro")) }],
                  },
                  {
                    path: ROTTE.collegato.percorso,
                    lazy: pagina(() => import("@/rotte/collegato-guscio")),
                    loader: precarica(ROTTE.collegato.dati),
                    children: [
                      { index: true, lazy: pagina(() => import("@/rotte/collegato")) },
                      {
                        path: "annali",
                        lazy: pagina(() => import("@/rotte/collegato-annali")),
                        loader: precarica(ROTTE.collegatoAnnali.dati),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
