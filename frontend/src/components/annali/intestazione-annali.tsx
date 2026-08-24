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
 *
 * La riga sotto l'anno diceva "Anno in corso. Ogni numero è ricalcolato
 * adesso.": un fatto vero per costruzione (ADR 0004, ogni metrica è
 * ricalcolata a ogni richiesta) ripetuto a ogni visita, quindi mai
 * informativo — lo stesso principio per cui, poco sopra in questo
 * stesso file, "la somma non è mai completa" è stato sostituito da
 * `libri_senza_pagine`: un promemoria perenne smette di leggersi dalla
 * seconda visita. Al suo posto una riga che non spiega un meccanismo,
 * di terza persona sulla pagina di un collegato come il resto dei
 * quattro segnali qui sopra.
 */
export function IntestazioneAnnali({
  anno,
  annoMinimo,
  annoMassimo,
  onCambiaAnno,
  /** Presente solo nel contesto di un collegato: la sua presenza è il
   * segnale, non il suo valore. */
  nomeUtente,
}: {
  anno: number;
  annoMinimo: number;
  annoMassimo: number;
  onCambiaAnno: (anno: number) => void;
  nomeUtente?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="min-w-0">
        {nomeUtente && <p className="t-label">Annali di {nomeUtente}</p>}
        {/* leading-[1.05] e non leading-none: è lo stesso interlinea di
            `.t-display` (tokens.css), la classe che dà il titolo a ogni
            altra pagina (Lettori, Profilo). Con leading-none il riquadro
            del titolo era più basso qui che altrove, a parità di corpo —
            lo stesso numero sembrava un titolo di peso minore. */}
        <h1
          className="t-num mt-2 font-display text-[44px] leading-[1.05] text-ink sm:text-[56px]"
          style={{ fontVariationSettings: '"opsz" 72, "SOFT" 20' }}
        >
          {anno}
        </h1>
        <p className="t-meta mt-1">
          {nomeUtente ? "Il suo anno raccontato dai numeri." : "L’anno raccontato dai numeri."}
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
