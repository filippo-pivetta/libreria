import { Suspense } from "react";

import { vociMie } from "@/lib/dati/letture";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { Scaffale } from "@/components/libreria/scaffale";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Libreria (design doc §7): scaffale di dorsi, vista predefinita.
 *
 * La pagina è sincrona e non attende nulla: l'attesa sta tutta nel figlio
 * dentro `<Suspense>`. È ciò che permette alla rotta di essere
 * prerenderizzata e al guscio di comparire subito alla navigazione, con
 * lo scheletro solo dove i dati arrivano davvero dopo. `Scaffale` idrata
 * poi il risultato in TanStack Query per le mutazioni successive.
 */
export default function ProtectedHomePage() {
  return (
    <Suspense fallback={<ScheletroScaffale />}>
      <ScaffaleDellaLibreria />
    </Suspense>
  );
}

async function ScaffaleDellaLibreria() {
  const result = await vociMie();

  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("libreriaNonCaricata", result.errore)} />;
  }

  return <Scaffale vociIniziali={result.data} />;
}
