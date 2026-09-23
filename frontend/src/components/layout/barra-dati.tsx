"use client";

import { use } from "react";

import { PortaProfilo } from "@/components/layout/porta-profilo";
import type { DatiBarra } from "@/lib/dati/barra";

/**
 * I tre punti della barra che dipendono da un dato, ciascuno consumato
 * dal proprio confine di attesa.
 *
 * **Perché così spezzettati.** Prima sospendeva la barra intera, dietro
 * un rettangolo grigio: ma la barra è quasi tutta statica — le voci di
 * navigazione sono una costante — e quel grigio compariva a ogni
 * caricamento per poi essere sostituito, cioè proprio il lampo che
 * un'attesa ben fatta deve evitare. Sospendere solo le iniziali e il
 * contatore fa comparire la barra completa e ferma, con dentro due
 * dettagli che si riempiono un istante dopo (e, dopo la prima
 * navigazione, già pieni: il dato sta nella memoria del browser).
 *
 * I fallback non sono scheletri pulsanti ma spazio vuoto della misura
 * giusta: un cerchietto grigio che diventa due lettere è un cambio in
 * più da guardare, non un'informazione.
 */

export function PortaConDati({
  promessa,
  conNome = false,
}: {
  promessa: Promise<DatiBarra>;
  conNome?: boolean;
}) {
  const { userName } = use(promessa);
  return <PortaProfilo userName={userName} conNome={conNome} />;
}

/**
 * Il posto della porta del profilo mentre le iniziali arrivano.
 *
 * Rispecchia la struttura vera invece di essere un rettangolo: il
 * cerchio è di 32px dentro un bersaglio da 44 (`porta-profilo.tsx`), e
 * un segnaposto di misura diversa farebbe saltare la testata nel momento
 * in cui il dato arriva. Niente pulsazione: è spazio che aspetta, non
 * un'informazione da leggere.
 */
export function PortaInAttesa() {
  return (
    <span aria-hidden className="bersaglio flex shrink-0 items-center gap-2 rounded-full">
      <span className="h-8 w-8 rounded-full bg-surface-2" />
    </span>
  );
}

export function SalutoConDati({ promessa }: { promessa: Promise<DatiBarra> }) {
  const { saluto } = use(promessa);
  return <p className="t-saluto min-w-0 truncate">{saluto}</p>;
}

/**
 * Il contatore delle richieste ricevute: l'unico elemento in `alert` di
 * tutta l'app insieme alla zona di cancellazione dell'account (design
 * doc §5). Sta accanto a Lettori e non accanto al profilo — prima
 * segnalava una cosa che in quella pagina non si poteva fare, ora sta
 * accanto al posto dove si agisce.
 *
 * `aria-label` esplicita perché il solo numero, letto ad alta voce dopo
 * "Lettori", non dice di cosa è il conteggio.
 */
export function ContatoreConDati({ promessa }: { promessa: Promise<DatiBarra> }) {
  const { receivedRequestCount } = use(promessa);
  if (!receivedRequestCount) return null;

  return (
    <span
      className="rounded-object bg-alert px-1 py-0.5 font-ui text-[10px] font-semibold text-on-accent normal-case"
      aria-label={`${receivedRequestCount} ${
        receivedRequestCount === 1 ? "richiesta ricevuta" : "richieste ricevute"
      }`}
    >
      {receivedRequestCount}
    </span>
  );
}
