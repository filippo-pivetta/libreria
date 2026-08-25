"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getPensieroCheTorna, type Scritto } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaData } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";

const SOGLIA_SENTENZA = 200;

function quantoFa(giorni: number): string {
  if (giorni < 45) return `${giorni} giorni fa`;
  const mesi = Math.round(giorni / 30);
  if (mesi < 18) return `${mesi} mesi fa`;
  const anni = Math.round(giorni / 365);
  return anni === 1 ? "un anno fa" : `${anni} anni fa`;
}

/**
 * Il contenuto dello slot: testo, libro, comando.
 *
 * Isolato in un componente suo per un motivo preciso, non per gusto di
 * scomposizione: montato con `key={scritto.contenutoId}` (sotto), ogni
 * suo stato — `espanso`, `troncato` — riparte da zero a ogni pensiero
 * nuovo, semplicemente perché React lo smonta e lo rimonta. Nessun
 * effetto di reset scritto a mano nel gestore di "Mostrane un altro",
 * che dovrebbe indovinare il momento giusto in cui il pensiero VECCHIO
 * smette di essere quello vero — il momento giusto è "quando la chiave
 * cambia", e lasciarlo fare a React è l'unico modo che non sbaglia.
 */
function Contenuto({
  scritto,
  giorniFa,
  lingua,
  onMostraAltro,
}: {
  scritto: Scritto;
  giorniFa: number | null;
  lingua: string;
  onMostraAltro: () => void;
}) {
  const [espanso, setEspanso] = useState(false);
  const [troncato, setTroncato] = useState(false);
  const elemento = useRef<HTMLParagraphElement | null>(null);

  // "Mostra tutto" compare solo se la troncatura ha morso davvero. Il
  // CSS non lo dice a nessuno, quindi si misura: `scrollHeight` maggiore
  // di `clientHeight` significa che sotto la quarta riga c'è dell'altro.
  // Un ResizeObserver e non una misura sola al montaggio, perché la
  // larghezza della carta cambia col viewport e un testo che a 1024px
  // sta in quattro righe a 390px ne prende sei — stessa ragione per cui
  // lo scaffale osserva la propria larghezza invece di leggerla una
  // volta (`libreria/scaffale.tsx`).
  const testoRef = useCallback((nodo: HTMLParagraphElement | null) => {
    elemento.current = nodo;
    if (nodo) setTroncato(nodo.scrollHeight > nodo.clientHeight + 1);
  }, []);

  useEffect(() => {
    const nodo = elemento.current;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    const osservatore = new ResizeObserver(() => {
      setTroncato(nodo.scrollHeight > nodo.clientHeight + 1);
    });
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  const isAppunto = scritto.testo.length > SOGLIA_SENTENZA;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="t-label">Il pensiero che torna</h2>
        <span className="t-meta">
          {formattaData(scritto.data, lingua)}
          {giorniFa != null && giorniFa > 0 && ` · ${quantoFa(giorniFa)}`}
        </span>
      </div>

      <div>
        {/* Il tetto è `.t-clamp-4` (tokens.css), quattro righe: è la
            misura sotto cui una sentenza non si tronca mai, quindi il
            comando compare solo quando il pensiero che torna è davvero
            un appunto lungo. */}
        <p
          ref={testoRef}
          className={`${isAppunto ? "t-appunto max-w-prose" : "t-sentenza max-w-[46ch]"} ${
            espanso ? "" : "t-clamp-4"
          }`}
        >
          {scritto.testo}
        </p>
        {troncato && !espanso && (
          <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setEspanso(true)}>
            Mostra tutto
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <Link
          href={`/libro/${scritto.voceId}`}
          className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {scritto.titolo}
          {scritto.autori.length > 0 && ` · ${scritto.autori.join(", ")}`}
        </Link>
        <button
          type="button"
          onClick={onMostraAltro}
          className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Mostrane un altro
        </button>
      </div>
    </div>
  );
}

/**
 * Lo slot sollevato in cima ai Quaderni: un proprio scritto vecchio,
 * ripescato, uno al giorno (design doc §22).
 *
 * ---------------------------------------------------------------------------
 * PERCHÉ È PIANO 2 E NON PIANO 1.
 *
 * Ogni altra carta della pagina è piano 1, la carta su cui si legge.
 * Questa è piano 2, l'oggetto sollevato (§2): non è una riga dell'elenco
 * capitata in cima, è una cosa che ti è stata messa davanti. Il salto di
 * piano è l'unica differenza che la distingue — corpo, carattere e misura
 * restano quelli di un insight qualsiasi, perché §10 non ammette una
 * terza misura tipografica decisa da chi scrive la pagina.
 *
 * ---------------------------------------------------------------------------
 * NON DIPENDE DAL CONSENSO.
 *
 * È una riga già scritta, ripescata dal database: nessun testo esce verso
 * il fornitore, nessun vettore viene letto. È la ragione per cui lo slot
 * resta in cima anche quando la ricerca per significato è spenta — e con
 * lui resta il motivo per aprire questa pagina.
 *
 * ---------------------------------------------------------------------------
 * SPARISCE QUANDO UNA LENTE È ACCESA.
 *
 * Chi ha appena posto una domanda non vuole un pensiero a caso sopra la
 * risposta: lo slot è l'apertura del riposo. Chi lo monta decide se c'è
 * (`quaderni.tsx`), qui non c'è alcuna condizione sulla lente.
 *
 * ---------------------------------------------------------------------------
 * "MOSTRANE UN ALTRO" NON FA SPARIRE LA CARTA MENTRE ASPETTA.
 *
 * Ogni scarto è una chiave di cache diversa (sotto), quindi senza
 * `placeholderData: keepPreviousData` il passaggio da uno scarto
 * all'altro tornava per un istante a `isLoading`, la sezione restituiva
 * `null` e la carta intera spariva e riappariva — uno scatto vero, non
 * un difetto di percezione. Con `keepPreviousData` il pensiero VECCHIO
 * resta a schermo mentre il nuovo arriva in sottofondo, e il passaggio
 * dall'uno all'altro avviene tutto insieme quando i dati sono pronti:
 * `Contenuto` è rimontato con `key={scritto.contenutoId}`, che aziona la
 * transizione `.pannello` (opacity + translate via `@starting-style`,
 * tokens.css) esattamente come ogni altro pannello dell'app.
 */
export function PensieroCheTorna() {
  const lingua = useLocale();
  const [scarto, setScarto] = useState(0);

  const { data, isLoading } = useQuery({
    // Lo scarto sta nella chiave: "mostrane un altro" è una richiesta
    // diversa, non la stessa invalidata — e tornare indietro deve poter
    // pescare dalla cache.
    queryKey: ["pensiero-che-torna", scarto],
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await getPensieroCheTorna(token, scarto);
      return esito.status === "ok" ? esito.data : null;
    },
    placeholderData: keepPreviousData,
  });

  // Niente segnaposto durante il primo caricamento e niente stato vuoto
  // quando non si è ancora scritto nulla: lo slot semplicemente non c'è,
  // e la pagina comincia dal campo. Un riquadro che dice "qui comparirà
  // un tuo vecchio pensiero" occuperebbe lo spazio del pensiero senza
  // esserlo. `isLoading` qui vale true solo al primo giro: dal secondo
  // in poi `keepPreviousData` tiene `data` valorizzato durante il fetch.
  if (isLoading || !data?.scritto) return null;

  const scritto = data.scritto;

  return (
    <section className="plane-2 grain overflow-hidden rounded-card p-6 sm:p-8">
      <Contenuto
        key={scritto.contenutoId}
        scritto={scritto}
        giorniFa={data.giorniFa}
        lingua={lingua}
        onMostraAltro={() => setScarto((precedente) => precedente + 1)}
      />
    </section>
  );
}
