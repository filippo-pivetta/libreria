"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Nessun risultato, in nessuna fonte.
 *
 * Il PRD vieta la creazione manuale di schede, quindi qui non esiste un
 * "crea comunque" e offrirlo sarebbe una bugia (design doc §13). Il libro
 * va chiesto a chi mantiene l'istanza, e la richiesta va resa un gesto
 * facile invece di una frase di scuse: una riga già scritta, da copiare.
 *
 * Compare **solo** quando entrambe le ricerche hanno risposto bene e la
 * lista fusa è vuota. Se una fonte non ha risposto lo stato è un altro, e
 * confonderli farebbe credere che il libro non esista.
 */
export function VicoloCieco({ termine }: { termine: string }) {
  const [copiato, setCopiato] = useState(false);
  const richiesta = `Puoi aggiungere al catalogo: ${termine}`;

  async function copia() {
    try {
      await navigator.clipboard.writeText(richiesta);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 3000);
    } catch {
      // Fuori da un contesto sicuro `clipboard` non esiste. Il testo
      // resta selezionabile qui sotto: non serve dirlo, si vede.
      setCopiato(false);
    }
  }

  return (
    <div className="plane-1 grain flex flex-col gap-3 rounded-card p-5">
      <p className="font-ui text-sm text-ink">Nessun libro trovato per «{termine}».</p>
      <p className="max-w-prose text-sm text-ink-soft">
        Le schede non si creano a mano: questo libro va chiesto a chi mantiene l&apos;istanza.
        Copia la riga qui sotto e mandagliela.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-object bg-surface-2 px-2 py-1 font-ui text-xs text-ink">
          {richiesta}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copia()}>
          {copiato ? "Copiata" : "Copia la richiesta"}
        </Button>
      </div>
    </div>
  );
}
