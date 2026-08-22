"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Selettore ad anno a frecce (design-frontend.md §14): l'intervallo è
 * quello dichiarato dal backend (`annoMinimo`/`annoMassimo` — PRD,
 * comportamento #12: "dal primo anno con dati all'anno corrente"), non
 * un calendario libero. Gli anni futuri restano comunque rifiutati lato
 * server anche se questo componente non li propone mai.
 */
export function SelettoreAnno({
  anno,
  annoMinimo,
  annoMassimo,
  onCambiaAnno,
}: {
  anno: number;
  annoMinimo: number;
  annoMassimo: number;
  onCambiaAnno: (anno: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Anno precedente"
        disabled={anno <= annoMinimo}
        onClick={() => onCambiaAnno(anno - 1)}
      >
        <ChevronLeft />
      </Button>
      <p className="t-num w-14 text-center font-display text-xl text-ink" aria-live="polite">
        {anno}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Anno successivo"
        disabled={anno >= annoMassimo}
        onClick={() => onCambiaAnno(anno + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
