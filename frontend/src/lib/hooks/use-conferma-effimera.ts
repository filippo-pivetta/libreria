"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Quanto resta a schermo una conferma. Un momento, non un messaggio da leggere. */
const DURATA_MS = 2200;

/**
 * La conferma discreta di un salvataggio senza pulsante "Salva".
 *
 * Dove si scrive e si esce dal campo (pagine adottate, nota di intenzione,
 * recensione) il blur non è di per sé un gesto di conferma come lo è un clic
 * su "Salva": senza un segnale, non c'è modo di sapere che la scrittura è
 * partita. Il toast resta riservato agli errori (design doc §19), quindi la
 * conferma è una riga che compare per un momento e sparisce.
 *
 * Perché un hook e non tre copie: era già scritto tre volte — in
 * `recensione.tsx`, `nota-intenzione.tsx` e `correggi-pagine.tsx` — ciascuna
 * con il proprio `DURATA_CONFERMA_MS = 2200`, e **nessuna delle tre puliva il
 * timer allo smontaggio**. Chi salvava e navigava via entro due secondi
 * lasciava un `setTimeout` che tentava di aggiornare lo stato di un componente
 * non più montato.
 *
 * Il testo è annunciato perché chi lo riceve è `<Messaggio>`, che porta
 * `aria-live="polite"` (components/ui/messaggio.tsx).
 */
export function useConfermaEffimera(durataMs: number = DURATA_MS) {
  const [visibile, setVisibile] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annulla = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const mostra = useCallback(() => {
    annulla();
    setVisibile(true);
    timer.current = setTimeout(() => {
      setVisibile(false);
      timer.current = null;
    }, durataMs);
  }, [annulla, durataMs]);

  // La pulizia che mancava in tutte e tre le copie precedenti.
  useEffect(() => annulla, [annulla]);

  return { visibile, mostra };
}
