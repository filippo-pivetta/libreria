import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Generic error, reusable for any failed request (TanStack Query or
 * otherwise). Text, not a red box: the rule holds literally for the
 * sign-in error (design doc §6) and is the product's general writing
 * rule (§19) — "errors say what happened and what to do", never an alarm
 * color. `alert` in the tokens stays reserved for the request counter
 * next to Tower alone. `message` is text already ready for the user, not
 * the raw error object: translating an exception into a message is the
 * caller's job.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  azione,
  regione = false,
}: {
  /**
   * Facoltativo, e quasi sempre assente.
   *
   * Il valore predefinito era "Qualcosa è andato storto": una riga che
   * compariva sopra ogni errore dell'app senza aggiungere un'informazione, e
   * che è la stessa specie di "ops" che §19 vieta — dice che è successo
   * qualcosa, non cosa. Ora il titolo si passa solo dove nomina davvero il
   * caso ("Non trovata", "Link non valido", "Non più accessibile"), e altrove
   * il messaggio parla da solo, che è ciò che la regola chiede.
   */
  title?: string;
  message: string;
  onRetry?: () => void;
  /**
   * Il comando di ripresa quando chi mostra l'errore è un Server
   * Component e non ha una funzione da passare: lì `onRetry` non esiste
   * — una callback non attraversa il confine — e senza questa presa
   * l'errore restava un vicolo cieco, una frase che dice "riprova" senza
   * dare dove. Ci si passa un'isola client (`RiprovaRotta`).
   */
  azione?: ReactNode;
  /**
   * Vero quando l'errore prende il posto di una REGIONE INTERA e non di
   * una riga accanto a un comando: lo scaffale che non è arrivato, le
   * impostazioni che non si sono aperte.
   *
   * Cambia la forma, non le parole: la stessa carta di `EmptyState`,
   * centrata e con dell'aria intorno, invece di due righe nude in mezzo
   * a una stanza vuota. Il vuoto e il guasto sono due esiti della stessa
   * attesa, e finivano su due forme diverse per come erano stati
   * scritti, non per una decisione.
   */
  regione?: boolean;
}) {
  const comando = onRetry ? (
    <Button variant="outline" size="sm" onClick={onRetry}>
      Riprova
    </Button>
  ) : (
    azione
  );

  if (regione) {
    return (
      <div
        role="alert"
        className="plane-1 grain flex flex-col items-center justify-center gap-2 px-6 py-14 text-center sm:py-16"
      >
        {title && <p className="font-ui text-sm font-medium text-ink">{title}</p>}
        <p className="max-w-sm text-sm text-pretty text-ink-soft">{message}</p>
        {comando && <div className="mt-2">{comando}</div>}
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-2">
      {title && <p className="font-ui text-sm font-medium text-ink">{title}</p>}
      <p className="text-sm text-pretty text-ink">{message}</p>
      {comando && <div className="mt-1 self-start">{comando}</div>}
    </div>
  );
}
