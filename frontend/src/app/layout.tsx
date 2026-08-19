import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { getLightState } from "@/lib/light/get-light-state";

// Literata: unico carattere dell'app (design doc §18). L'asse "opsz"
// (dimensione ottica) è ciò che permette a sentenza (19px) e appunto
// (15px) di restare lo stesso font con contrasto e proporzioni diversi,
// invece di due famiglie separate.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Montaigne",
  description: "Scaffold del progetto Montaigne.",
  // Regola invalicabile 6 (docs/prd.md): nessuna pagina indicizzabile.
  // Rinforza app/robots.ts a livello di meta tag per pagina — la regola
  // cita esplicitamente "verifica delle direttive di esclusione dei
  // crawler", al plurale.
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Calcolo lato server della luce del momento (design doc §3): mai nel
  // browser, per non produrre mismatch di idratazione e perché due
  // collegati devono vedere la stessa stanza alla stessa ora.
  const luce = await getLightState();

  return (
    <html
      lang="it"
      className={`${literata.variable}${luce.notte ? " dark" : ""}`}
      style={{ ...luce.variabili, colorScheme: luce.notte ? "dark" : "light" } as CSSProperties}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
