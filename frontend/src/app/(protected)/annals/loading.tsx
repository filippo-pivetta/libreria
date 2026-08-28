import { ScheletroAnnali } from "@/components/states/scheletri";

export default function Loading() {
  return (
    <div role="status" aria-busy>
      <span className="sr-only">Un momento…</span>
      <ScheletroAnnali />
    </div>
  );
}
