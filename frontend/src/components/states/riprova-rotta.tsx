import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

/**
 * "Riprova" per un errore che ha tolto di mezzo il contenuto di una pagina.
 *
 * Il caso da cui viene: la Libreria che non arriva al primo caricamento. La
 * frase composta dal catalogo dice "Riprova fra poco", e senza un comando lo
 * diceva a vuoto: restava il tasto di ricarica del browser, che è l'ammissione
 * che l'app non sa rimettersi in piedi da sola.
 *
 * `riprova` è il `refetch` della query della pagina: rifà solo quella lettura,
 * senza buttare via il guscio, la sessione o la posizione nella pagina.
 *
 * Il comando si spegne mentre la richiesta è in corso: un comando che non dà
 * segno di aver sentito il clic invita a premerlo di nuovo, cioè a raddoppiare
 * le richieste proprio mentre il server è in affanno.
 */
export function RiprovaRotta({ riprova }: { riprova: () => Promise<unknown> }) {
  const t = useTranslations();
  const [inCorso, setInCorso] = useState(false);

  async function avvia() {
    setInCorso(true);
    try {
      await riprova();
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={inCorso} onClick={() => void avvia()}>
      {inCorso ? t("attesa.generica") : "Riprova"}
    </Button>
  );
}
