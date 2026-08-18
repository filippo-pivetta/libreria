import { Skeleton } from "@/components/ui/skeleton";

/**
 * Segnaposto generico per contenuto in caricamento. Non sa nulla della
 * forma dei dati che arriveranno: chi lo usa lo adatta con `className`
 * o lo sostituisce con uno scheletro più mirato quando serve.
 */
export function LoadingState({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
