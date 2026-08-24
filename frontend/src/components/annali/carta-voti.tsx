import type { Metriche } from "@/lib/api/metriche";
import { formattaVoto } from "@/components/libro/voto-stelle";
import { TitoloConChiosa } from "@/components/ui/chiosa";

/**
 * La distribuzione dei voti dell'anno, cinque colonne da una a cinque
 * stelle.
 *
 * Il voto sta su ogni Voce fin dal primo giorno, i collegati lo vedono
 * sullo scaffale, ed era l'unico dato del prodotto che non entrava in
 * nessuna metrica: sei numeri che dicono tutti *quanto* e nessuno che
 * dica *com'era*. Goodreads mostra la media, StoryGraph l'istogramma;
 * qui stanno bene entrambi, la media in cima fra i quattro numeri
 * grandi e la forma qui, con il denominatore dichiarato accanto.
 *
 * I mezzi voti si arrotondano alla stella superiore lato servizio: le
 * colonne sono cinque, la scala di voto ha dieci passi, e dieci colonne
 * su una carta di mezza pagina sarebbero illeggibili.
 */
export function CartaVoti({
  metriche,
  altrui = false,
}: {
  metriche: Metriche;
  altrui?: boolean;
}) {
  const { votiPerStella, votoMedio, libriVotati, libriFiniti } = metriche;
  const massimo = Math.max(...votiPerStella);
  const senzaVoto = libriFiniti - libriVotati;

  return (
    <div className="plane-1 grain rounded-card p-5 sm:p-6">
      <TitoloConChiosa
        titolo={altrui ? "Come li ha votati" : "Come li hai votati"}
        chiosa={
          senzaVoto > 0 && votoMedio !== null ? (
            <p>
              {senzaVoto} dei {libriFiniti} libri finiti {altrui ? "non li ha votati" : "non li hai votati"}:
              la media di {formattaVoto(votoMedio)} è calcolata sui {libriVotati} che hanno un voto.
              I mezzi voti stanno nella colonna della stella superiore.
            </p>
          ) : undefined
        }
      />

      {libriVotati === 0 ? (
        <p className="t-meta mt-2">
          Nessuno dei libri finiti nell’anno selezionato ha un voto.
        </p>
      ) : (
        <>
          <div className="mt-5 flex h-[78px] items-end gap-2.5">
            {votiPerStella.map((quanti, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                <span
                  className={`flex-none rounded-t-object ${quanti > 0 ? "bg-accent" : "border-t border-line"}`}
                  style={{ height: `${massimo > 0 ? Math.round((quanti / massimo) * 78) : 0}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
            {votiPerStella.map((_, i) => (
              <span key={i} className="t-label flex-1 text-center">
                {i + 1} ★
              </span>
            ))}
          </div>

        </>
      )}
    </div>
  );
}
