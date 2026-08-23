import { ScheletroScaffale } from "@/components/states/scheletri";

/** Stessa ragione di `libro/[id]/loading.tsx`: qui il `<main>` non arriva da
 * `Chrome`, che su questo ramo lascia il posto alla barra contestuale. */
export default function Loading() {
  return (
    <main role="status" aria-busy className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
      <span className="sr-only">Un momento…</span>
      <ScheletroScaffale />
    </main>
  );
}
