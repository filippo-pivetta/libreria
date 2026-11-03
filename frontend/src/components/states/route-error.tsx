import { useEffect } from "react";
import { useRouteError } from "react-router";
import { useTranslations } from "use-intl";

import { ErrorState } from "@/components/states/error-state";

/**
 * Il confine d'errore delle due aree (issue #11): un errore di disegno non
 * gestito in una pagina, dentro il guscio, con la navigazione ancora al suo
 * posto. Per un errore sopra i provider c'è `rotte/errore-radice.tsx`, che non
 * può riusare questo componente (deve restare minimo, per non dipendere da ciò
 * che potrebbe aver causato il crash).
 *
 * "Riprova" ricarica la pagina: un errore di disegno non ha una query da
 * rifare, e ricaricare è l'unico modo sicuro di ripartire da uno stato pulito.
 */
export function RouteError() {
  const t = useTranslations();
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState message={t("generici.imprevisto")} onRetry={() => window.location.reload()} />;
}
