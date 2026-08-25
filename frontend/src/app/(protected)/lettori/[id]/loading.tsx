import { ScheletroScaffale } from "@/components/states/scheletri";

/** Stessa ragione di `libro/[id]/loading.tsx`: qui il `<main>` non arriva da
 * `Chrome`, che su questo ramo aggiunge la barra globale ma lascia il resto
 * (testata e contenuto) al layout di questa cartella — che a sua volta non
 * ha ancora fatto in tempo a montare `BarraContesto` mentre questo stato di
 * caricamento è a schermo. */
export default function Loading() {
  return (
    <main role="status" aria-busy className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
      <span className="sr-only">Un momento…</span>
      <ScheletroScaffale />
    </main>
  );
}
