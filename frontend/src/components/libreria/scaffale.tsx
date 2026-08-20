"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getVoci, type StatoVoce, type VoceConLibro } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { getAccessToken } from "@/lib/api/access-token";
import { nomiAutori } from "@/lib/autori";
import { RIBBON } from "@/lib/ribbon";
import { costruisciElementi, impacchetta, type ShelfItem } from "@/lib/shelf-pack";
import { useContainerWidth, useCoverWidth } from "@/lib/use-container-width";
import { Volume } from "@/components/libreria/volume";
import { EmptyShelf } from "@/components/states/empty-shelf";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";

const IN_CORSO = new Set(["in_lettura", "in_pausa"]);

const STATI: { valore: StatoVoce; etichetta: string }[] = [
  { valore: "in_lettura", etichetta: "In lettura" },
  { valore: "in_pausa", etichetta: "In pausa" },
  { valore: "letto", etichetta: "Letto" },
  { valore: "abbandonato", etichetta: "Abbandonato" },
  { valore: "da_leggere", etichetta: "Da leggere" },
];

/**
 * La Libreria: vista unica (design-frontend.md §7, riscritta il 20 agosto
 * 2026 — non esiste più un dorso da solo né una vista a elenco). Uno
 * scaffale di copertine con la costa, mensole che si riempiono sulla
 * larghezza reale, fascia delle letture in corso in cima. Filtro testuale
 * su titolo/autore e filtro per stato, entrambi "gratuiti", nessuna
 * chiamata esterna. La ricerca semantica sui propri insight, che il
 * design doc vuole separata da questo campo, non esiste ancora (dipende
 * dal consenso IA, issue #6). L'indice a lettere è la tacca fra un volume
 * e l'altro (lib/shelf-pack.ts), non un elemento separato sul bordo.
 */
