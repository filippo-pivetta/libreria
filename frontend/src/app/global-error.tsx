"use client";

import { useEffect } from "react";
import { interTight } from "@/lib/fonts";

import "./globals.css";

/**
 * Last-resort net (issue #11): an error that escaped even the root
 * layout (RootLayout itself, or a provider wrapping everything). Replaces
 * the whole app, so it defines <html>/<body> itself and can't safely call
 * `lightAttrs()` here — it's a forced Client Component, while light must
 * be computed server-side (design doc §3). No extra `data-light`/`style`:
 * it relies on the static fallback values already in the "giorno" (day)
 * anchor of tokens.anchors.css. Only Inter Tight, not all three families:
 * in this edge case, fewer dependencies means fewer things that could
 * have caused — or could repeat — the crash.
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
    <html lang="it" className={interTight.variable}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-lg font-medium text-ink">Qualcosa si è rotto</p>
        <p className="max-w-sm text-sm text-ink-soft">
          Riprova, o torna alla pagina precedente.
        </p>
        {/* Scritto a mano di proposito — vedi sopra: qui meno dipendenze
            si tirano dentro, meglio è — ma alla misura che la scala dei
            comandi dà all'unica azione di una zona (44px, `ui/button.tsx`
            taglia `lg`). Era alto 30, cioè il peso minimo per l'unica
            cosa che si può fare in una schermata di ultima istanza. */}
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-[0.9375rem] font-medium text-on-accent"
        >
          Riprova
        </button>
      </body>
    </html>
  );
}
