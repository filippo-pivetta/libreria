import type { VoceConLibro } from "@/lib/api/voci";
import { coloreDorso } from "@/lib/spine-color";
import { Stella, formattaVoto } from "@/components/libro/voto-stelle";
import { TitoloConChiosa } from "@/components/ui/chiosa";

/** Le stesse cinque stelline di `VotoStelle`, ma di sola lettura: qui non
 * si vota mai, si guardano due voti affiancati.
 *
 * L'etichetta sta SOPRA le stelle, non accanto. Accanto, a 128px di
 * colonna, "il tuo voto · 4,5" andava a capo in mezzo alla frase e
 * finiva sotto le stelle a righe sfalsate: cinque stelle da 14px più il
 * numero occupano già quasi tutta la colonna, e per la parola non
 * restava niente. Sopra, ogni riga ha una cosa sola da contenere e
 * nessuna può andare a capo. */
function VotoAffiancato({
  etichetta,
  voto,
  chiave,
}: {
  etichetta: string;
  voto: number | null;
  /** Gli `id` dei gradienti delle mezze stelle devono essere unici nel
   * documento, e qui le stesse cinque stelle compaiono due volte per riga
   * (il tuo voto e il suo) su ogni libro della striscia. */
  chiave: string;
}) {
  return (
    <div>
      <p className="t-label">{etichetta}</p>
      {voto === null ? (
        <p className="t-meta mt-1 whitespace-nowrap">nessun voto</p>
      ) : (
        <p
          className="mt-1 flex items-center gap-1.5 whitespace-nowrap"
          aria-label={`${etichetta}: ${formattaVoto(voto)} su 5`}
        >
          <span aria-hidden className="flex shrink-0 gap-px text-accent-strong">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="size-3">
                <Stella riempimento={voto - (n - 1)} chiave={`${chiave}-${n}`} />
              </span>
            ))}
          </span>
          <span aria-hidden className="t-num t-meta">
            {formattaVoto(voto)}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * "Libri letti in comune, con i voti affiancati": una striscia
 * orizzontale di copertine, non uno scaffale, perché è un confronto fra
 * due persone su un insieme di opere e non un ripiano di libri di uno
 * solo. L'insieme è l'intersezione dei `libro_id` fra le due librerie,
 * la stessa già calcolata per "N in comune" nell'intestazione
 * (`app/(protected)/lettori/[id]/page.tsx`).
 *
 * ---------------------------------------------------------------------
 * PERCHÉ LA STRISCIA ERA STORTA
 *
 * Ogni voce era `w-28 shrink-0` dentro un contenitore flex, e il titolo
 * aveva `truncate`. Non troncava: in un contenitore flex l'elemento ha
 * `min-width: auto`, cioè una larghezza minima automatica pari al suo
 * contenuto, e quel minimo **vince su `width`**. Le voci si allargavano
 * quanto il titolo più lungo, il troncamento non scattava mai, e i testi
 * traboccavano oltre la copertina. `min-w-0` è ciò che rende `w-32` una
 * larghezza vera e `truncate` un troncamento vero.
 *
 * Il resto veniva di conseguenza: altezze diverse voce per voce (una o
 * due righe di titolo, "nessuno" al posto delle stelle) rendevano la
 * riga dei voti irregolare da colonna a colonna. Ora la struttura è
 * fissa: copertina, titolo su una riga sola, e due blocchi voto con
 * l'etichetta sopra le stelle.
 * ---------------------------------------------------------------------
 */
export function LibriInComune({
  vociProprie,
  vociCollegato,
  nomeUtente,
}: {
  vociProprie: VoceConLibro[];
  vociCollegato: VoceConLibro[];
  /** L'etichetta del suo voto è il suo nome, non "il suo voto": la
   * striscia mette a confronto due persone, e una delle due ha un nome
   * che sta già in cima alla pagina. */
  nomeUtente: string;
}) {
  const proprieById = new Map(vociProprie.map((v) => [v.libroId, v]));
  const comuni = vociCollegato
    .map((collegato) => {
      const propria = proprieById.get(collegato.libroId);
      return propria ? { propria, collegato } : null;
    })
    .filter((v): v is { propria: VoceConLibro; collegato: VoceConLibro } => v !== null);

  if (comuni.length === 0) return null;

  return (
    <div className="plane-1 grain rounded-card p-5 sm:p-6">
      <TitoloConChiosa
        titolo={`Letti da tutti e due · ${comuni.length}`}
        chiosa={
          <p>
            L’insieme è l’intersezione delle due librerie sull’identità del Libro. Un’opera che i
            cataloghi hanno registrato due volte, per esempio un originale e una traduzione non
            ricondotti fra loro, resta fuori: per il prodotto sono due libri diversi.
          </p>
        }
      />

      {/* La sfumatura a destra dice che la striscia continua: senza, a
          nove libri l'ultima colonna sembra tagliata da un errore. */}
      <div className="relative mt-4">
        <ul className="flex gap-4 overflow-x-auto pb-1">
          {comuni.map(({ propria, collegato }) => {
            const colore = collegato.libro.copertinaColoreDominante ?? coloreDorso(collegato.libroId);
            return (
              // `min-w-0` è la riga che fa funzionare `w-32` e `truncate`.
              <li key={collegato.libroId} className="w-32 min-w-0 shrink-0">
                <div className="cover h-48 w-32" style={{ backgroundColor: colore }}>
                  {collegato.libro.copertinaMiniaturaUrl && (
                    // <img> piano, non next/image: bucket privato e
                    // firmato, come components/libreria/volume.tsx.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      ref={(elemento) => {
                        if (elemento?.complete) elemento.setAttribute("data-loaded", "");
                      }}
                      src={collegato.libro.copertinaMiniaturaUrl}
                      alt=""
                      decoding="async"
                      onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <p className="cover__placeholder flex items-center justify-center p-2.5 text-center font-display text-[13px] leading-snug">
                    {collegato.libro.titoloCanonico}
                  </p>
                </div>

                <p
                  className="mt-2.5 truncate font-ui text-sm text-ink"
                  title={collegato.libro.titoloCanonico}
                >
                  {collegato.libro.titoloCanonico}
                </p>

                <div className="mt-3 flex flex-col gap-2.5">
                  <VotoAffiancato
                    etichetta="tu"
                    voto={propria.voto}
                    chiave={`mio-${collegato.libro.id}`}
                  />
                  <VotoAffiancato
                    etichetta={nomeUtente}
                    voto={collegato.voto}
                    chiave={`suo-${collegato.libro.id}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-surface-1 to-transparent"
        />
      </div>
    </div>
  );
}
