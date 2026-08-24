import type { Metriche } from "@/lib/api/metriche";
import { TitoloConChiosa } from "@/components/ui/chiosa";

/**
 * Le metriche che stanno sulla Lettura e non sul Libro: abbandoni,
 * durata media, la lettura più lunga.
 *
 * Il PRD modella l'abbandono con cura (regola 13: non incrementa i libri
 * finiti, ma le sue pagine restano contate) e la pagina non lo nominava
 * mai. Mostrarlo non è una pagella: è la stessa onestà con cui gli
 * Annali dichiarano già i libri senza genere, applicata alle letture.
 *
 * Numeri di terzo peso, in Fraunces a 28px contro i 52 della carta
 * prima: tre gradini di dimensione fanno la gerarchia che tre carte
 * identiche impilate non facevano.
 */
export function CartaLetture({
  metriche,
  altrui = false,
}: {
  metriche: Metriche;
  altrui?: boolean;
}) {
  const { abbandoni, durataMediaGiorni, durataMassimaGiorni, durataMassimaTitolo } = metriche;

  // Nessuna lettura conclusa e nessun abbandono: la carta non ha niente
  // da dire e non compare. Meglio di tre zeri e una nota che li spiega.
  if (abbandoni === 0 && durataMediaGiorni === null) return null;

  return (
    <div className="plane-1 grain rounded-card p-5 sm:p-6">
      <TitoloConChiosa
        titolo="Le letture"
        chiosa={
          abbandoni > 0 ? (
            <p>
              Un abbandono non entra nei libri finiti, ma le sue pagine restano contate: sono
              pagine che {altrui ? "ha" : "hai"} letto. La durata conta gli estremi, quindi una
              lettura aperta e chiusa in giornata dura un giorno.
            </p>
          ) : (
            <p>
              La durata conta gli estremi: una lettura aperta e chiusa in giornata dura un giorno,
              non zero.
            </p>
          )
        }
      />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-4">
        <Misura valore={String(abbandoni)}>
          {abbandoni === 1 ? "abbandono" : "abbandoni"}
        </Misura>

        {durataMediaGiorni !== null && (
          <Misura valore={String(durataMediaGiorni)} unita={durataMediaGiorni === 1 ? "giorno" : "giorni"}>
            durata media
            <br />
            di una lettura
          </Misura>
        )}

        {durataMassimaGiorni !== null && (
          <Misura valore={String(durataMassimaGiorni)} unita={durataMassimaGiorni === 1 ? "giorno" : "giorni"}>
            la più lunga
            {durataMassimaTitolo && (
              <>
                <br />
                <span className="text-ink">{durataMassimaTitolo}</span>
              </>
            )}
          </Misura>
        )}
      </div>

    </div>
  );
}

function Misura({
  valore,
  unita,
  children,
}: {
  valore: string;
  unita?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 sm:flex-1 sm:flex-col sm:items-start sm:gap-0">
      <p
        className="t-num w-24 shrink-0 font-display text-[28px] leading-tight text-ink sm:w-auto"
        style={{ fontVariationSettings: '"opsz" 24, "SOFT" 10' }}
      >
        {valore}
        {unita && <span className="ml-1 text-base text-ink-soft">{unita}</span>}
      </p>
      <p className="t-meta sm:mt-1.5">{children}</p>
    </div>
  );
}
