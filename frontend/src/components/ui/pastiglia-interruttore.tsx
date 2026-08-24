"use client";

import { Toggle } from "@base-ui/react/toggle";

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
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-transparent px-3.5 py-2 font-ui text-[0.8125rem] font-medium text-ink-soft outline-none select-none",
        "transition-[background-color,color,border-color] duration-(--dur-micro) ease-(--ease-rise)",
        "hover:text-ink",
        "data-pressed:border-ink data-pressed:bg-ink data-pressed:text-surface-1",
        "[&_svg]:size-[0.9375rem] [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </Toggle>
  );
}
