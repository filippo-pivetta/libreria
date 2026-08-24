"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

/**
 * Il menù di riga, su clic.
 *
 * Prima erano tre `<details>` scritti a mano (transizioni di stato,
 * storico delle letture, cancellazione della voce), aperti al passaggio
 * del mouse e chiusi da un `setTimeout` di 350 ms su `mouseleave`.
 * Quattro difetti, e il primo li contiene tutti:
 *
 * 1. **sotto il dito `mouseleave` non arriva mai.** Su un telefono il
 *    menù si apriva al tocco e restava aperto finché non si toccava di
 *    nuovo la linguetta: il gesto per chiuderlo non esisteva. Il PRD dice
 *    che il mobile è il riferimento nei casi di dubbio, e questo non era
 *    nemmeno un caso di dubbio;
 * 2. **Escape non chiudeva**, perché `<details>` non lo prevede;
 * 3. **il fuoco non tornava** alla linguetta alla chiusura, quindi da
 *    tastiera si ripartiva dall'inizio del documento;
 * 4. **il riquadro si tagliava** dentro qualsiasi antenato con
 *    `overflow: hidden` — che è esattamente il caso della carta degli
 *    insight (`overflow-hidden rounded-card`).
 *
 * Il primitivo `Menu` di Base UI, che è già una dipendenza, li risolve
 * tutti e quattro insieme, con in più le frecce per scorrere le voci e
 * la digitazione per saltare a una. Il riquadro esce in un portale,
 * quindi niente ritagli, e si posiziona da sé contro i bordi.
 *
 * Restano nostri solo i vestiti: piano 1, bordo, ombra doppia, e le voci
 * a `--tap` sotto il dito come ogni altro bersaglio.
 */

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContenuto({
  className,
  align = "start",
  side = "bottom",
  children,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-40">
        <MenuPrimitive.Popup
          className={cn(
            "plane-1 grain min-w-44 origin-(--transform-origin) p-1.5 shadow-plane-2 outline-none",
            // Solo opacity e scale, come impone tokens.css §6: il resto
            // passerebbe dal layout.
            "transition-[opacity,scale] duration-(--dur-micro) ease-(--ease-rise)",
            "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function MenuVoce({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-object px-3 py-2.5 font-ui text-sm text-ink outline-none select-none",
        "data-highlighted:bg-surface-2",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}
