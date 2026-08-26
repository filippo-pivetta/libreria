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
 * Le altezze CAMBIANO, ed è la terza correzione. La densità del desktop era
 * una scelta del documento, ma si era tradotta in `size="sm"` (28px, corpo
 * 12,8) su ogni comando della scheda del libro, azione primaria compresa:
 * quattro bottoni dello stesso peso di cui uno salva e uno annulla una
 * lettura. Ora la scala dice la gerarchia da sola — `lg` 44px per l'unica
 * azione piena di una zona, `default` 38px per le secondarie, `sm` 32px per
 * i comandi di riga — e `@media (pointer: coarse)` in `tokens.css` continua
 * a portare ogni bersaglio a `--tap` sotto il dito.
 *
 * =====================================================================
 * QUARTA CORREZIONE (26 agosto 2026): `link` non era un pulsante, era
 * una falla — e da quella falla sono usciti otto comandi scritti a mano.
 *
 * Il variant si chiamava `link` e valeva `text-accent-strong
 * underline-offset-4 hover:underline`, cioè l'accento COME TESTO: la sola
 * cosa che il commento in cima a questo stesso file dichiara vietata. Chi
 * doveva scrivere un comando leggero — "Mostrane un altro", "Genera di
 * nuovo", "Cancella", "Nascondi i vicini", "Cerca tutto ciò che somiglia
 * a questo tema" — trovava qui l'unica opzione sbagliata e se ne
 * scriveva una giusta a mano. Otto volte, in tre grammatiche diverse:
 *
 *   `tocco-esteso t-meta underline decoration-line-strong …`  (Quaderni, 5)
 *   `t-meta inline-flex min-h-11 items-center underline … sm:min-h-0` (Annali, 2)
 *   `t-meta self-start underline …`                     (Suggerimenti, 1)
 *
 * La terza non aveva bersaglio di tocco affatto. La seconda ce l'aveva
 * ma nel modo peggiore — `min-h-11` occupa 44px DI FLUSSO, quindi sotto
 * i 640px quel comando spingeva giù ciò che aveva sotto invece di
 * allargare soltanto la propria area sensibile.
 *
 * Ora il variant si chiama `quiet`, è quel disegno lì — inchiostro
 * tenue, filetto in `line-strong` che scurisce al passaggio — e porta
 * `.bersaglio` da sé. Un comando leggero è un pulsante come gli altri:
 * ha `disabled`, ha il fuoco dell'app, ha 44px sotto il dito, e si
 * scrive in un posto solo.
 *
 * `size="testo"` è la taglia che gli serve: nessun riquadro, nessuna
 * altezza imposta, così sta in fondo a un paragrafo o in coda a una riga
 * di metadati senza aprirvi dentro un buco alto 32px. Era il motivo per
 * cui ogni uso di `link` portava dietro un `className="px-0"`.
 *
 * `render={<Link href="…" />}` VUOLE `nativeButton={false}`. Base UI
 * presume di default che dietro `render` ci sia un `<button>` vero
 * (`nativeButton` vale `true`), e un `<a>` non lo è: senza l'avviso arriva
 * a console, e sotto — niente `nativeButton={false}` — Space non
 * attiva il link e la semantica esposta a chi ascolta la pagina è quella
 * sbagliata. Cinque punti dell'app avvolgono un `Link` così ed è mancato
 * in tutti e cinque alla prima stesura: non un difetto di uno, un
 * promemoria per il prossimo.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-field border border-transparent font-ui font-medium whitespace-nowrap transition-[translate,scale,opacity,background-color,color,border-color,text-decoration-color] duration-(--dur-micro) ease-(--ease-rise) outline-none select-none active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Il riempimento accent porta un bordo di luce sul lato illuminato,
        // come ogni oggetto del piano 2 (`--mtg-rim`, tokens.css §2): senza,
        // il pulsante pieno era l'unica superficie sollevata dell'app senza
        // il segno che la solleva.
        default:
          "bg-accent text-on-accent shadow-[inset_0_1px_0_color-mix(in_oklab,white_38%,transparent)] hover:bg-accent/90",
        // `bg-surface-1` e non `transparent`: un comando che sta su una carta
        // deve leggersi come un oggetto posato sopra, non come un buco nel
        // bordo. E' quello che separa la seconda azione dalla terza.
        outline:
          "border-line-strong bg-surface-1 text-ink hover:bg-surface-2 data-[popup-open]:bg-surface-2",
        secondary: "bg-surface-2 text-ink hover:bg-surface-2/80",
        // `data-popup-open`: una linguetta che apre un menù resta accesa
        // finché il menù è aperto. Senza, il trigger tornava neutro nel
        // momento esatto in cui il puntatore lo lasciava per andare sul
        // riquadro, e per tutto il tempo del menù nulla in pagina diceva
        // da dove fosse uscito. Base UI lo espone già su ogni trigger:
        // costava una riga, e mancava su tutti e quattro i menù dell'app.
        ghost:
          "text-ink-soft hover:bg-surface-2 hover:text-ink data-[popup-open]:bg-surface-2 data-[popup-open]:text-ink",
        // Il quarto peso: un comando che non chiede spazio. Filetto e non
        // riempimento, inchiostro tenue che si fa pieno al passaggio.
        // Nessun accento: §3 lo vuole riempimento e mai testo.
        quiet:
          "bersaglio font-normal text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink",
      },
      size: {
        // `lg` e' l'AZIONE PRIMARIA: una sola per zona, e 44px anche col
        // mouse. Era `h-9` (36px) e non si distingueva dalle altre.
        lg: "h-11 px-5 text-[0.9375rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-[1.0625rem]",
        // Azione secondaria. 38px: piu' bassa della primaria, ma sopra la
        // soglia in cui un bordo di 1px smette di leggersi come bersaglio.
        default: "h-[2.375rem] px-[0.9375rem] text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-8 gap-1.5 px-3 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-7 gap-1 rounded-object px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        // Nessun riquadro: la taglia di `quiet`. Corpo e colore di `t-meta`,
        // che e' il registro in cui questi comandi vivevano gia'.
        testo: "h-auto gap-1.5 p-0 text-[0.8125rem] leading-[1.45] [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-[2.375rem]",
        "icon-xs": "size-7 rounded-object [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-[1.0625rem]",
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
