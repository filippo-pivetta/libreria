import type { Metriche } from "@/lib/api/metriche";

/**
 * "Quest'anno" (design-frontend.md §14): libri finiti (con "di cui N
 * riletture" quando serve) e pagine lette, ciascuno con il proprio
 * limite accanto in una riga piccola, sempre — non solo nei casi
 * anomali. Riusata identica per l'affiancamento "Tu, nello stesso anno"
 * sulla scheda Annali di un collegato (docs/rimandato-annali-
 * collegato.md §2): stesso componente, dati diversi, mai un confronto —
 * niente percentuali, niente "hai letto più o meno di".
 */
export function CartaQuestAnno({
  titolo,
  metriche,
}: {
  /** "Quest'anno" solo se `metriche.anno` è davvero l'anno corrente
   * (chi chiama lo decide, es. `CarteMetriche`): sfogliando un anno
   * passato col selettore la dicitura letterale sarebbe falsa. */
  titolo: string;
  metriche: Metriche;
}) {
  const { libriFiniti, riletture, pagineLette, haLettureACavalloAnno } = metriche;

  return (
    <div className="plane-1 grain rounded-card p-5">
      <p className="t-label">{titolo}</p>
      <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <p className="t-num font-display text-4xl text-ink">{libriFiniti}</p>
          <p className="t-meta mt-1">
            {libriFiniti === 1 ? "libro finito" : "libri finiti"}
            {riletture > 0 &&
              ` · di cui ${riletture} ${riletture === 1 ? "rilettura" : "riletture"}: l'unità è la Lettura, non il Libro`}
          </p>
        </div>
        <div>
          <p className="t-num font-display text-4xl text-ink">
            {pagineLette.toLocaleString("it-IT")}
          </p>
          <p className="t-meta mt-1">
            pagine lette · i libri senza pagine adottate contano solo quelle registrate a mano, la
            somma non è mai completa
          </p>
        </div>
      </div>
      {haLettureACavalloAnno && (
        <p className="t-meta mt-4 border-t border-line pt-3">
          Una lettura conclusa nel {metriche.anno} è iniziata l&apos;anno prima: conta come libro
          finito qui, mentre le sue pagine restano divise fra i due anni secondo quando sono state
          segnate.
        </p>
      )}
    </div>
  );
}
