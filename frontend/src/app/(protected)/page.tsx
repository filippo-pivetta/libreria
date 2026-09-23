import { Suspense } from "react";

import { vociMie } from "@/lib/dati/letture";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
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
    // Regione, non riga: qui non è fallito un comando accanto a cui
    // mettere una frase — è mancato il contenuto della pagina, e senza
    // carta sotto restavano due righe nude in mezzo alla stanza vuota.
    // E con un comando vero: la frase dice "riprova", e finché non c'era
    // niente da premere lo diceva a vuoto (vedi `RiprovaRotta`).
    return (
      <ErrorState
        regione
        message={await messaggioErrore("libreriaNonCaricata", result.errore)}
        azione={<RiprovaRotta />}
      />
    );
  }

  return <Scaffale vociIniziali={result.data} />;
}
