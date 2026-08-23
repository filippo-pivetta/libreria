import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/*
 * `text-base` sotto md e `text-sm` sopra non è un capriccio: sotto i 16px
 * iOS ingrandisce la pagina da solo quando il campo prende il fuoco, e non
 * la rimpicciolisce più.
 *
 * Il ring di fuoco è stato tolto (sessione UI): `tokens.css` porta già la
 * regola `:focus-visible` di tutta l'app, e i due insieme davano un
 * contorno più un alone. Al suo posto è arrivato uno stato `hover`, che
 * mancava del tutto — il campo non dava alcun segno di essere un campo
 * finché non lo si cliccava.
 */

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-field border border-line bg-surface-1 px-2.5 py-1 font-ui text-base text-ink transition-colors duration-(--dur-micro) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-soft hover:border-line-strong focus-visible:border-ink-soft disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
