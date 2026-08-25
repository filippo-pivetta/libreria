"use client";

import { useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";

import type { Sfaccettatura } from "@/lib/api/scritti";
import { IconaFreccia } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

const VOCE =
  "flex w-full cursor-default items-center gap-2.5 rounded-object px-3 py-2.5 text-left font-ui text-sm text-ink outline-none select-none hover:bg-surface-2 focus-visible:bg-surface-2";

/**
 * Il filtro "ogni libro", con un campo che restringe man mano che si
 * scrive (design doc §22).
 *
 * ---------------------------------------------------------------------------
 * PERCHÉ NON È IL `Menu` CHE USA "ogni anno" ACCANTO.
 *
 * Un elenco statico regge poche decine di anni, non le centinaia di
 * titoli di una libreria che cresce da anni: sfogliarlo riga per riga
 * non è un modo di trovare qualcosa, è un modo di rinunciare a cercarlo.
 * `Menu` di Base UI, in più, porta un tastierino di digitazione e una
 * navigazione a frecce fra le voci — un composito pensato per un elenco
 * FERMO — e un campo di testo dentro quel composito si contende i tasti
 * con lui. `Popover` non ha quel composito: il campo resta un campo.
 *
 * ---------------------------------------------------------------------------
 * STESSO FILTRO DELLO SCAFFALE, non uno nuovo.
 *
 * `.toLowerCase().includes()` su titolo e autori, la stessa sostanza del
 * filtro testuale della Libreria (§7) — nessuna chiamata a nessun
 * modello, nessun debounce: alla scala di una libreria personale un
 * filtro locale risponde più in fretta di quanto ci metta il dito a
 * lasciare il tasto. Stessa frase per l'elenco vuoto.
 */
export function SelettoreLibro({
  libri,
  selezionato,
  onScegli,
  classePill,
}: {
  libri: Sfaccettatura[];
  selezionato: Sfaccettatura | null;
  onScegli: (chiave: string | null) => void;
  classePill: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [cerca, setCerca] = useState("");

  const termine = cerca.trim().toLowerCase();
  const filtrati = useMemo(() => {
    if (!termine) return libri;
    return libri.filter((libro) => {
      const dentroTitolo = libro.etichetta.toLowerCase().includes(termine);
      const dentroAutore = (libro.autori ?? []).some((autore) =>
        autore.toLowerCase().includes(termine),
      );
      return dentroTitolo || dentroAutore;
    });
  }, [libri, termine]);

  function scegli(chiave: string | null) {
    onScegli(chiave);
    setAperto(false);
  }

  return (
    <Popover.Root
      open={aperto}
      onOpenChange={(valore) => {
        setAperto(valore);
        // Il campo riparte vuoto a ogni apertura: un filtro lasciato
        // scritto da un giro precedente mostrerebbe un elenco già
        // ristretto senza che lo si sia appena chiesto.
        if (!valore) setCerca("");
      }}
    >
      <Popover.Trigger className={cn(classePill, "max-w-56")} aria-label="Filtra per libro">
        <span className="truncate">{selezionato?.etichetta ?? "Ogni libro"}</span>
        <IconaFreccia aria-hidden className="size-3" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-40">
          <Popover.Popup
            className={cn(
              "plane-1 grain flex w-72 origin-(--transform-origin) flex-col shadow-plane-2 outline-none",
              "transition-[opacity,scale] duration-(--dur-micro) ease-(--ease-rise)",
              "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
            )}
          >
            <div className="border-b border-line p-3">
              <input
                type="search"
                value={cerca}
                onChange={(evento) => setCerca(evento.target.value)}
                placeholder="Cerca per titolo o autore"
                aria-label="Cerca un libro fra i tuoi filtri"
                className="field-line w-full border-0 border-b border-line bg-transparent pb-1 font-ui text-sm text-ink outline-none placeholder:text-ink-soft"
              />
            </div>

            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1.5">
              <button type="button" onClick={() => scegli(null)} className={VOCE}>
                Ogni libro
              </button>

              {filtrati.length === 0 ? (
                <p className="t-meta px-3 py-2.5">Nessun libro con questo titolo o autore.</p>
              ) : (
                filtrati.map((libro) => (
                  <button
                    key={libro.chiave}
                    type="button"
                    onClick={() => scegli(libro.chiave)}
                    className={VOCE}
                  >
                    <span className="min-w-0 truncate">{libro.etichetta}</span>
                    <span className="t-meta ml-auto shrink-0">{libro.n}</span>
                  </button>
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
