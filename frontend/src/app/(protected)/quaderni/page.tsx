import { Quaderni } from "@/components/quaderni/quaderni";

export const metadata = { title: "Quaderni" };

/**
 * Quaderni (design doc §22): ciò che l'Utente ha scritto leggendo — ricerca
 * per significato nei propri insight e recensioni, e i temi che li
 * attraversano.
 *
 * Sostituisce `/cerca` e `/sintesi`, due pagine con lo stesso impianto che
 * nascevano vuote e si raggiungevano solo da un disclosure chiuso in mezzo ai
 * filtri della Libreria. Questa invece è una voce di navigazione: il perché
 * sta in `components/layout/protected-nav.tsx` e in §5.
 *
 * Nessun fetch iniziale lato server, stessa filosofia di `/aggiungi`: il
 * componente client interroga da sé (`GET /sintesi-tematica` a riposo,
 * `POST /ricerca/semantica` su domanda) e gestisce anche lo stato "nessuna
 * sintesi ancora generata".
 */
export default function QuaderniPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <Quaderni />
    </div>
  );
}
