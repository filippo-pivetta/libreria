"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { cn } from "@/lib/utils";
import { IconaPiu } from "@/components/ui/icone";

/**
 * L'invito a scrivere: la forma unica di "qui non c'è ancora niente, e
 * puoi metterlo tu".
 *
 * Prima l'app diceva la stessa cosa in tre grammatiche diverse, tutte
 * quasi invisibili: "Scrivi una recensione" e "Aggiungi una nota di
 * intenzione" erano testo sottolineato a corpo 12,5 in `ink-soft`;
 * "Scrivi un insight" lo stesso; e la correzione delle pagine era un
 * campo numerico con bordo tratteggiato di 1px e il segnaposto
 * "correggi". Tre affordance, nessuna delle quali si legge come un
 * comando, per l'atto centrale del prodotto — depositare un testo.
 *
 * Qui il tratteggio resta, ma diventa il bordo di un bersaglio intero:
 * dice "vuoto" con la stessa figura con cui dice "premibile". A riempirsi,
 * l'invito sparisce e al suo posto compare il pannello: è la stessa
 * transizione dei pannelli in pagina (§19: l'app non ha modali).
 */
export function Invito({
  className,
  children,
  ...props
}: ButtonPrimitive.Props) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        "group/invito flex w-full items-center gap-3 rounded-field border border-dashed border-line-strong px-4 py-3 text-left font-ui text-sm text-ink-soft outline-none",
        "min-h-12 transition-colors duration-(--dur-micro) ease-(--ease-rise)",
        "hover:border-solid hover:border-line-strong hover:bg-surface-1 hover:text-ink",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors duration-(--dur-micro) group-hover/invito:border-ink"
      >
        <IconaPiu className="size-[0.9375rem]" />
      </span>
      {children}
    </ButtonPrimitive>
  );
}
