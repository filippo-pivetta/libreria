import type { Metriche } from "@/lib/api/metriche";
import { CartaAnno } from "@/components/annali/carta-anno";
import { CartaLetture } from "@/components/annali/carta-letture";
import { CartaVoti } from "@/components/annali/carta-voti";
import { Classifica } from "@/components/annali/classifica";
import { TortaGeneri } from "@/components/annali/torta-generi";

/**
 * Le carte degli Annali. Riusata identica per le proprie metriche e per
 * quelle di un collegato: non sa mai di chi sono i dati che riceve, solo
 * se scrivere in seconda o terza persona.
 *
 * ---------------------------------------------------------------------
 * TRE PESI, NON TRE LASTRE UGUALI
 *
 * §14 dice "una carta per blocco di metrica, tutte sul piano 1, nessuna
 * sollevata". Il piano resta uno solo: negli Annali non c'è niente da
 * afferrare, quindi niente da sollevare, e non c'è un piano 2 qui
 * dentro. Ma "stesso piano" non vuol dire "stesso peso": prima erano
 * tre carte a piena larghezza, identiche per forma e dimensione, e la
 * pagina non aveva un primo elemento. Ora la gerarchia la fa la
 * tipografia, che è il mezzo giusto per farla.
 *
 *   1. L'anno       piena larghezza, numeri a 52px, più la forma dei mesi
 *   2. Chi e cosa   due colonne, autori e generi affiancati
 *   3. Voti e letture  due colonne, numeri a 28px
 *
 * Tre gradini di dimensione del numero, non tre carte uguali.
 * ---------------------------------------------------------------------
 */
export function CarteMetriche({
  metriche,
  altrui = false,
  /** "Tu, nello stesso anno" sulla scheda di un collegato: una riga, non
   * una carta. Vedi `PaginaAnnaliCollegato`. */
  affiancamento,
}: {
  metriche: Metriche;
  altrui?: boolean;
  affiancamento?: React.ReactNode;
}) {
  return (
    // La divergenza a cavallo d'anno non è più una riga sciolta in coda
    // alla pagina: è un limite dei numeri della carta prima, e vive nella
    // sua chiosa insieme allo scarto delle pagine.
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <CartaAnno metriche={metriche} altrui={altrui} />
        {affiancamento}
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <div className="plane-1 grain rounded-card p-5 sm:p-6">
          <Classifica
            titolo="Autori più letti"
            righe={metriche.autoriPiuLetti}
            nota="Un libro scritto in due si divide fra i due autori, e lo stesso vale per i generi. Un libro vale sempre uno, mai due."
          />
        </div>

        <div className="plane-1 grain rounded-card p-5 sm:p-6">
          <TortaGeneri
            righe={metriche.generiPrincipali}
            libriSenzaGenere={metriche.libriSenzaGenere}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <CartaVoti metriche={metriche} altrui={altrui} />
        <CartaLetture metriche={metriche} altrui={altrui} />
      </div>

    </div>
  );
}
