"use client";

import { Toggle } from "@base-ui/react/toggle";

import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { cn } from "@/lib/utils";

/**
 * Un interruttore a due stati che si legge da fermo.
 *
 * Prima lo spoiler e la visibilità erano comandi testuali sottolineati
 * la cui ETICHETTA era anche lo stato: "Segna come spoiler" diventava
 * "Contrassegnato spoiler", "Condiviso con i collegati" diventava
 * "Privato, solo tuo". Il difetto non è il corpo del testo, è la
 * grammatica: da fermo non si distingue un comando da una didascalia,
 * quindi non si sa se "Privato, solo tuo" DESCRIVA l'insight o PROMETTA
 * di renderlo privato premendolo. Sono due letture opposte della stessa
 * riga, e chi decide la visibilità di un testo che i collegati leggeranno
 * merita di saperlo senza provare.
 *
 * Una pastiglia premuta lo dice da sola, e `Toggle` di Base UI porta
 * `aria-pressed` — cioè lo dice anche a chi la ascolta invece di
 * guardarla. L'etichetta resta ferma, cambia solo il riempimento.
 *
 * Niente rosso e niente verde: `alert` ha UN SOLO uso in tutta l'app
 * (§3), il contatore delle richieste. Un interruttore acceso è
 * inchiostro pieno.
 */
export function PastigliaInterruttore({
  className,
  children,
  ...props
}: Toggle.Props) {
  return (
    <Toggle
      {...attributiPastiglia}
      className={cn(
        // Il vestito è quello del sistema (`ui/pastiglia.tsx`, taglia
        // "comando"). Prima era scritto qui a mano, con un'altezza data
        // dal padding (`py-2`, cioè ~34px) che non coincideva con nessuna
        // delle altre pastiglie della stessa pagina.
        pastigliaVariants({ taglia: "comando", acceso: false }),
        // Lo stato acceso lo dichiara `data-pressed` di Base UI, non una
        // prop: qui `acceso` resta false e le classi del pieno arrivano
        // dopo, così vincono per ordine.
        "data-pressed:border-ink data-pressed:bg-ink data-pressed:text-surface-1",
        className,
      )}
      {...props}
    >
      {children}
    </Toggle>
  );
}
