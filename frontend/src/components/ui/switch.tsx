import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/*
 * The one switch in the app (design doc §17: assisted-processing
 * consent). Generated on `@base-ui/react` like the other primitives
 * (ADR 0014), not taken from shadcn/ui as-is.
 *
 * The track uses `accent` as a fill when on — the only allowed use of
 * accent (design doc §3) — and `surface-2` when off, which is the plane
 * of a raised object, not a colour of its own. No red anywhere: `alert`
 * has exactly one use in the whole app, and it is not this.
 *
 * Only `transform` and `opacity` animate (design doc §3): the thumb
 * slides, the track cross-fades its background through a colour
 * transition that costs no layout. Behind `prefers-reduced-motion` the
 * movement disappears and the state change stays legible from the
 * colour and position alone.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full",
        "border border-line-strong bg-surface-2 outline-none transition-colors",
        "data-[checked]:border-transparent data-[checked]:bg-accent",
        "focus-visible:ring-3 focus-visible:ring-accent/40",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-3.5 translate-x-0.5 rounded-full bg-surface-0 shadow-plane-1",
          "transition-transform data-[checked]:translate-x-[1.125rem]",
          "motion-reduce:transition-none"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
