import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { fontVariables } from "@/lib/fonts";
import { cookies } from "next/headers";

import {
  COOKIE_LUCE,
  preferenzaValida,
  risolviLuce,
  themeColorHex,
  lightAttrs,
} from "@/lib/light";

export const metadata: Metadata = {
  title: "Montaigne",
  description: "Le tue letture, in una stanza sola.",
  applicationName: "Montaigne",
  // La futura app parte da qui: installata dalla schermata home, la barra di
  // stato è trasparente e la pagina ci scorre sotto — è la ragione per cui
  // `viewportFit: "cover"` sotto non è facoltativo.
  appleWebApp: { capable: true, title: "Montaigne", statusBarStyle: "default" },
  // Non-negotiable rule 6 (docs/prd.md): no page is indexable. Reinforces
  // app/robots.ts at the per-page meta-tag level — the rule explicitly
  // calls for "checking the crawler-exclusion directives", plural.
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Il viewport, che finora era quello predefinito di Next.
 *
 * `viewportFit: "cover"` è il prerequisito di tutto il resto del lavoro
 * mobile: senza, `env(safe-area-inset-*)` vale zero su iOS e la barra in
 * fondo finirebbe sotto l'indicatore home.
 *
 * `themeColor` è ricalcolato a ogni richiesta perché segue la luce (§3): la
 * chrome del browser si scurisce insieme alla stanza invece di restare bianca
 * sopra un fondo bruno. Non è dichiarato come costante proprio per questo — è
 * una funzione dell'ora, esattamente come la palette.
 *
 * `userScalable` resta al valore predefinito, cioè lo zoom NON è bloccato:
 * disattivarlo è la scorciatoia più comune per far sembrare nativo un sito ed
 * è anche il modo più rapido di renderlo inutilizzabile a chi ingrandisce.
 */
export async function generateViewport(): Promise<Viewport> {
  const preferenza = preferenzaValida((await cookies()).get(COOKIE_LUCE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: themeColorHex(risolviLuce(preferenza).palette),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Compute the current light (design doc §3): always server-side, never
  // a timer in the browser, so two connected users see the same room at
  // the same hour and there's no hydration mismatch. No more .dark class
  // or theme: `data-light` carries the dominant anchor (needed by the few
  // selectors that must know whether the room is dark), `style` carries
  // the interpolated values that win over the fallback blocks in
  // tokens.anchors.css.
  // La preferenza sulla luce (§3, sessione UI): un cookie letto lato server,
  // come tutto il resto del calcolo. Nessun `localStorage` e nessuno script
  // inline anti-lampeggio: se il valore arrivasse dal browser, la prima
  // pittura userebbe l'ora e la seconda la preferenza, e il salto si vedrebbe
  // a ogni caricamento — esattamente ciò che questo modulo esiste per evitare.
  const preferenza = preferenzaValida((await cookies()).get(COOKIE_LUCE)?.value);
  const light = lightAttrs(preferenza);
  const isNight = light["data-light"] === "notte";

  return (
    <html
      lang="it"
      data-light={light["data-light"]}
      className={fontVariables}
      style={{ ...light.style, colorScheme: isNight ? "dark" : "light" } as CSSProperties}
    >
      <body>
        {/* Prima cosa raggiungibile da tastiera, invisibile finché non prende
        il fuoco: senza, per arrivare al contenuto di una pagina bisogna
        attraversare ogni volta tutta la navigazione. L’ancora `#contenuto` sta
        sul <main> del chrome dell’area protetta. */}
        <a href="#contenuto" className="skip-link">
          Vai al contenuto
        </a>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
