"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * `useLayoutEffect` nel browser, `useEffect` sul server.
 *
 * La differenza è tutta nel momento in cui la misura arriva. Con
 * `useEffect` il browser **dipinge prima** di conoscere la larghezza, e
 * con larghezza zero `impacchetta` (shelf-pack.ts, riga 100) mette ogni
 * volume in un'unica mensola: si vedeva una fila sola, e subito dopo lo
 * scaffale che si riorganizzava. Su una libreria di una quindicina di
 * titoli era un salto pieno. `useLayoutEffect` misura e ricalcola prima
 * della pittura, quindi arrivando su questa pagina da una navigazione lo
 * scaffale nasce già nella sua forma definitiva.
 *
 * Sul server `useLayoutEffect` non ha senso e React avvisa: lì l'alias
 * cade su `useEffect`, che non verrà comunque mai eseguito.
 */
const useEffettoDiLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Larghezza reale di un contenitore, ricalcolata al ridimensionamento con
 * un debounce di circa 150ms (design doc §7, regola 5: le mensole si
 * impacchettano sulla larghezza reale, non su un numero fisso di libri —
 * serve un `ResizeObserver`, non un ascolto su `window.resize`, perché la
 * larghezza del contenitore può cambiare anche senza che cambi quella
 * della finestra, es. l'apertura di un pannello laterale).
 */
export function useContainerWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffettoDiLayout(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.clientWidth);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(entry.contentRect.width), 150);
    });
    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return [ref, width];
}

/** Le tre misure che decidono quanti volumi entrano in una mensola. */
export type MisureScaffale = {
  /** Larghezza della copertina, `--cover-w`. */
  copertina: number;
  /** Distanza fra un volume e l'altro, `--shelf-gap`. */
  gap: number;
  /** Spessore massimo della costa, `--spine-max`. */
  costaMax: number;
  /** Spessore minimo della costa, `--spine-min`. */
  costaMin: number;
};

const PREDEFINITE: MisureScaffale = { copertina: 120, gap: 12, costaMax: 28, costaMin: 6 };

function leggiPx(stile: CSSStyleDeclaration, nome: string, ripiego: number): number {
  const valore = Number.parseFloat(stile.getPropertyValue(nome));
  return Number.isFinite(valore) ? valore : ripiego;
}

/**
 * Legge dai token le misure che servono all'impacchettamento (shelf-pack.ts),
 * invece di ricopiarle come costanti.
 *
 * Prima qui c'era `useCoverWidth`, che rispecchiava a mano una sola riga di
 * `tokens.css` — `@media (max-width: 640px) { --cover-w: 96px }` — con due
 * numeri scritti in JavaScript e un `matchMedia`. Da quando al breakpoint
 * cambiano TRE valori, e da quando `--cover-w` è una `clamp()` sulla
 * larghezza della finestra (tre volumi per mensola su ogni telefono, non solo
 * su quelli da 390), ricopiarli sarebbe stato ricopiare una formula.
 *
 * `--cover-w` non si può leggere con `getPropertyValue`: una proprietà
 * personalizzata non registrata restituisce il testo della `clamp()`, non il
 * suo risultato. Si misura quindi una sonda alta zero e larga `var(--cover-w)`
 * — è il browser stesso a dire quanto sta applicando. Gli altri tre sono
 * lunghezze semplici e si leggono dal calcolato.
 */
export function useMisureScaffale(): [RefObject<HTMLDivElement | null>, MisureScaffale] {
  const sonda = useRef<HTMLDivElement>(null);
  const [misure, setMisure] = useState<MisureScaffale>(PREDEFINITE);

  useEffettoDiLayout(() => {
    const elemento = sonda.current;
    if (!elemento) return;

    const aggiorna = () => {
      const stile = getComputedStyle(elemento);
      const lette: MisureScaffale = {
        copertina: elemento.clientWidth || PREDEFINITE.copertina,
        gap: leggiPx(stile, "--shelf-gap", PREDEFINITE.gap),
        costaMax: leggiPx(stile, "--spine-max", PREDEFINITE.costaMax),
        costaMin: leggiPx(stile, "--spine-min", PREDEFINITE.costaMin),
      };
      setMisure((precedenti) =>
        precedenti.copertina === lette.copertina &&
        precedenti.gap === lette.gap &&
        precedenti.costaMax === lette.costaMax &&
        precedenti.costaMin === lette.costaMin
          ? precedenti
          : lette,
      );
    };

    aggiorna();
    // La sonda è larga `--cover-w`: quando la clamp cambia risultato al
    // ridimensionamento, è la sonda stessa a cambiare larghezza. Un solo
    // osservatore copre sia il breakpoint che la formula.
    const observer = new ResizeObserver(aggiorna);
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  return [sonda, misure];
}
