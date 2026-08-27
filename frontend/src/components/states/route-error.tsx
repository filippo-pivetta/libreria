"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
import { useTranslations } from "next-intl";

/**
 * Corpo condiviso dei confini d'errore di rotta (issue #11): un errore
 * di rendering non gestito in una pagina, non l'intero layout radice —
 * per quello c'è app/global-error.tsx, che non può riusare questo
 * componente (deve restare minimo, per non dipendere da ciò che
 * potrebbe aver causato il crash).
 */
export function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, non `reset`: dalla v16.3.0 è la prop stabile e consigliata,
  // ri-fetcha e ri-renderizza il segmento invece di limitarsi a pulire
  // lo stato dell'error boundary (frontend/AGENTS.md impone di
  // verificare le convenzioni di questa versione, non fidarsi del
  // training).
  retry: () => void;
}) {
  const t = useTranslations();
  useEffect(() => {
    // Un log lato client è il minimo indispensabile qui: non c'è ancora
    // un servizio di telemetria in questo progetto (fuori dal perimetro
    // di questa issue). `error.digest` lega questo log a quello
    // eventualmente emesso lato server per lo stesso errore.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      message={t("generici.imprevisto")}
      onRetry={retry}
    />
  );
}
