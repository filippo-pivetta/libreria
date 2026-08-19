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
  title = "Qualcosa è andato storto",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      <p className="font-ui text-sm font-medium text-ink">{title}</p>
      <p className="text-sm text-pretty text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 self-start">
          Riprova
        </Button>
      )}
    </div>
  );
}
