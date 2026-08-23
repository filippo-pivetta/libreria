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
import Link from "next/link";

import { Volume } from "@/components/libreria/volume";
import { EmptyShelf } from "@/components/states/empty-shelf";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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
 * chiamata esterna. La ricerca semantica sui propri insight vive su una
 * pagina a sé (/cerca, issue #6), raggiunta dal collegamento qui
 * accanto: il design doc §7 vieta di fonderla in questo campo, perché
 * revocare il consenso lascerebbe l'Utente senza il modo di trovare un
 * libro. L'indice a lettere è la tacca fra un volume e l'altro
 * (lib/shelf-pack.ts), non un elemento separato sul bordo.
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
  const t = useTranslations();
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
          throw new Error(t("assenze.utenteInesistente"));
        }
        if (result.status === "non_collegato") {
          // Refetch in background (es. l'altro interrompe il
          // collegamento mentre si sta guardando la sua libreria):
          // ricade sull'ErrorState con lo stesso testo della pagina
          // (design doc §15, mai "sei stato rimosso"/"errore").
          throw new Error(t("assenze.libreriaChiusa"));
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
    // Un libro appena aggiunto compare come segnaposto tipografico e si
    // riempie quando il lavoro in secondo piano ha recuperato la
    // copertina (design doc §13). Si ricontrolla finché c'è almeno una
    // scheda in attesa, e **si smette da soli** quando non ce n'è più:
    // un intervallo fisso terrebbe sveglia una pagina che non aspetta
    // più nulla. È lo stato osservabile della colonna a dirlo, non la
    // coda dei lavori, che resta chiusa.
    refetchInterval: (query) =>
      query.state.data?.some((voce) => voce.libro.copertinaStato === "in_attesa") ? 5000 : false,
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
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroScaffale />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t("errori.libreriaNonCaricata")}
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
      <div className="plane-1 grain flex flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:py-16">
        <EmptyShelf className="h-[70px] w-auto text-ink-soft" />
        <p className="max-w-sm text-sm text-ink-soft">
          Puoi datare una lettura a quando è successa, non solo a oggi: la libreria storica non
          si schiaccia sulla data in cui la registri.
        </p>
        {!utenteCollegatoId && (
          <Link href="/aggiungi" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Aggiungi il primo libro
          </Link>
        )}
      </div>
    );
  }

  // I libri in lettura stanno solo nella fascia in cima: due insiemi
  // distinti, non due viste sugli stessi dati (design doc §7).
  const inCorso = filtrate.filter((voce) => IN_CORSO.has(voce.stato));
  const restoScaffale = filtrate.filter((voce) => !IN_CORSO.has(voce.stato));
  const righe = impacchetta(costruisciElementi(restoScaffale), larghezza, coverWidth);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* --------------------------------------------------------------------
          I COMANDI DELLA LIBRERIA (riscritti nella sessione UI)

          Prima erano tutti dentro un unico `flex flex-wrap`: campo di ricerca,
          cinque pastiglie di stato, il conteggio, e quattro
          collegamenti-pulsante di pari peso. Misurato su un telefono da 360px:
          380 pixel di comandi prima del primo libro, cioè metà schermata di
          chrome davanti al contenuto — e l’azione principale dell’app,
          "Aggiungi un libro", era l’ultima di quattro e in tono minore.

          Ora sono tre fasce con tre mestieri distinti:
            1. il titolo della pagina e l’azione primaria, sulla stessa riga;
            2. il filtro (campo + pastiglie + conteggio), che agisce su ciò che
               si vede sotto;
            3. le tre funzioni assistite, raccolte sotto un ingresso solo.
          -------------------------------------------------------------------- */}

      {/* 1. Azione primaria.
          "Aggiungi un libro" passa da `outline size="sm"` a pulsante pieno: è
          il gesto con cui la libreria esiste, e competeva ad armi pari con tre
          collegamenti che portano a funzioni occasionali. */}
      {!utenteCollegatoId && (
        <div className="flex items-center justify-between gap-4">
          <p className="t-label">La tua libreria</p>
          <Link href="/aggiungi" className={cn(buttonVariants({ size: "sm" }))}>
            Aggiungi un libro
          </Link>
        </div>
      )}

      {/* 2. Il filtro. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <input
            type="search"
            placeholder="Titolo o autore"
            value={filtroTesto}
            onChange={(event) => setFiltroTesto(event.target.value)}
            aria-label="Cerca per titolo o autore"
            className="field-line min-w-0 flex-1 border-0 border-b border-line bg-transparent px-0 py-2 font-ui text-sm text-ink outline-none placeholder:text-ink-soft sm:max-w-sm sm:flex-none"
          />
          {/* Il conteggio dice ciò che si vede, non ciò che c’è.
              Prima era sempre `data.length`, cioè il totale della libreria,
              anche con un filtro attivo che ne nascondeva la metà: un numero
              che non corrispondeva a nulla di visibile sullo schermo. Quando
              un filtro è attivo lo dichiara, così resta chiaro perché lo
              scaffale è più corto. */}
          <span className="t-meta shrink-0 sm:ml-auto">
            {filtrate.length === data.length
              ? `${data.length} ${data.length === 1 ? "volume" : "volumi"}`
              : `${filtrate.length} di ${data.length}`}
            {inCorso.length > 0 ? ` · ${inCorso.length} in lettura` : ""}
          </span>
        </div>

        {/* Le pastiglie scorrono in orizzontale sotto i 640px invece di andare
            a capo su due righe: cinque etichette che si impilano rubavano una
            riga intera allo scaffale. `-mx-4 px-4` fa sì che la prima e
            l’ultima non restino incollate al bordo dello schermo mentre
            scorrono. */}
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Filtra per stato"
        >
          {STATI.map(({ valore, etichetta }) => {
            const attivo = !statiEsclusi.has(valore);
            const ribbon = RIBBON[valore];
            return (
              <button
                key={valore}
                type="button"
                aria-pressed={attivo}
                onClick={() => toggleStato(valore)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-xs transition-colors duration-(--dur-micro) ${classePillStato(valore, attivo)}`}
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
      </div>

      {/* 3. Le tre funzioni assistite, sotto un ingresso solo.

          Deviazione dichiarata da §7/§25/§26: ciascuna delle tre sezioni ha
          aggiunto a suo tempo il proprio collegamento "accanto ad Aggiungi un
          libro", e nessuno le ha mai viste tutte e tre insieme. La ragione di
          tenerle fuori dalla navigazione a quattro voci resta valida — sono
          funzioni che dipendono da un interruttore, e una voce di menu che
          può essere spenta è una voce sbagliata — ma la conseguenza, tre
          collegamenti di pari peso in mezzo ai filtri, no.

          Un <details> e non un menu a comparsa: è già il modello usato per
          "Altro" nelle transizioni di stato e per lo storico delle letture,
          funziona al tocco senza dipendere dal passaggio del mouse, e non ha
          bisogno di JavaScript per aprirsi. */}
      {!utenteCollegatoId && (
        <details className="group/assistite">
          <summary className="t-meta inline-flex cursor-pointer list-none items-center gap-1.5 rounded-field text-ink-soft hover:text-ink">
            Chiedi alla libreria
            <span aria-hidden className="text-[9px] transition-transform duration-(--dur-micro) group-open/assistite:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            <Link href="/cerca" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Cerca nei tuoi insight
            </Link>
            <Link href="/suggerimenti" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Suggerimenti di lettura
            </Link>
            <Link href="/sintesi" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sintesi dei tuoi temi
            </Link>
          </div>
        </details>
      )}

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
