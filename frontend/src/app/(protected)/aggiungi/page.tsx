import { RicercaLibri } from "@/components/ricerca/ricerca-libri";

/**
 * Ricerca e aggiunta di un libro dai cataloghi (design doc §13).
 *
 * A differenza di ogni altra pagina di `(protected)/`, qui il Server
 * Component non fa alcun fetch iniziale e non idrata `initialData`: senza
 * un termine non c'è nulla da caricare, e la sessione la verifica già il
 * layout. Non è una dimenticanza — è la sola pagina dell'app che nasce
 * vuota per costruzione.
 */
export default function AggiungiPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <RicercaLibri />
    </div>
  );
}
