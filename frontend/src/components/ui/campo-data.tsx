import { IconaCalendario } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

/**
 * Campo data (design doc §9, punto 4 — correzione del 20 agosto 2026):
 * "il campo data non è quello nativo con l'icona di sistema, è l'unico
 * elemento estraneo di tutta la pagina". Resta un `<input type="date">`
 * nativo (tastiera, validazione, selettore del sistema operativo su
 * mobile — tutto questo si perderebbe con un componente scritto da zero),
 * ma con `appearance: none` e l'indicatore nascosto, sulla sola riga
 * inferiore come ogni altro campo dell'app. Alternativa esplicitamente
 * ammessa dal documento al posto di un selettore costruito su Radix/
 * base-ui: quest'ultimo avrebbe richiesto una griglia di calendario
 * scritta a mano, non giustificata per un campo che serve solo a
 * correggere una data già scelta di default.
 *
 * =====================================================================
 * IL RIQUADRO ORA È QUI DENTRO (26 agosto 2026).
 *
 * In due punti — il segnalibro e le transizioni di stato — questo campo
 * viveva dentro un riquadro scritto a mano dal chiamante:
 *
 *   <span className="inline-flex items-center gap-2 rounded-field
 *                    border border-line-strong bg-surface-1 px-3">
 *     <IconaCalendario … />
 *     <CampoData … />
 *   </span>
 *
 * Tre difetti, e due si vedono a colpo d'occhio.
 *
 * 1. **Non aveva altezza.** Il riquadro si adattava al contenuto, cioè
 *    ai 32px del campo, e stava accanto a un pulsante da 44 ("Segna la
 *    pagina") o da 38 ("Conferma"). Due oggetti affiancati, dello stesso
 *    peso apparente, alti dodici pixel di differenza: la riga non aveva
 *    una linea di base.
 * 2. **Portava due contorni.** Il campo dichiara `border-b` — è la sua
 *    forma, giusta quando sta da solo su una riga — e dentro un riquadro
 *    quella riga diventa un filetto orizzontale in mezzo al bordo, che
 *    non significa niente. Adesso il riquadro se la mangia.
 * 3. Era ricopiato in due posti, e i due erano già divergiti (`px-3` in
 *    entrambi, ma uno con `gap-2` e l'altro senza icona affatto).
 *
 * `riquadro` sceglie fra le due forme; `altezza` allinea il riquadro al
 * pulsante che gli sta accanto, perché la scala dei comandi è quella
 * (§9) e un campo che li accompagna deve starci dentro, non accanto.
 */
export function CampoData({
  value,
  min,
  max,
  onChange,
  ariaLabel,
  id,
  riquadro = false,
  altezza = "default",
  className,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  id?: string;
  /** Con l'icona e il contorno, per stare in riga accanto a un pulsante. */
  riquadro?: boolean;
  /** Le stesse due altezze di `ui/button.tsx`: 44px e 38px. */
  altezza?: "lg" | "default";
  className?: string;
}) {
  const campo = (
    <input
      id={id}
      type="date"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "field-date w-[9.5rem] appearance-none bg-transparent px-0 font-ui text-sm text-ink outline-none placeholder:text-ink-soft",
        riquadro
          ? // Dentro il riquadro il campo non ha contorno proprio: il
            // contorno è il riquadro. `h-full` perché il bersaglio sotto
            // il dito sia tutta l'altezza, non i 32px del testo.
            "field-line h-full border-0"
          : "field-line h-8 border-0 border-b border-line",
        className,
      )}
    />
  );

  if (!riquadro) return campo;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-field border border-line-strong bg-surface-1 pr-3 pl-3 text-ink",
        "transition-colors duration-(--dur-micro) focus-within:border-ink-soft",
        altezza === "lg" ? "h-11" : "h-[2.375rem]",
      )}
    >
      <IconaCalendario
        aria-hidden
        className={cn("shrink-0 text-ink-soft", altezza === "lg" ? "size-[1.0625rem]" : "size-4")}
      />
      {campo}
    </span>
  );
}
