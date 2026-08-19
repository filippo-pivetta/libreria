"use client";

import { useEffect } from "react";
import { Literata } from "next/font/google";

import "./globals.css";

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

/**
 * Ultima rete (issue #11): un errore sfuggito perfino al layout radice
 * (RootLayout stesso, o un provider che avvolge tutto). Sostituisce
 * l'intera app, quindi definisce <html>/<body> da sé e non può
 * chiamare `getLightState()` — è una funzione server, questo è un
 * Client Component obbligato — quindi usa i valori di riserva statici
 * già in globals.css (l'ancoraggio "giorno"), non l'interpolazione
 * oraria. Elementi nativi apposta, non i componenti condivisi: in
 * questo caso limite meno dipendenze ci sono, meno cose possono aver
 * causato — o poter ripetere — il crash.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, non `reset`: dalla v16.3.0 è la prop stabile (vedi
  // route-error.tsx per il perché).
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="it" className={literata.variable}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="incisione font-heading text-lg font-medium">Qualcosa è andato storto</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Si è verificato un errore imprevisto. Riprova, o torna alla pagina precedente.
        </p>
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Riprova
        </button>
      </body>
    </html>
  );
}
