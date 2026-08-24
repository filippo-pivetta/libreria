import { SelettoreAnno } from "@/components/annali/selettore-anno";

/**
 * L'intestazione degli Annali, propria o di un collegato.
 *
 * Il titolo di pagina era "Annali", cioè la stessa parola che sta accesa
 * nella barra di navigazione due righe più sopra: un titolo che ripete
 * l'indirizzo invece di nominare il contenuto. Il contenuto di questa
 * pagina è un anno, quindi il titolo è l'anno.
 *
 * ---------------------------------------------------------------------
 * SULLA PAGINA DI UN COLLEGATO
 *
 * Proprio perché il titolo è diventato l'anno, sulla sua pagina sarebbe
 * identico alla tua: un "2026" in Fraunces non dice di chi è. Sopra
 * l'anno compare allora una micro-etichetta che sulla propria pagina non
 * esiste mai, "ANNALI DI MARTA", che è esattamente il mestiere di
 * `.t-label` (§4: "solo micro-etichetta sopra un dato").
 *
 * È il terzo segnale di quattro, e l'unico in parole. Gli altri
 * arrivano dal contesto e non da qui: la barra globale sparisce del
 * tutto e al suo posto c'è "‹ Lettori" con nome e iniziali (§15), e
 * `[data-guest]` raffredda la stanza portando `accent` e `accent-strong`
 * a `ink-soft`, quindi barre e ciambella diventano grigie. Il quarto è
 * la terza persona nelle carte ("come li HA votati").
 * ---------------------------------------------------------------------
 */
export function IntestazioneAnnali({
  anno,
  annoMinimo,
  annoMassimo,
  onCambiaAnno,
  /** Presente solo nel contesto di un collegato: la sua presenza è il
   * segnale, non il suo valore. */
  nomeUtente,
  annoInCorso,
}: {
  anno: number;
  annoMinimo: number;
  annoMassimo: number;
  onCambiaAnno: (anno: number) => void;
  nomeUtente?: string;
  /** Vero quando l'anno mostrato è quello corrente: cambia la riga sotto
   * il titolo, perché "anno in corso" su un anno chiuso sarebbe falso. */
  annoInCorso: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="min-w-0">
        {nomeUtente && <p className="t-label">Annali di {nomeUtente}</p>}
        <h1
          className="t-num mt-2 font-display text-[44px] leading-none text-ink sm:text-[56px]"
          style={{ fontVariationSettings: '"opsz" 72, "SOFT" 20' }}
        >
          {anno}
        </h1>
        <p className="t-meta mt-2">
          {annoInCorso && "Anno in corso. "}
          {nomeUtente
            ? "Ogni numero è calcolato sui suoi dati."
            : "Ogni numero è ricalcolato adesso."}
        </p>
      </div>

      <SelettoreAnno
        anno={anno}
        annoMinimo={annoMinimo}
        annoMassimo={annoMassimo}
        onCambiaAnno={onCambiaAnno}
      />
    </div>
  );
}
