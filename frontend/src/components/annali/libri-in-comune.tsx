import type { VoceConLibro } from "@/lib/api/voci";
import { coloreDorso } from "@/lib/spine-color";
import { Stella, formattaVoto } from "@/components/libro/voto-stelle";

/** Le stesse cinque stelline di `VotoStelle`, ma di sola lettura: qui non
 * si vota mai, si guardano due voti affiancati. */
function VotoAffiancato({ etichetta, voto }: { etichetta: string; voto: number | null }) {
  if (voto === null) return <p className="t-meta">{etichetta}: nessuno</p>;
  return (
    <p className="flex items-center gap-1.5">
      <span className="flex text-sm text-accent-strong">
        {[1, 2, 3, 4, 5].map((n) => (
          <Stella key={n} riempimento={voto - (n - 1)} />
        ))}
      </span>
      <span className="t-meta">
        {etichetta} · {formattaVoto(voto)}
      </span>
    </p>
  );
}

/**
 * "Libri letti in comune, con i voti affiancati" (docs/rimandato-annali-
 * collegato.md §4): una striscia orizzontale di copertine, non uno
 * scaffale — è un confronto fra due persone su un insieme di opere, non
 * un ripiano di libri di uno solo. L'insieme è l'intersezione dei
 * `libro_id` fra le due librerie, la stessa già calcolata per "N in
 * comune" nell'intestazione (`app/(protected)/lettori/[id]/page.tsx`).
 */
export function LibriInComune({
  vociProprie,
  vociCollegato,
}: {
  vociProprie: VoceConLibro[];
  vociCollegato: VoceConLibro[];
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
    <div className="plane-1 grain rounded-card p-5">
      <p className="t-label">
        Libri in comune
        <span className="ml-1.5 normal-case font-normal tracking-normal text-ink-soft">
          · {comuni.length}
        </span>
      </p>
      <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {comuni.map(({ propria, collegato }) => {
          const colore = collegato.libro.copertinaColoreDominante ?? coloreDorso(collegato.libroId);
          return (
            <li key={collegato.libroId} className="w-28 shrink-0">
              <div className="cover h-40 w-28" style={{ backgroundColor: colore }}>
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
                <p className="cover__placeholder flex items-center justify-center p-2 text-center font-display text-xs leading-snug text-on-accent">
                  {collegato.libro.titoloCanonico}
                </p>
              </div>
              <p className="t-meta mt-2 truncate" title={collegato.libro.titoloCanonico}>
                {collegato.libro.titoloCanonico}
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
                <VotoAffiancato etichetta="il tuo voto" voto={propria.voto} />
                <VotoAffiancato etichetta="il suo voto" voto={collegato.voto} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
