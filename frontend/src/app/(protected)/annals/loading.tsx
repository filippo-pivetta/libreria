import { ScheletroAnnali } from "@/components/states/scheletri";

export default function Loading() {
  return (
    <div role="status" aria-busy>
      <span className="sr-only">Carico le metriche…</span>
      <ScheletroAnnali />
    </div>
  );
}
