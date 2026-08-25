"use client";

import { useQuery } from "@tanstack/react-query";

import { getSfaccettature, type FiltriScritti, type TipoContenuto } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { IconaFreccia } from "@/components/ui/icone";
import { SelettoreLibro } from "@/components/quaderni/selettore-libro";

/**
 * Le pastiglie dei Quaderni: tipo, spoiler, anno, libro.
 *
 * ---------------------------------------------------------------------------
 * LO STESSO REGISTRO DELLE PASTIGLIE DELLO SCAFFALE (§7), e non per
 * simmetria estetica: dicono la stessa cosa. Sono l'unico modo gratuito
 * di guardare la stessa materia da un'altra angolazione — nessuna
 * chiamata al fornitore, nessun costo, e quindi nessuna ragione per
 * nasconderle dietro un disclosure. Prima dei Quaderni ridisegnati questa
 * pagina non aveva un solo gesto che non passasse da OpenAI.
 *
 * Vestiti identici a `libreria/scaffale.tsx`, comprese le due classi di
 * stato: una pastiglia accesa è inchiostro al 9% senza bordo, mai un
 * riempimento colorato — i libri restano l'unico posto dell'app dove il
 * colore è un dato.
 *
 * ---------------------------------------------------------------------------
 * "TUTTI" È UNO STATO DICHIARATO, non dedotto — stessa correzione che lo
 * scaffale ha già fatto: nessuna pastiglia nasce accesa, e la prima dice
 * qual è il punto di partenza invece di lasciarlo capire dall'assenza.
 *
 * Il tipo è a scelta singola e non additivo, a differenza degli stati
 * dello scaffale: insight e recensioni sono due sole voci, e "insight +
 * recensioni" è già "Tutti". Tre pastiglie che si sommano fino a
 * ricomporre la prima sarebbero tre modi di dire due cose.
 *
 * ---------------------------------------------------------------------------
 * I MENÙ OFFRONO SOLO VALORI CHE HANNO RIGHE. Anni e libri arrivano da
 * `GET /scritti/sfaccettature`, che restituisce solo ciò che esiste col
 * suo conteggio: un menù d'anno che elenca anni in cui non si è scritto
 * niente è un menù che promette elenchi vuoti. Non sono ristretti dalle
 * altre pastiglie di proposito — altrimenti restringere per tipo farebbe
 * sparire anni dal menù e non ci si potrebbe più tornare.
 */
export function FiltriScrittiBarra({
  filtri,
  onCambia,
}: {
  filtri: FiltriScritti;
  onCambia: (filtri: FiltriScritti) => void;
}) {
  const { data: sfaccettature } = useQuery({
    queryKey: ["scritti", "sfaccettature"],
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await getSfaccettature(token);
      return esito.status === "ok" ? esito.data : { anni: [], libri: [] };
    },
  });

  const nessunFiltro =
    !filtri.tipo && !filtri.soloSpoiler && filtri.anno == null && !filtri.voceIds?.length;

  function classePill(attivo: boolean): string {
    return attivo
      ? "border-transparent bg-ink/9 text-ink font-medium"
      : "border-line text-ink-soft hover:text-ink hover:border-line-strong";
  }

  const basePill =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-xs transition-colors duration-(--dur-micro)";

  function scegliTipo(tipo: TipoContenuto | null) {
    onCambia({ ...filtri, tipo: filtri.tipo === tipo ? null : tipo });
  }

  // Il menù ne sceglie sempre uno solo: l'elenco esiste per la lente
  // dei temi, che quando ricade sui libri ne passa molti insieme.
  const libroScelto = sfaccettature?.libri.find((libro) => libro.chiave === filtri.voceIds?.[0]);

  return (
    // Scorre in orizzontale sotto i 640px invece di andare a capo, come
    // la riga dello scaffale: sei etichette impilate ruberebbero due
    // righe al corpus. `-ml-4 pl-4` tiene la prima staccata dal bordo
    // dello schermo mentre si scorre indietro.
    <div
      className="-ml-4 flex min-w-0 gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:ml-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pl-0"
      role="group"
      aria-label="Filtra i tuoi scritti"
    >
      <button
        type="button"
        aria-pressed={nessunFiltro}
        onClick={() => onCambia({})}
        className={`${basePill} ${classePill(nessunFiltro)}`}
      >
        Tutti
      </button>

      <button
        type="button"
        aria-pressed={filtri.tipo === "insight"}
        onClick={() => scegliTipo("insight")}
        className={`${basePill} ${classePill(filtri.tipo === "insight")}`}
      >
        Insight
      </button>

      <button
        type="button"
        aria-pressed={filtri.tipo === "recensione"}
        onClick={() => scegliTipo("recensione")}
        className={`${basePill} ${classePill(filtri.tipo === "recensione")}`}
      >
        Recensioni
      </button>

      <button
        type="button"
        aria-pressed={!!filtri.soloSpoiler}
        onClick={() => onCambia({ ...filtri, soloSpoiler: !filtri.soloSpoiler })}
        className={`${basePill} ${classePill(!!filtri.soloSpoiler)}`}
      >
        Spoiler
      </button>

      {(sfaccettature?.anni.length ?? 0) > 1 && (
        <Menu>
          <MenuTrigger
            className={`${basePill} ${classePill(filtri.anno != null)}`}
            aria-label="Filtra per anno"
          >
            {filtri.anno ?? "Ogni anno"}
            <IconaFreccia aria-hidden className="size-3" />
          </MenuTrigger>
          <MenuContenuto>
            <MenuVoce onClick={() => onCambia({ ...filtri, anno: null })}>Ogni anno</MenuVoce>
            {sfaccettature?.anni.map((anno) => (
              <MenuVoce
                key={anno.chiave}
                onClick={() => onCambia({ ...filtri, anno: Number(anno.chiave) })}
              >
                <span className="t-num">{anno.etichetta}</span>
                <span className="t-meta ml-auto">{anno.n}</span>
              </MenuVoce>
            ))}
          </MenuContenuto>
        </Menu>
      )}

      {(sfaccettature?.libri.length ?? 0) > 1 && (
        <SelettoreLibro
          libri={sfaccettature?.libri ?? []}
          selezionato={libroScelto ?? null}
          onScegli={(chiave) => onCambia({ ...filtri, voceIds: chiave ? [chiave] : null })}
          classePill={`${basePill} ${classePill(!!filtri.voceIds?.length)}`}
        />
      )}
    </div>
  );
}
