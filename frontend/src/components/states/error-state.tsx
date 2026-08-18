import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Errore generico riutilizzabile per qualunque richiesta fallita
 * (TanStack Query o altro). `message` è testo già pronto per l'utente,
 * non l'oggetto errore grezzo: la traduzione da eccezione a messaggio
 * resta a chi chiama.
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
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="self-start">
            Riprova
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
