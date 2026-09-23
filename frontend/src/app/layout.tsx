import { Suspense, type CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { fontVariables } from "@/lib/fonts";
import { RegistraServiceWorker } from "@/components/layout/registra-service-worker";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { attributiLuce, themeColorHex } from "@/lib/light";
import { luceCorrente } from "@/lib/luce-richiesta";

export const metadata: Metadata = {
  title: "Montaigne",
  description: "Le tue letture, in una stanza sola.",
  applicationName: "Montaigne",
  // La futura app parte da qui: installata dalla schermata home, la barra di
  // stato è trasparente e la pagina ci scorre sotto — è la ragione per cui
  // `viewportFit: "cover"` sotto non è facoltativo.
  appleWebApp: { capable: true, title: "Montaigne", statusBarStyle: "default" },
  // Non-negotiable rule (AGENTS.md): no page is indexable. Reinforces
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
 * `userScalable` resta al valore predefinito, cioè lo zoom NON è bloccato:
 * disattivarlo è la scorciatoia più comune per far sembrare nativo un sito ed
 * è anche il modo più rapido di renderlo inutilizzabile a chi ingrandisce.
 *
 * **Costante, non più `generateViewport()`.** Il colore della chrome
 * segue la luce (§3) e quindi dipende dal cookie della preferenza: finché
 * stava qui, ogni rotta dell'app era costretta a bloccare. Il viewport,
 * a differenza dei metadati, non può essere trasmesso in streaming —
 * decide l'interfaccia del primo paint — quindi un suo dato di richiesta
 * impedisce il guscio prerenderizzato a TUTTE le pagine, che è
 * esattamente ciò che rende la navigazione un'attesa. Il colore non è
 * stato perso: è sceso nell'albero, in `<Documento>` qui sotto, dove può
 * arrivare in streaming come tutto il resto.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Il documento è avvolto in `<Suspense>` e non reso direttamente.
 *
 * Con Cache Components ogni accesso a dati di richiesta fuori da un
 * confine di sospensione impedisce il prerender della rotta — e qui
 * l'accesso è il cookie della luce, che vale per TUTTE le rotte perché
 * sta nel layout radice. Gli attributi della luce stanno su `<html>` e
 * non possono arrivare in streaming *dentro* il documento: si decidono
 * nell'istante in cui `<html>` viene emesso. Il confine va quindi messo
 * SOPRA `<html>`, come indicato da `generate-viewport.md`, così a
 * sospendere è il documento intero.
 *
 * Nessun fallback: prima che la luce sia risolta non c'è nulla da
 * disegnare che non sia già la stanza sbagliata, ed è esattamente il
 * lampo che §3 esiste per evitare. Le navigazioni client non rieseguono
 * il layout radice, quindi questo confine non le riguarda: costa solo
 * sulla visita diretta, dove l'attesa c'era già.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <Documento>{children}</Documento>
    </Suspense>
  );
}

async function Documento({ children }: { children: React.ReactNode }) {
  // La preferenza sulla luce (§3, sessione UI): un cookie letto lato server,
  // come tutto il resto del calcolo. Nessun `localStorage` e nessuno script
  // inline anti-lampeggio: se il valore arrivasse dal browser, la prima
  // pittura userebbe l'ora e la seconda la preferenza, e il salto si vedrebbe
  // a ogni caricamento — esattamente ciò che questo modulo esiste per evitare.
  const luce = await luceCorrente();
  const light = attributiLuce(luce);
  const isNight = light["data-light"] === "notte";
  // La lingua dell'interfaccia (issue #34): non ridedotta qui da
  // `Accept-Language` — `getLocale()` di next-intl legge il valore già
  // risolto una volta sola da `src/i18n/request.ts` per questa stessa
  // richiesta, la stessa fonte che `NextIntlClientProvider` sotto userà
  // per i messaggi. Serve solo a dichiarare `lang`, il valore vero per
  // gli screen reader, non "it" fisso come prima.
  const lingua = await getLocale();

  return (
    <html
      lang={lingua}
      data-light={light["data-light"]}
      className={fontVariables}
      style={{ ...light.style, colorScheme: isNight ? "dark" : "light" } as CSSProperties}
    >
      <body>
        {/* Il colore della chrome del browser, che segue la luce (§3): su
            mobile è ciò che separa un'app da un sito, senza la barra di
            stato resta bianca mentre la stanza è bruna. Sta qui e non nel
            viewport perché il viewport non può andare in streaming e
            bloccherebbe ogni rotta; React solleva i meta resi nell'albero
            dentro <head>, quindi l'effetto è lo stesso di prima. */}
        <meta name="theme-color" content={themeColorHex(luce.palette)} />
        {/* Prima cosa raggiungibile da tastiera, invisibile finché non prende
        il fuoco: senza, per arrivare al contenuto di una pagina bisogna
        attraversare ogni volta tutta la navigazione. L’ancora `#contenuto` sta
        sul <main> del chrome dell’area protetta. */}
        <a href="#contenuto" className="skip-link">
          Vai al contenuto
        </a>
        {/* Non disegna niente: installa il service worker che dà all'app
        aperta dalla schermata home una pagina propria quando la rete manca
        (public/sw.js). Qui e non nell'area protetta perché deve valere anche
        sul login. */}
        <RegistraServiceWorker />
        <NextIntlClientProvider>
          <QueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
