"use client";

import { useEffect, useState } from "react";

/**
 * Valore differito nel tempo.
 *
 * Serve al campo di ricerca: il design doc §13 vuole "risultati che
 * compaiono mentre si digita", ma una chiamata a ogni tasto brucerebbe la
 * quota giornaliera di Google Books in una manciata di ricerche.
 *
 * Non `useDeferredValue` di React: quello rimanda il *render* rispetto a
 * un'interazione più urgente, non la chiamata di rete — con un input
 * controllato il fetch partirebbe comunque a ogni tasto.
 *
 * Unico hook di debounce dell'app: prima esisteva solo il `setTimeout`
 * dentro `use-container-width.ts`, legato al ResizeObserver e non
 * riutilizzabile.
 */
export function useDebounced<T>(valore: T, ritardo = 350): T {
  const [differito, setDifferito] = useState(valore);

  useEffect(() => {
    const timer = setTimeout(() => setDifferito(valore), ritardo);
    return () => clearTimeout(timer);
  }, [valore, ritardo]);

  return differito;
}
