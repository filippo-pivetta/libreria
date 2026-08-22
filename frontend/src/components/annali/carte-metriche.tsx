import type { ReactNode } from "react";

import type { Metriche } from "@/lib/api/metriche";
import { CartaQuestAnno } from "@/components/annali/carta-questanno";
import { Classifica } from "@/components/annali/classifica";
import { TortaGeneri } from "@/components/annali/torta-generi";

/**
 * Le carte degli Annali (design-frontend.md §14): un blocco per
 * metrica, tutte sul piano 1, nessuna sollevata — "negli Annali non c'è
 * niente da afferrare". Riusata identica per le proprie metriche e per
 * quelle di un collegato (docs/rimandato-annali-collegato.md §1/§3):
 * non sa mai di chi sono i dati che riceve.
 */
export function CarteMetriche({
  metriche,
  cartaAffiancata,
}: {
  metriche: Metriche;
  /** "Tu, nello stesso anno" sulla scheda del collegato (rimandato-
   * annali-collegato.md §2) — un affiancamento, non parte di queste
   * metriche: nessun effetto sui calcoli qui dentro. */
  cartaAffiancata?: ReactNode;
}) {
  // "Quest'anno" solo quando l'anno mostrato è davvero l'anno corrente
  // (annoMassimo, che il backend fissa sempre a quello — PRD,
  // comportamento #12): sfogliando un anno passato col selettore la
  // dicitura letterale sarebbe falsa, mentre il numero resta sempre vero.
  const titoloQuestAnno = metriche.anno === metriche.annoMassimo ? "Quest'anno" : String(metriche.anno);

  return (
    <div className="flex flex-col gap-4">
      {cartaAffiancata ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CartaQuestAnno titolo={titoloQuestAnno} metriche={metriche} />
          {cartaAffiancata}
        </div>
      ) : (
        <CartaQuestAnno titolo={titoloQuestAnno} metriche={metriche} />
      )}

      <div className="plane-1 grain rounded-card p-5">
        <Classifica
          titolo="Autori più letti"
          righe={metriche.autoriPiuLetti}
          nota="Il peso di un libro con più autori si ripartisce tra loro, così un libro vale sempre uno."
        />
      </div>

      <div className="plane-1 grain rounded-card p-5">
        <TortaGeneri righe={metriche.generiPrincipali} libriSenzaGenere={metriche.libriSenzaGenere} />
      </div>
    </div>
  );
}