export function Scaffale({
  vociIniziali,
  utenteCollegatoId,
}: {
  vociIniziali: VoceConLibro[];
  /** Presente solo sulla pagina /lettori/[id] (design doc §15): la
   * libreria mostrata è quella di un collegato, non la propria — cambia
   * solo da dove arrivano i dati, il rendering sotto resta identico
   * (Volume è già di sola lettura). */
  utenteCollegatoId?: string;
}) {
  const [filtroTesto, setFiltroTesto] = useState("");
  const [statiEsclusi, setStatiEsclusi] = useState<Set<StatoVoce>>(() => new Set());
  const [containerRef, larghezza] = useContainerWidth<HTMLDivElement>();
  const coverWidth = useCoverWidth();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: utenteCollegatoId ? ["utente-voci", utenteCollegatoId] : ["voci"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (utenteCollegatoId) {
        const result = await getLibreriaCollegato(token, utenteCollegatoId);
        if (result.status === "not_found") {
          throw new Error("Questo utente non esiste.");
        }
        if (result.status === "non_collegato") {
          // Refetch in background (es. l'altro interrompe il
          // collegamento mentre si sta guardando la sua libreria):
          // ricade sull'ErrorState con lo stesso testo della pagina
          // (design doc §15, mai "sei stato rimosso"/"errore").
          throw new Error("Quella libreria non è più accessibile.");
        }
        if (result.status === "error") {
          throw new Error(result.message);
        }
        return result.voci;
      }
      const result = await getVoci(token);
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    initialData: vociIniziali,
  });

  const filtrate = useMemo(() => {
    const testo = filtroTesto.trim().toLowerCase();
    return data.filter((voce) => {
      if (statiEsclusi.has(voce.stato)) return false;
      if (!testo) return true;
      const dentroTitolo = voce.libro.titoloCanonico.toLowerCase().includes(testo);
      const dentroAutore = nomiAutori(voce.libro.autori).toLowerCase().includes(testo);
      return dentroTitolo || dentroAutore;
    });
  }, [data, filtroTesto, statiEsclusi]);

  function classePillStato(stato: StatoVoce, attivo: boolean): string {
    return attivo
      ? "border-transparent bg-ink/9 text-ink font-medium"
      : "border-line text-ink-soft hover:text-ink hover:border-line-strong";
  }

  function toggleStato(stato: StatoVoce) {
    setStatiEsclusi((precedente) => {
      const successivo = new Set(precedente);
      if (successivo.has(stato)) {
        successivo.delete(stato);
      } else {
        successivo.add(stato);
      }
      return successivo;
    });
  }

  if (isPending) {
    return <LoadingState label="Caricamento della libreria…" />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Impossibile caricare la libreria."}
        onRetry={() => void refetch()}
      />
    );
  }

  if (data.length === 0) {
    // L'unico disegno concesso in tutta l'app (design doc §18/§4): solo
    // qui, perché senza dorsi non c'è colore in pagina. Non riusa
    // <EmptyState>, pensato per un vicolo cieco generico (es. "nessun
    // libro trovato" più sotto) — questo è l'unico posto con
    // un'illustrazione.
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-line-strong py-16 text-center">
        <EmptyShelf className="h-[70px] w-auto text-ink-soft" />
        <p className="max-w-sm text-sm text-ink-soft">
          Puoi datare una lettura a quando è successa, non solo a oggi: la libreria storica non
          si schiaccia sulla data in cui la registri.
        </p>
      </div>
    );
  }

  // I libri in lettura stanno solo nella fascia in cima: due insiemi
  // distinti, non due viste sugli stessi dati (design doc §7).
  const inCorso = filtrate.filter((voce) => IN_CORSO.has(voce.stato));
  const restoScaffale = filtrate.filter((voce) => !IN_CORSO.has(voce.stato));
  const righe = impacchetta(costruisciElementi(restoScaffale), larghezza, coverWidth);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <input
          type="search"
          placeholder="Titolo o autore"
          value={filtroTesto}
          onChange={(event) => setFiltroTesto(event.target.value)}
          aria-label="Cerca per titolo o autore"
          className="field-line w-full max-w-sm border-0 border-b border-line bg-transparent px-0 py-2 font-ui text-sm text-ink outline-none placeholder:text-ink-soft"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per stato">
          {STATI.map(({ valore, etichetta }) => {
            const attivo = !statiEsclusi.has(valore);
            const ribbon = RIBBON[valore];
            return (
              <button
                key={valore}
                type="button"
                aria-pressed={attivo}
                onClick={() => toggleStato(valore)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-xs transition-colors ${classePillStato(valore, attivo)}`}
              >
                <span
                  aria-hidden
                  className={`block h-1.75 w-1.75 rounded-[2px] ${ribbon ? ribbon.colorClass : "border border-line"}`}
                />
                {etichetta}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-xs text-ink-soft">
          {data.length} {data.length === 1 ? "volume" : "volumi"}
          {inCorso.length > 0 ? ` · ${inCorso.length} in lettura` : ""}
        </span>
      </div>

      {inCorso.length === 0 && righe.length === 0 ? (
        <EmptyState title="Nessun libro trovato" description="Nessuna voce corrisponde al filtro." />
      ) : (
        <div ref={containerRef} className="flex flex-col gap-10">
          {inCorso.length > 0 && (
            <section aria-label="Letture in corso" className="flex flex-col gap-3">
              <p className="t-label">In lettura</p>
              <div className="reading-band pb-1">
                {inCorso.map((voce) => (
                  <Volume key={voce.id} voce={voce} inFascia />
                ))}
              </div>
              <div className="shelf-board" />
            </section>
          )}

          <section aria-label="Tutta la libreria" className="flex flex-col gap-7">
            {righe.map((riga, indice) => (
              <div key={indice} className="flex flex-col gap-0">
                <div className="flex flex-wrap items-end gap-3 pb-3">
                  {riga.map((item: ShelfItem) =>
                    item.type === "tick" ? (
                      <div key={item.key} className="shelf-tick" aria-hidden>
                        {item.letter}
                      </div>
                    ) : (
                      <Volume key={item.key} voce={item.voce} />
                    ),
                  )}
                </div>
                <div className="shelf-board" />
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
