import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * La coppia Annulla/Salva in fondo a un modulo di scrittura.
 *
 * Esisteva già, due volte, scritta a mano identica: nel modulo
 * dell'insight (`libro/insight-lista.tsx`) e in quello dei Quaderni
 * (`quaderni/scrivi-pensiero.tsx`). Ora che la prende anche la nota di
 * intenzione e la recensione sarebbero state quattro copie, cioè la
 * situazione che questo progetto ha già pagato altrove — cinque
 * pastiglie divergenti, la regola del trattino in uno solo di sei
 * prompt. Una riga in un posto solo.
 *
 * `flex-1` sotto i 640px e `sm:flex-none` sopra: sul telefono i due
 * comandi si dividono la riga per intero, sul desktop stanno alla loro
 * misura. `sm:ml-auto` li spinge a destra quando dividono la barra con
 * gli interruttori di spoiler e visibilità.
 *
 * `variant="ghost"` su Annulla e il pieno su Salva: la via d'uscita non
 * ha mai il peso dell'azione (design doc §9, la correzione che ha tolto
 * lo stesso peso a quattro comandi di cui uno cancellava una lettura).
 */
export function AzioniModulo({
  etichettaSalva = "Salva",
  salvaDisabilitato = false,
  onSalva,
  onAnnulla,
  className,
}: {
  etichettaSalva?: string;
  salvaDisabilitato?: boolean;
  onSalva: () => void;
  onAnnulla: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:ml-auto", className)}>
      <Button variant="ghost" className="flex-1 sm:flex-none" onClick={onAnnulla}>
        Annulla
      </Button>
      <Button className="flex-1 sm:flex-none" disabled={salvaDisabilitato} onClick={onSalva}>
        {etichettaSalva}
      </Button>
    </div>
  );
}
