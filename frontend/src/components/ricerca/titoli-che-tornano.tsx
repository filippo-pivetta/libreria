"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { TitoloMensola } from "@/components/ricerca/titolo-mensola";
import { Mensola as MensolaScheletro } from "@/components/states/scheletri";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/api/access-token";
import { cercaPopolari, type TitoloPopolare } from "@/lib/api/ricerca";
import { spessoreCosta } from "@/lib/shelf-pack";
import { useContainerWidth, useMisureScaffale } from "@/lib/use-container-width";
import { ErroreApp } from "@/lib/api/errore";

const CHIAVE = "ricerca-popolari";
/** Quanti si chiedono al backend: il doppio di quanti se ne mostrano
 * all'apertura, così "Mostrane altri" non è una seconda richiesta —
 * è la stessa lista, solo più lunga. */
const RICHIESTI = 12;
const MOSTRATI_ALL_APERTURA = 6;

/**
 * Impacchetta larghezza-reale, come lo scaffale (`lib/shelf-pack.ts`), ma
 * più semplice: nessuna tacca alfabetica (l'ordine qui è la classifica,
 * non il cognome dell'autore, e non va perturbato) e generico sull'item
 * invece che su `VoceConLibro`. Tenuta separata da `impacchetta` invece
 * di generalizzarla: due mestieri diversi — sfogliare la propria libreria
 * e guardare una piccola classifica — non vale la pena legarli a una
 * sola funzione per risparmiare quindici righe.
 */
function impacchettaSemplice<T>(
  elementi: T[],
  larghezzaElemento: (elemento: T) => number,
  larghezzaDisponibile: number,
  gap: number,
): T[][] {
  if (larghezzaDisponibile <= 0) return elementi.length > 0 ? [elementi] : [];
  const righe: T[][] = [];
  let corrente: T[] = [];
  let usato = 0;
  for (const elemento of elementi) {
    const proprio = larghezzaElemento(elemento);
    const spazioGap = corrente.length > 0 ? gap : 0;
    if (usato + spazioGap + proprio > larghezzaDisponibile && corrente.length > 0) {
      righe.push(corrente);
      corrente = [elemento];
      usato = proprio;
    } else {
      corrente.push(elemento);
      usato += spazioGap + proprio;
    }
  }
  if (corrente.length > 0) righe.push(corrente);
  return righe;
}

/**
 * «I titoli che tornano» (§13, ridisegno del 25 agosto 2026): la terza
 * corsia di «Aggiungi un libro», per chi apre la pagina senza un titolo
 * in mente e senza nemmeno voler chiedere a un modello. Una piccola
 * classifica dei titoli più amati DENTRO l'istanza — mai un nome, mai
 * quanti lettori, mai uno dei tuoi — calcolata lato server
 * (`libri_popolari`, migrazione 20260825150000) e mai su questo
 * componente, che si limita a impacchettarla su una mensola.
 *
 * Nessuna sezione quando non c'è nulla da mostrare: un'istanza appena
 * nata, senza abbastanza voti, non ha bisogno di dirlo — è una corsia in
 * più, non una promessa.
 */
export function TitoliCheTornano() {
  const [containerRef, larghezza] = useContainerWidth<HTMLDivElement>();
  const [misureRef, misure] = useMisureScaffale();
  const [espansa, setEspansa] = useState(false);

  const query = useQuery({
    queryKey: [CHIAVE],
    queryFn: async () => {
      const token = await getAccessToken();
      const risultato = await cercaPopolari(token, RICHIESTI);
      if (risultato.status !== "ok") throw new ErroreApp(risultato.errore);
      return risultato.data;
    },
  });

  const tutti = query.data ?? [];
  const visibili = espansa ? tutti : tutti.slice(0, MOSTRATI_ALL_APERTURA);

  const righe = useMemo(
    () =>
      impacchettaSemplice<TitoloPopolare>(
        visibili,
        (t) => spessoreCosta(t.pagineMedianeCatalogo, misure) + misure.copertina,
        larghezza,
        misure.gap,
      ),
    [visibili, larghezza, misure],
  );

  // Errore o istanza troppo giovane: la corsia non insiste, sparisce. Non
  // è la ricerca sopra, che è il mestiere della pagina — questa è un
  // suggerimento in più, e un suggerimento vuoto non merita una riga di
  // scuse.
  if (query.isError || (query.isSuccess && tutti.length === 0)) return null;

  return (
    <section className="flex flex-col gap-2">
      <p className="t-title text-[22px]">I titoli che tornano</p>
      <p className="t-meta max-w-prose">
        Quelli che qui si finiscono più spesso, e più spesso si votano alto. Chi li abbia letti
        non si dice, e nemmeno quanti; e nessuno di questi è già tuo.
      </p>

      {/* Sonda alta zero, larga `--cover-w`: stesso presidio dello scaffale
          (`components/libreria/volume.tsx`) per leggere le misure reali
          invece di ricopiarle come costanti. */}
      <div ref={misureRef} aria-hidden className="h-0 w-(--cover-w) overflow-hidden" />

      {/* `containerRef` sta QUI, fuori dal ramo di caricamento — non solo
          sul contenuto vero. `useContainerWidth` misura al montaggio del
          componente proprietario (un `useEffect` a dipendenze vuote, non
          uno che rincorre il nodo DOM): se il div da misurare nasce solo
          dopo che i dati arrivano, quell'unica misurazione trova `null`
          e la larghezza resta 0 per sempre. Da lì `impacchettaSemplice`
          restituiva un'unica riga con tutti gli elementi (nessuna riga
          "piena" mai chiusa), che il `flex-wrap` di `.shelf-row` spezzava
          comunque in più righe VISIVE — tre libri per volta su un
          telefono, ma con un solo `.shelf-board` sotto tutte, invece di
          uno per mensola: lo scaffale sembrava un ripiano solo. */}
      <div ref={containerRef} className="mt-2 flex flex-col gap-7">
        {query.isLoading ? (
          <MensolaScheletro volumi={6} />
        ) : (
          righe.map((riga, indice) => (
            <div key={indice} className="flex flex-col gap-0">
              <div className="shelf-row">
                {riga.map((titolo) => (
                  <TitoloMensola key={titolo.libroId} titolo={titolo} />
                ))}
              </div>
              <div className="shelf-board" />
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-4">
        <p className="t-meta">Una copertina apre la sua scheda: si può guardare un libro senza prenderlo.</p>
        {!espansa && tutti.length > MOSTRATI_ALL_APERTURA && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 -mr-3"
            onClick={() => setEspansa(true)}
          >
            Mostrane altri
          </Button>
        )}
      </div>
    </section>
  );
}
