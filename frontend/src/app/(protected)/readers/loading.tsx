import { ScheletroElenco } from "@/components/states/scheletri";

export default function Loading() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Un momento…</span>
      <ScheletroElenco righe={5} />
    </div>
  );
}
