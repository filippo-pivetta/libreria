import { ScheletroElenco } from "@/components/states/scheletri";

export default function Loading() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-8">
      <span className="sr-only">Un momento…</span>
      <ScheletroElenco righe={3} />
      <ScheletroElenco righe={4} />
    </div>
  );
}
