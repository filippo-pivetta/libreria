import { cva, type VariantProps } from "class-variance-authority";

/*
 * LA PASTIGLIA, UNA SOLA.
 *
 * Prima erano cinque, e nessuna sapeva delle altre: `basePill` in
 * `quaderni/filtri-scritti.tsx`, la sua copia letterale in
 * `libreria/scaffale.tsx` (stesse classi, riscritte a mano — due
 * sorgenti per un disegno solo), i temi in `quaderni/temi.tsx` con un
 * altro corpo e un'altra altezza, la scelta della luce nel Profilo, e
 * il libro suggerito in `quaderni/scrivi-pensiero.tsx`. Cinque
 * grammatiche per lo stesso oggetto: una capsula che si accende.
 *
 * Il difetto non era la ripetizione — quella si sopporta — ma il fatto
 * che i valori DIVERGEVANO: px-2.5/py-1 qui, px-3.5/py-1.5 là, px-3/py-1
 * altrove, tre corpi diversi, e due modi diversi di dire "accesa"
 * (inchiostro al 9% senza bordo nello scaffale, riempimento pieno nei
 * temi). Su una pagina che ne mostra due file — i filtri sopra, i temi
 * sotto — la differenza si vede e non significa niente.
 *
 * ---------------------------------------------------------------------
 * TRE TAGLIE, UN SOLO MODO DI ACCENDERSI.
 *
 *   filtro        30px, corpo 12   restringe ciò che sta sotto
 *   comando       36px, corpo 13   commuta uno stato (spoiler, visibilità)
 *   tema          32px, Fraunces   apre un'interpretazione
 *
 * "Accesa" è sempre la stessa cosa: inchiostro pieno, testo sul piano 1.
 * Era già così nei temi; lo scaffale e i Quaderni usavano invece
 * `bg-ink/9`, che a distanza di un dito non si distingue da "spenta". La
 * regola resta quella di §3 — niente riempimento colorato, il colore nei
 * comandi non entra: i libri restano l'unico posto dell'app dove il
 * colore è un dato.
 *
 * ---------------------------------------------------------------------
 * IL BERSAGLIO NON È IL RIQUADRO.
 *
 * `data-slot="pastiglia"` più `.bersaglio` (tokens.css, "IL TOCCO"): il
 * riquadro resta della misura scritta qui, l'area sensibile arriva a
 * `--tap` sotto il dito. Prima la regola `pointer: coarse` prendeva ogni
 * `button[class*="rounded-full"]` e gli imponeva `min-height: 44px`,
 * quindi su un telefono una fila di filtri era una fascia di capsule
 * alte 44 con dentro un'etichetta di 12px. Ora è alta 30 e si preme
 * lo stesso.
 */
export const pastigliaVariants = cva(
  [
    "bersaglio inline-flex shrink-0 items-center rounded-full border font-ui whitespace-nowrap",
    "transition-[background-color,color,border-color] duration-(--dur-micro) ease-(--ease-rise)",
    "outline-none select-none disabled:pointer-events-none disabled:opacity-50",
    // Le pastiglie che aprono un menù (anno, libro) restano accese
    // finché il riquadro è aperto, come le linguette `ghost` di
    // `ui/button.tsx`.
    "data-[popup-open]:border-line-strong data-[popup-open]:text-ink",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      taglia: {
        filtro: "h-[1.875rem] gap-1.5 px-3 text-xs [&_svg]:size-3",
        comando: "h-9 gap-2 px-3.5 text-[0.8125rem] font-medium [&_svg]:size-[0.9375rem]",
        tema: "h-8 gap-2 px-3.5 font-display text-[0.9375rem] [&_svg]:size-3.5",
      },
      acceso: {
        // Inchiostro pieno: un solo modo di dire "acceso" in tutta l'app.
        true: "border-ink bg-ink text-surface-1",
        false: "border-line bg-transparent text-ink-soft hover:border-line-strong hover:text-ink",
      },
    },
    defaultVariants: { taglia: "filtro", acceso: false },
  },
);

export type PastigliaProps = VariantProps<typeof pastigliaVariants>;

/**
 * L'attributo che tiene fuori la pastiglia dalla regola `min-height` del
 * tocco. Si sparge insieme alle classi: chi usa `pastigliaVariants` su un
 * elemento suo (un `MenuTrigger`, un `Popover.Trigger`) deve metterlo,
 * altrimenti la capsula torna alta 44 sotto il dito.
 */
export const attributiPastiglia = { "data-slot": "pastiglia" } as const;
