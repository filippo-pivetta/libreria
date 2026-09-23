"use client";

import { useQuery } from "@tanstack/react-query";

import { getSfaccettature, type FiltriScritti, type TipoContenuto } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { IconaFreccia } from "@/components/ui/icone";
import { SelettoreLibro } from "@/components/quaderni/selettore-libro";

/**
 * Le pastiglie dei Quaderni: tipo, anno, libro.
 *
 * ---------------------------------------------------------------------------
 * LO STESSO REGISTRO DELLE PASTIGLIE DELLO SCAFFALE (§7), e non per
 * simmetria estetica: dicono la stessa cosa. Sono l'unico modo gratuito
 * di guardare la stessa materia da un'altra angolazione — nessuna
 * chiamata al fornitore, nessun costo, e quindi nessuna ragione per
 * nasconderle dietro un disclosure. Prima dei Quaderni ridisegnati questa
 * pagina non aveva un solo gesto che non passasse da OpenAI.
 *
 * Vestiti identici a `libreria/scaffale.tsx` — ora davvero identici: il
 * disegno sta in `ui/pastiglia.tsx` invece di essere ricopiato qui e là.
 * Una pastiglia accesa è inchiostro PIENO, mai un riempimento colorato:
 * i libri restano l'unico posto dell'app dove il colore è un dato.
 * (Era `bg-ink/9`, cioè inchiostro al 9%: a distanza di un braccio non si
 * distingueva da spenta, e sotto il sole di un telefono nemmeno da
 * vicino. I temi, sulla stessa pagina, usavano già il pieno.)
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
 * NON C'È PIÙ UNA PASTIGLIA "SPOILER", e non va rimessa.
 *
 * Restringeva l'elenco agli scritti contrassegnati come spoiler. Ma nei
 * Quaderni ogni riga è già del richiedente — lo garantiscono le funzioni
 * SQL, che filtrano `utente_id = auth.uid()` — e la regola 10 del PRD
 * protegge da uno spoiler *altrui*, mai dal proprio testo: qui il
 * contrassegno non nasconde niente e infatti la carta lo mostra in chiaro
 * (`carta-scritto.tsx`). Era quindi l'unica pastiglia della riga a non
 * rispondere a una domanda che ci si fa davvero — "di che tipo", "di
 * quale anno", "su quale libro" sì; "quali dei miei pensieri avevo
 * marcato per i collegati" no.
 *
 * Il parametro `solo_spoiler` resta in `GET /scritti`: è il backend a
 * decidere se ritirarlo, e finché c'è non fa danno. Semplicemente questo
 * client non lo manda più.
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
    !filtri.tipo && filtri.anno == null && !filtri.voceIds?.length;

  // Il vestito è di `ui/pastiglia.tsx`: `basePill` e `classePill` erano
  // ricopiati alla lettera anche in `libreria/scaffale.tsx`, e le due
  // copie avevano già cominciato a divergere.
  const pill = (attivo: boolean) => pastigliaVariants({ taglia: "filtro", acceso: attivo });

  function scegliTipo(tipo: TipoContenuto | null) {
    onCambia({ ...filtri, tipo: filtri.tipo === tipo ? null : tipo });
  }

  // Il menù ne sceglie sempre uno solo: l'elenco esiste per la lente
  // dei temi, che quando ricade sui libri ne passa molti insieme.
  const libroScelto = sfaccettature?.libri.find((libro) => libro.chiave === filtri.voceIds?.[0]);

  return (
    // Scorre in orizzontale sotto i 640px invece di andare a capo, come
    // la riga dello scaffale: sei etichette impilate ruberebbero due
    // righe al corpus. La meccanica del nastro — e il perché del padding
    // verticale, che non è decorativo — sta in `.nastro-pastiglie`
    // (tokens.css).
    <div
      className="nastro-pastiglie"
      role="group"
      aria-label="Filtra i tuoi scritti"
    >
      <button
        type="button"
        aria-pressed={nessunFiltro}
        onClick={() => onCambia({})}
        {...attributiPastiglia}
        className={pill(nessunFiltro)}
      >
        Tutti
      </button>

      <button
        type="button"
        aria-pressed={filtri.tipo === "insight"}
        onClick={() => scegliTipo("insight")}
        {...attributiPastiglia}
        className={pill(filtri.tipo === "insight")}
      >
        Insight
      </button>

      <button
        type="button"
        aria-pressed={filtri.tipo === "recensione"}
        onClick={() => scegliTipo("recensione")}
        {...attributiPastiglia}
        className={pill(filtri.tipo === "recensione")}
      >
        Recensioni
      </button>

      {(sfaccettature?.anni.length ?? 0) > 1 && (
        <Menu>
          <MenuTrigger
            {...attributiPastiglia}
            className={pill(filtri.anno != null)}
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
          classePill={pill(!!filtri.voceIds?.length)}
        />
      )}
    </div>
  );
}
