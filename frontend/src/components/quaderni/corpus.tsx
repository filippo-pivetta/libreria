"use client";

import type { Scritto } from "@/lib/api/scritti";
import { CartaScritto } from "@/components/quaderni/carta-scritto";
import { EmptyState } from "@/components/states/empty-state";

/**
 * L'elenco di ciò che si è scritto: la regione che i Quaderni non hanno
 * mai avuto (design doc §22, §10 "la vista trasversale è rinviata").
 *
 * ---------------------------------------------------------------------------
 * DUE COLONNE, NON UNA RIGA PER SCRITTO.
 *
 * A una colonna sulla larghezza piena, una sentenza in Literata a 19px
 * correrebbe su novanta caratteri — il doppio della misura che §10 le
 * assegna (~34ch) — e l'elenco leggerebbe come un registro. A due
 * colonne ogni carta sta sui 470px, che è la misura giusta per il testo
 * che contiene, e la pagina legge come un quaderno: molti frammenti,
 * scandibili, invece di poche righe lunghe.
 *
 * Griglia e non colonne CSS: `columns` scorre in basso lungo la prima
 * colonna e poi riparte dall'alto, che su un elenco cronologico
 * significa leggere "dal più recente" due volte. La griglia va per
 * righe, quindi l'ordine resta quello che l'intestazione dichiara.
 * `items-start` perché ogni carta sia alta quanto il suo contenuto: una
 * sentenza di due righe non deve allungarsi per pareggiare l'appunto che
 * le sta accanto.
 *
 * Una carta con i vicini aperti prende tutta la riga da sé
 * (`carta-scritto.tsx`).
 */
export function Corpus({
  scritti,
  inCorso,
  vuoto,
}: {
  scritti: Scritto[];
  inCorso: boolean;
  /** Cosa dire quando non c'è niente. Lo decide chi monta la regione,
   * perché la ragione del vuoto dipende dalla lente: nessuno scritto,
   * nessuno che passi i filtri, o nessuno che somigli a una domanda —
   * e un elenco vuoto senza spiegazione dice la cosa falsa più credibile
   * che esista. */
  vuoto: { title: string; description?: string };
}) {
  if (inCorso && scritti.length === 0) return null;

  if (scritti.length === 0) {
    return <EmptyState title={vuoto.title} description={vuoto.description} />;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {scritti.map((scritto) => (
        <CartaScritto key={`${scritto.tipoContenuto}-${scritto.contenutoId}`} scritto={scritto} />
      ))}
    </div>
  );
}
