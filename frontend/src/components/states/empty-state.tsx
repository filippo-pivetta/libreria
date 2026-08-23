import type { ReactNode } from "react";

/**
 * Stato "qui non c'è niente", riusabile finché una schermata non si merita un
 * trattamento suo (design doc §18: lo scaffale vuoto ha la sua mensola
 * disegnata a mano, non questo pannello). Nessun colore d'allarme: è un invito
 * detto piano.
 *
 * Correzione della sessione UI: era un rettangolo con il bordo tratteggiato.
 * Il tratteggio è il cliché più economico dell'interfaccia vuota, ed era
 * l'unico punto di tutta la libreria di componenti a contraddire la direzione
 * "Materia" — dove il vuoto è una carta su cui non è ancora stato scritto
 * niente, non un buco segnato col gesso. Ora è una `.plane-1` come ogni altra
 * superficie di lettura, con più aria dentro. Il tratteggio resta dove
 * significa qualcosa: sulla costa di un volume di cui non si conoscono le
 * pagine (§7, regola 9), dove dichiara un dato assente.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="plane-1 grain flex flex-col items-center justify-center gap-2 px-6 py-14 text-center sm:py-16">
      <p className="font-ui text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-pretty text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
