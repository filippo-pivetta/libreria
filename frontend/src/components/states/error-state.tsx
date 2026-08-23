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
}) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      {title && <p className="font-ui text-sm font-medium text-ink">{title}</p>}
      <p className="text-sm text-pretty text-ink">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 self-start">
          Riprova
        </Button>
      )}
    </div>
  );
}
