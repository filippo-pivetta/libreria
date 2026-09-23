"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";

/**
 * Un `<Link>` che precarica la destinazione **quando si manifesta
 * l'intenzione di aprirla**, non perché è comparso sullo schermo.
 *
 * Il caso che questo componente esiste per servire è lo scaffale: decine
 * di dorsi visibili insieme, ciascuno verso una rotta con un parametro
 * diverso. Precaricarli tutti significherebbe decine di invocazioni del
 * server per una sola che verrà usata — su un'istanza a invito i limiti
 * di frequenza sono un fusibile contro un ciclo impazzito, e riempirli
 * di lavoro inutile è il modo più veloce per farlo scattare senza
 * motivo. Precaricare su intento ne fa partire una.
 *
 * I tre segnali, e perché servono tutti e tre:
 *  - `onPointerEnter` copre mouse e penna, e arriva centinaia di
 *    millisecondi prima del clic: il tempo di sostare su un dorso è già
 *    più del tempo che serve al backend per rispondere;
 *  - `onTouchStart` è l'equivalente sul telefono, dove non esiste il
 *    passaggio del puntatore: il tocco precede il clic di 100-300ms,
 *    poco ma abbastanza;
 *  - `onFocus` copre la tastiera. Senza, la navigazione da tastiera
 *    sarebbe l'unica a restare lenta — cioè esattamente chi ha meno
 *    modi di aggirare una lentezza.
 *
 * **A riposo `undefined`, mai `false`.** `false` spegnerebbe anche il
 * guscio condiviso della rotta, che è uno solo per destinazione e non
 * per link, quindi praticamente gratuito: ogni dorso lo prende, e solo
 * il dorso sfiorato paga il precaricamento dei propri dati.
 *
 * Le destinazioni fisse — le quattro voci della barra e il Profilo —
 * non passano di qui: sono un insieme chiuso e sempre in vista, e
 * portano `prefetch` esteso fin da subito (`layout/protected-nav.tsx`),
 * così anche la prima navigazione della sessione è immediata. La
 * differenza non è di gusto ma di numero: quelle sono cinque, i libri
 * sono decine.
 *
 * Non aggiunge alcun elemento attorno: `Volume` usa `<Link>` come
 * elemento portante, con le proprie classi, il proprio `style` e le
 * proprie etichette. Un involucro romperebbe l'impacchettamento delle
 * mensole (`lib/shelf-pack.ts`) e la regola del tocco a 44px.
 */
export function CollegamentoIntento({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intenzione, setIntenzione] = useState(false);
  const avvia = () => setIntenzione(true);

  return (
    <Link
      {...props}
      prefetch={intenzione ? true : undefined}
      onPointerEnter={(evento) => {
        avvia();
        props.onPointerEnter?.(evento);
      }}
      onTouchStart={(evento) => {
        avvia();
        props.onTouchStart?.(evento);
      }}
      onFocus={(evento) => {
        avvia();
        props.onFocus?.(evento);
      }}
    >
      {children}
    </Link>
  );
}
