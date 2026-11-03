import { useState } from "react";

import { type PreferenzaLuce } from "@/lib/light";
import { applicaLuce, leggiPreferenza, salvaPreferenza } from "@/lib/luce-browser";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { Messaggio } from "@/components/ui/messaggio";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

const OPZIONI: { valore: PreferenzaLuce; etichetta: string }[] = [
  { valore: "ora", etichetta: "Segui l’ora" },
  { valore: "giorno", etichetta: "Giorno" },
  { valore: "notte", etichetta: "Notte" },
];

/**
 * La luce della stanza (design doc §3, emendata nella sessione UI).
 *
 * Il documento diceva "non c'è interruttore, non c'è scelta, la parola notte
 * non compare nelle impostazioni", e nominava il costo di quella scelta:
 * "chi ha una sensibilità alla luce non può forzare la stanza scura di
 * giorno". Il costo era accettato ma non mitigato — `prefers-color-scheme`
 * non veniva letto, e nemmeno `prefers-contrast`, che pure §3 indicava come
 * l'unico comando esterno onorato.
 *
 * Ora la scelta esiste, e "Segui l'ora" resta il valore predefinito: la stanza
 * che si scurisce da sola non è stata sostituita, è diventata una delle tre
 * opzioni, quella che nessuno deve scegliere per averla. Due collegati che non
 * toccano nulla continuano a vedere la stessa stanza alla stessa ora.
 *
 * **Immediato.** La preferenza sta in `localStorage` e la palette si ricalcola
 * nel browser (`lib/luce-browser.ts`), quindi la stanza cambia nell'istante del
 * clic. Se il browser non conserva la scelta (dati del sito bloccati), il
 * gruppo resta sul valore precedente con l'errore in testo — mai un riquadro
 * rosso (§19).
 *
 * Un gruppo di radio e non tre pulsanti: sono tre valori mutuamente esclusivi
 * di una stessa proprietà, e le frecce della tastiera devono scorrerli.
 */
export function SceltaLuce() {
  const spiega = useMessaggioErrore();
  const [scelta, setScelta] = useState<PreferenzaLuce>(leggiPreferenza);
  const [errore, setErrore] = useState<string | null>(null);

  function cambia(valore: PreferenzaLuce) {
    setErrore(null);
    try {
      salvaPreferenza(valore);
      setScelta(valore);
      applicaLuce(valore);
    } catch {
      setErrore(spiega("luceNonCambiata"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Luce della stanza"
        className="flex flex-wrap gap-2"
      >
        {OPZIONI.map(({ valore, etichetta }) => {
          const attiva = scelta === valore;
          return (
            <button
              key={valore}
              type="button"
              role="radio"
              aria-checked={attiva}
              onClick={() => cambia(valore)}
              {...attributiPastiglia}
              className={pastigliaVariants({ taglia: "filtro", acceso: attiva })}
            >
              {etichetta}
            </button>
          );
        })}
      </div>
      {/* Dal primitivo, non da un `<p>` scritto a mano: era l'ultimo
          superstite degli otto componenti che `ui/messaggio.tsx` doveva
          assorbire, e l'unico messaggio dell'app senza regione
          `aria-live` — invisibile a chi non guarda lo schermo. */}
      <Messaggio>{errore}</Messaggio>
    </div>
  );
}
