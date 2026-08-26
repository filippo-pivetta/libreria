"use client";

import * as React from "react";

import { IconaChiudi, IconaLente } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

/*
 * IL CAMPO DI RICERCA, UNO SOLO.
 *
 * Il disegno esisteva già ed era giusto: riga inferiore e non riquadro
 * (`.field-line`), perché questi campi FILTRANO ciò che sta sotto invece
 * di raccogliere qualcosa da confermare — `ui/input.tsx` è il campo dei
 * moduli, questo è un'altra cosa. Il difetto era che quel disegno non
 * stava in nessun posto: le stesse dodici classi erano ricopiate in
 * cinque componenti, e nel ricopiarle erano DIVERGATE.
 *
 *   /aggiungi        py-3    Fraunces 2xl   max-w-lg
 *   Libreria         py-2.5  Inter base     piena, ma in riga con due pulsanti
 *   Lettori          py-2    Inter sm       sm:max-w-sm
 *   Quaderni         pb-1    Inter base     piena
 *   Scrivi pensiero  pb-1    Inter sm       piena
 *
 * Cinque altezze, tre corpi, quattro larghezze massime, per la stessa
 * riga. Chi apre due pagine di fila lo vede: il campo "si muove" da una
 * pagina all'altra senza che nulla lo giustifichi.
 *
 * ---------------------------------------------------------------------
 * LA LENTE E LA CROCE, CIOÈ PERCHÉ "CERCA" NON SERVE MAI, IN NESSUN CAMPO.
 *
 * Nessun campo di ricerca dell'app porta un pulsante "Cerca", nemmeno
 * quello dei Quaderni che costa una chiamata al fornitore. Invio è un
 * gesto esplicito quanto un clic — `onInvia` esiste apposta per i campi
 * che devono far partire qualcosa invece di limitarsi a filtrare — e su
 * un telefono `type="search"` mostra comunque "Cerca" sulla tastiera di
 * sistema. Un pulsante che ripete Invio un dito più in basso è un
 * bersaglio che non fa niente di nuovo: la prima stesura lo aveva tolto
 * dalla Libreria e lo aveva tenuto nei Quaderni "perché lì costa" — un
 * argomento che non regge, perché il costo riguarda QUANDO si parte
 * (un gesto esplicito), non CON QUALE oggetto lo si fa partire.
 *
 * Al suo posto le due affordance che un campo di ricerca ha su iOS da
 * sempre: una lente a sinistra che dice cos'è il campo prima ancora del
 * segnaposto, e una croce a destra che compare solo con del testo
 * dentro. La croce è il comando che serviva davvero — svuotare —
 * e prima non c'era in nessuna delle cinque copie: si cancellava a mano,
 * carattere per carattere, o si teneva premuto il backspace.
 *
 * ---------------------------------------------------------------------
 * TRE TAGLIE, E NESSUNA È UNA SCELTA DI GUSTO.
 *
 *   insegna  Fraunces 24px  il campo È la pagina (/aggiungi)
 *   piena    Inter 16px     il campo apre una pagina che contiene altro
 *   riga     Inter 14px     il campo sta in una riga di altri elementi
 *
 * 16px non è arrotondamento: sotto quella soglia iOS ingrandisce la
 * pagina da solo quando il campo prende il fuoco, e non la rimpicciolisce
 * più (stessa ragione documentata in `ui/input.tsx`). `riga` scende a 14
 * solo da 640px in su — sotto resta 16, dove il dito e la tastiera sono.
 */

type Taglia = "insegna" | "piena" | "riga";

const TAGLIE: Record<
  Taglia,
  { campo: string; icona: string; imbottitura: string }
> = {
  insegna: {
    campo: "py-3 font-display text-2xl",
    icona: "size-5",
    imbottitura: "pl-8",
  },
  piena: {
    campo: "py-2.5 font-ui text-base",
    icona: "size-[1.0625rem]",
    imbottitura: "pl-7",
  },
  riga: {
    campo: "py-2 font-ui text-base sm:text-sm",
    icona: "size-4",
    imbottitura: "pl-6",
  },
};

export function CampoRicerca({
  valore,
  onCambia,
  etichetta,
  segnaposto,
  taglia = "piena",
  onInvia,
  className,
  ...props
}: Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type" | "size"
> & {
  valore: string;
  onCambia: (valore: string) => void;
  /** Sempre necessaria: nessuno di questi campi ha un'etichetta visibile. */
  etichetta: string;
  segnaposto?: string;
  taglia?: Taglia;
  /**
   * Solo per i campi che fanno partire QUALCOSA: la ricerca per
   * significato dei Quaderni, che costa una chiamata al fornitore e non
   * può girare a ogni battuta. Un filtro locale non lo passa — lì
   * l'invio si limita a chiudere la tastiera.
   */
  onInvia?: () => void;
}) {
  const riferimento = React.useRef<HTMLInputElement>(null);
  const misure = TAGLIE[taglia];
  const pieno = valore !== "";

  return (
    // `<form>` con `preventDefault`: senza `onInvia` non c'è niente da
    // sottomettere, ma su un telefono è ciò che dà al tastierino il tasto
    // "Cerca" e che chiude la tastiera quando lo si preme.
    <form
      role="search"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (onInvia) onInvia();
        else riferimento.current?.blur();
      }}
      className={cn("relative flex min-w-0 items-center", className)}
    >
      <IconaLente
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 text-ink-soft transition-colors duration-(--dur-micro)",
          misure.icona,
          pieno && "text-ink",
        )}
      />
      <label htmlFor={props.id} className="sr-only">
        {etichetta}
      </label>
      <input
        ref={riferimento}
        type="search"
        value={valore}
        onChange={(evento) => onCambia(evento.target.value)}
        placeholder={segnaposto}
        aria-label={props.id ? undefined : etichetta}
        className={cn(
          "field-line w-full min-w-0 border-0 border-b border-line bg-transparent text-ink outline-none placeholder:text-ink-soft",
          // La croce di sistema di WebKit: se ne monta una propria, quella
          // non deve restare sotto.
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          misure.campo,
          misure.imbottitura,
          pieno && "pr-8",
        )}
        {...props}
      />
      {pieno && (
        <button
          type="button"
          aria-label="Svuota il campo"
          onClick={() => {
            onCambia("");
            riferimento.current?.focus();
          }}
          className="bersaglio absolute top-1/2 right-0 inline-flex size-[1.375rem] -translate-y-1/2 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-(--dur-micro) hover:border-line-strong hover:text-ink"
        >
          <IconaChiudi className="size-3" />
        </button>
      )}
    </form>
  );
}
