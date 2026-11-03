import { useEffect, type ComponentProps } from "react";
import { Link as LinkRouter } from "react-router";

import { precaricaPercorso } from "@/rotte/precarica";

type Props = Omit<ComponentProps<typeof LinkRouter>, "to" | "prefetch"> & {
  href: string;
  /** Precarica subito, al montaggio, invece che all'intenzione. Solo per un
   * insieme chiuso e piccolo di destinazioni sempre in vista (le voci della
   * barra): su decine di dorsi sarebbero decine di richieste per una sola
   * che verrà usata. */
  prefetch?: boolean;
};

/**
 * Il collegamento interno dell'app: il `Link` di React Router con `href` (lo
 * stesso nome di un `<a>`, che i componenti già usano) e il precaricamento.
 *
 * Precarica codice e dati della destinazione **quando si manifesta
 * l'intenzione di aprirla** (`rotte/precarica.ts`):
 *  - `onPointerEnter` copre mouse e penna, e arriva centinaia di millisecondi
 *    prima del clic;
 *  - `onTouchStart` è l'equivalente sul telefono: il tocco precede il clic di
 *    100-300ms, poco ma abbastanza;
 *  - `onFocus` copre la tastiera, che altrimenti sarebbe l'unica a restare
 *    lenta.
 *
 * Non aggiunge alcun elemento attorno: `Volume` lo usa come elemento portante,
 * e un involucro romperebbe l'impacchettamento delle mensole.
 */
export function Link({ href, prefetch, onPointerEnter, onTouchStart, onFocus, ...props }: Props) {
  useEffect(() => {
    if (prefetch) precaricaPercorso(href);
  }, [prefetch, href]);

  return (
    <LinkRouter
      {...props}
      to={href}
      onPointerEnter={(evento) => {
        precaricaPercorso(href);
        onPointerEnter?.(evento);
      }}
      onTouchStart={(evento) => {
        precaricaPercorso(href);
        onTouchStart?.(evento);
      }}
      onFocus={(evento) => {
        precaricaPercorso(href);
        onFocus?.(evento);
      }}
    />
  );
}
