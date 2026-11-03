import { useQuery } from "@tanstack/react-query";

import { utenti } from "@/lib/dati/membri";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroElenco } from "@/components/states/scheletri";
import { TestataPagina } from "@/components/layout/testata-pagina";
import { ElencoLettori } from "@/components/lettori/elenco-lettori";

/**
 * Lettori (design doc §16): le persone e l'intero ciclo di vita del
 * rapporto con loro — richieste ricevute, collegamenti, altri lettori —
 * in una pagina sola. Accettare, rifiutare, ritirare e interrompere si
 * facevano nel profilo: qui la richiesta sta dove sta la persona.
 *
 * La testata non aspetta l'elenco: alla navigazione la parola "Lettori" e
 * la barra che la raccoglie compaiono subito, e lo scheletro resta
 * confinato alle righe che stanno davvero arrivando. `ElencoLettori`
 * riceve il risultato come dato iniziale per la ricerca e le mutazioni.
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
      <Elenco />
    </div>
  );
}

function Elenco() {
  const spiega = useMessaggioErrore();
  const { data: result, isPending, refetch } = useQuery(utenti());

  if (isPending) return <ScheletroElenco righe={5} />;

  if (!result || result.status === "error") {
    return (
      <ErrorState
        message={spiega("lettoriNonCaricati", result?.errore)}
        azione={<RiprovaRotta riprova={refetch} />}
      />
    );
  }

  return <ElencoLettori elencoIniziale={result.data} />;
}
