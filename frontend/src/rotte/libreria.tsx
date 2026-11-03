import { useQuery } from "@tanstack/react-query";

import { vociMie } from "@/lib/dati/letture";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { Scaffale } from "@/components/libreria/scaffale";

/**
 * Libreria (design doc §7): scaffale di dorsi, vista predefinita.
 *
 * Lo scheletro compare solo dove i dati arrivano davvero dopo, e solo la
 * prima volta: al ritorno sulla pagina la libreria è già in cache. `Scaffale`
 * riceve il risultato come dato iniziale e da lì tiene la propria query per le
 * mutazioni successive.
 */
export default function LibreriaPage() {
  const spiega = useMessaggioErrore();
  const { data: result, isPending, refetch } = useQuery(vociMie());

  if (isPending) return <ScheletroScaffale />;

  if (!result || result.status === "error") {
    // Regione, non riga: qui non è fallito un comando accanto a cui mettere
    // una frase — è mancato il contenuto della pagina. E con un comando vero:
    // la frase dice "riprova", e deve esserci qualcosa da premere.
    return (
      <ErrorState
        regione
        message={spiega("libreriaNonCaricata", result?.errore)}
        azione={<RiprovaRotta riprova={refetch} />}
      />
    );
  }

  return <Scaffale vociIniziali={result.data} />;
}
