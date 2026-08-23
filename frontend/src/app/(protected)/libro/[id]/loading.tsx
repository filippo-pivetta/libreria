import { ScheletroScheda } from "@/components/states/scheletri";

/**
 * `Chrome` (components/layout/chrome.tsx) si toglie di mezzo su `/libro/`,
 * perché quel ramo decide da sé quale barra mostrare — e con lui se ne va il
 * `<main>` con i suoi margini. Questo confine di attesa sostituisce il
 * segmento intero, layout compreso, quindi il contenitore se lo deve rimettere
 * da solo: senza, lo scheletro toccherebbe i bordi dello schermo e la pagina
 * salterebbe di lato all'arrivo dei dati.
 */
export default function Loading() {
  return (
    <main role="status" aria-busy className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
      <span className="sr-only">Caricamento del libro…</span>
      <ScheletroScheda />
    </main>
  );
}
