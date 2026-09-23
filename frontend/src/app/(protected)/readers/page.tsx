import { Suspense } from "react";

import { utenti } from "@/lib/dati/membri";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroElenco } from "@/components/states/scheletri";
import { TestataPagina } from "@/components/layout/testata-pagina";
import { ElencoLettori } from "@/components/lettori/elenco-lettori";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Lettori (design doc §16): le persone e l'intero ciclo di vita del
 * rapporto con loro — richieste ricevute, collegamenti, altri lettori —
 * in una pagina sola. Accettare, rifiutare, ritirare e interrompere si
 * facevano nel profilo: qui la richiesta sta dove sta la persona.
 *
 * La testata sta fuori dal confine di attesa e l'elenco dentro: alla
 * navigazione la parola "Lettori" e la barra che la raccoglie compaiono
 * subito, e lo scheletro resta confinato alle righe che stanno davvero
 * arrivando. `ElencoLettori` idrata poi il risultato in TanStack Query
 * per la ricerca e le mutazioni successive.
 *
 * Il corpo del titolo non è scritto qui: `.t-page` (tokens.css) porta la
 * scala 44/56 insieme al proprio asse ottico, e `TestataPagina` aggiunge
 * la barra che raccoglie la parola quando il titolo esce dallo schermo
 * su mobile.
 */
export default function ReadersPage() {
  return (
    <div className="flex flex-col gap-8">
      <TestataPagina titolo="Lettori" />
      <Suspense fallback={<ScheletroElenco righe={5} />}>
        <Elenco />
      </Suspense>
    </div>
  );
}

async function Elenco() {
  const result = await utenti();

  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("lettoriNonCaricati", result.errore)} />;
  }

  return <ElencoLettori elencoIniziale={result.data} />;
}
