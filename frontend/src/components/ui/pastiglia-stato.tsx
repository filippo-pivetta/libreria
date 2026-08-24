import type { StatoVoce } from "@/lib/api/voci";
import { RIBBON } from "@/lib/ribbon";
import { cn } from "@/lib/utils";

export const ETICHETTA_STATO: Record<StatoVoce, string> = {
  da_leggere: "Da leggere",
  in_lettura: "In lettura",
  in_pausa: "In pausa",
  letto: "Letto",
  abbandonato: "Abbandonato",
};

/**
 * Lo stato della copia, in chiaro.
 *
 * Sulla scheda il nastro era un moncone colorato di 12×22px appoggiato
 * all'angolo in alto a destra della pagina destra, e la parola stava
 * altrove, in `t-label`: corpo 10,5, maiuscoletto, `ink-soft`. Cioè il
 * dato più importante della pagina — che cos'è questo libro per te —
 * era diviso fra un segno muto e il testo più piccolo dello schermo.
 *
 * Qui i due tornano insieme: il colore del nastro resta, ridotto a un
 * punto, e porta la parola accanto. Il punto non è decorazione, è il
 * legame con lo scaffale, dove il nastro È il linguaggio (§7) e dove
 * quella stessa tinta significa già quella stessa cosa. La parola fa il
 * lavoro che il colore da solo non può fare, e che sullo scaffale fa
 * invece la LUNGHEZZA del nastro: qui di nastri ce n'è uno, quindi non
 * c'è niente con cui confrontarlo, e la lunghezza non direbbe nulla.
 *
 * "Da leggere" non ha nastro — assenza, non colore (§7). Il punto
 * diventa un cerchio vuoto: continua a occupare lo spazio, così le
 * pastiglie dei cinque stati restano della stessa misura.
 */
export function PastigliaStato({
  stato,
  suffisso,
  className,
}: {
  stato: StatoVoce;
  /** "· chiara", per il libro di un collegato. */
  suffisso?: string;
  className?: string;
}) {
  const ribbon = RIBBON[stato];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pr-3 pl-2.5 font-ui text-[0.8125rem] font-medium text-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          ribbon ? cn(ribbon.colorClass, ribbon.accessibileClass) : "border-[1.5px] border-line-strong",
        )}
      />
      {ETICHETTA_STATO[stato]}
      {suffisso && <span className="font-normal text-ink-soft">{suffisso}</span>}
    </span>
  );
}
