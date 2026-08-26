"use client";

import { Popover } from "@base-ui/react/popover";

/**
 * La chiosa: il limite di un dato, accanto al titolo che lo introduce,
 * dietro un punto interrogativo.
 *
 * ---------------------------------------------------------------------
 * PERCHÉ NON È PIÙ UNA RIGA IN FONDO ALLA CARTA
 *
 * §14 chiedeva che il limite di un numero stesse sempre a vista. Da
 * "sotto ogni numero" era già sceso a "una volta in fondo alla carta",
 * il che aveva risolto la gerarchia ma non il volume: cinque carte, cinque
 * righe di prosa in coda, e la pagina finiva per essere metà numeri e metà
 * note a piè di pagina. Una spiegazione che non cambia mai da un anno
 * all'altro non merita di occupare spazio a ogni visita.
 *
 * Il punto interrogativo è un glifo tipografico, non un'icona: l'app non
 * ha un vocabolario di icone e non è questo il posto per aprirne uno
 * (§5). Sta accanto al titolo, quindi si vede che c'è qualcosa da sapere
 * senza doverlo leggere.
 *
 * NON È UN CANALE DI MESSAGGI NUOVO. I tre canali (§, `ui/messaggio.tsx`
 * in linea, il toast, `ErrorState`/`EmptyState`) portano *messaggi*, cioè
 * l'esito di qualcosa che è appena successo. Questa porta un'*annotazione
 * su un dato*, sempre vera e sempre la stessa: è più vicina a una nota a
 * margine che a un avviso, e per questo si chiama così.
 *
 * ACCESSIBILITÀ, che è la ragione per cui questo è un `Popover` e non un
 * `<div>` con `:hover`. Il grilletto è un `<button>` vero: si apre al
 * passaggio del mouse (`openOnHover`), al clic e al tocco, e prende il
 * fuoco da tastiera; Escape chiude e il fuoco torna indietro. Un riquadro
 * che si aprisse solo in hover sarebbe invisibile a chi naviga da tastiera
 * e irraggiungibile su un telefono, dove `mouseleave` non arriva mai:
 * esattamente il difetto che aveva portato `menu.tsx` a Base UI.
 * ---------------------------------------------------------------------
 */
export function Chiosa({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={120}
        closeDelay={80}
        // Il nome accessibile porta dentro il titolo della carta:
        // "informazioni" da solo, ripetuto cinque volte nella stessa
        // pagina, non direbbe di che cosa.
        aria-label={`Come si conta: ${etichetta}`}
        // appearance-none: senza, il chrome nativo del bottone su mobile
        // (Safari/Chrome Android) ignora `size-4 rounded-full` e disegna
        // una pillola ellittica invece di un cerchio attorno al "?" —
        // stesso genere di override già necessario altrove per i controlli
        // nativi (globals.css, il calendario di `campo-data.tsx`).
        className="bersaglio ml-1.5 inline-flex size-4 shrink-0 translate-y-px appearance-none items-center justify-center rounded-full border border-line-strong bg-transparent font-ui text-[10px] leading-none text-ink-soft transition-colors duration-(--dur-micro) hover:border-ink hover:text-ink data-[popup-open]:border-ink data-[popup-open]:text-ink"
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={8} className="z-40">
          <Popover.Popup
            className={[
              "plane-1 grain max-w-[19rem] p-3.5 shadow-plane-2 outline-none",
              "origin-(--transform-origin)",
              // Solo opacity e scale: il resto passerebbe dal layout
              // (tokens.css §6). Le durate dai token, mai a mano.
              "transition-[opacity,scale] duration-(--dur-micro) ease-(--ease-rise)",
              "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
              "motion-reduce:transition-none",
            ].join(" ")}
          >
            <div className="t-meta flex flex-col gap-2.5 text-ink">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Il titolo di una carta degli Annali con la sua chiosa accanto, quando
 * ce n'è una. Senza `chiosa` è un `.t-label` e basta: il punto
 * interrogativo compare solo dove c'è davvero qualcosa da spiegare, mai
 * come decorazione fissa dell'intestazione.
 */
export function TitoloConChiosa({
  titolo,
  chiosa,
}: {
  titolo: string;
  chiosa?: React.ReactNode;
}) {
  return (
    <p className="t-label flex items-center">
      {titolo}
      {chiosa && <Chiosa etichetta={titolo}>{chiosa}</Chiosa>}
    </p>
  );
}
