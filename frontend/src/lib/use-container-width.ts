"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

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

  useEffect(() => {
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

const COVER_W_DESKTOP = 120;
const COVER_W_MOBILE = 96;
const BP_S = 640;

/** Rispecchia `@media (max-width: 640px) { :root { --cover-w: 96px } }`
 * di tokens.css: l'algoritmo di impacchettamento gira in JS e ha bisogno
 * dello stesso numero che il CSS applica visivamente. */
export function useCoverWidth(): number {
  const [width, setWidth] = useState(COVER_W_DESKTOP);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BP_S}px)`);
    const aggiorna = () => setWidth(mql.matches ? COVER_W_MOBILE : COVER_W_DESKTOP);
    aggiorna();
    mql.addEventListener("change", aggiorna);
    return () => mql.removeEventListener("change", aggiorna);
  }, []);

  return width;
}
