import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * A single accent (design doc §3): `accent` is a fill, never text. The
 * solid button uses `on-accent` for the text on top of it. No
 * "destructive" variant: red (`alert`) appears in exactly one place in
 * the whole app, the request counter next to Tower — never on a danger
 * button. Even account deletion stays plain-toned (design doc §17): the
 * command there is "secondary" or "outline".
 *
 * Due correzioni della sessione UI:
 *
 * 1. Il fuoco era doppio. `tokens.css` ha già una regola `:focus-visible`
 *    per tutta l'app (contorno in `accent-strong`, 2px, con scostamento);
 *    qui c'erano in più `focus-visible:ring-3` e `focus-visible:border-ink`,
 *    quindi da tastiera comparivano insieme un contorno e un alone, con due
 *    raggi diversi. Il ring è stato tolto: l'anello dell'app è uno solo, e
 *    sta in un posto solo.
 * 2. La pressione ora si sente. `translate-y-px` da solo è quasi invisibile
 *    su uno schermo piccolo; insieme a una scala di 0.985 il pulsante "cede"
 *    sotto il dito. Restano due trasformazioni, quindi il lavoro resta sul
 *    compositore. Sono escluse le linguette che aprono un menù
 *    (`aria-haspopup`), che non si premono: si aprono.
 *
 *    La lista di `transition-[...]` nomina `translate` e `scale`, non
 *    `transform`: Tailwind v4 compila `translate-y-px` e `scale-[…]` nelle
 *    proprietà singole (`translate:`, `scale:`), non in una `transform:`
 *    composta. Scrivere `transform` lì dentro non avrebbe dato errore —
 *    semplicemente il ritorno dopo il rilascio sarebbe stato secco, ed è
 *    il tipo di svista che non si vede finché non la si cerca.
 *
 * Le altezze non cambiano: la densità del desktop è una scelta del
 * documento. Sotto il dito ci pensa la regola `@media (pointer: coarse)` in
 * `tokens.css`, che porta ogni `[data-slot="button"]` a `--tap` (44px).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-field border border-transparent font-ui text-sm font-medium whitespace-nowrap transition-[translate,scale,opacity,background-color,color] duration-(--dur-micro) ease-(--ease-rise) outline-none select-none active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent hover:bg-accent/90",
        outline: "border-line-strong bg-transparent text-ink hover:bg-surface-1",
        secondary: "bg-surface-2 text-ink hover:bg-surface-2/80",
        ghost: "text-ink hover:bg-surface-1",
        link: "text-accent-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-object px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 px-3",
        icon: "size-8",
        "icon-xs": "size-6 rounded-object [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
