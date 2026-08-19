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
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-field border border-transparent font-ui text-sm font-medium whitespace-nowrap transition-[transform,opacity] outline-none select-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-accent/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
