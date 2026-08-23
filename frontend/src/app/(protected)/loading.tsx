import { Skeleton } from "@/components/ui/skeleton";

/**
 * Confine di attesa dell'intera area protetta.
 *
 * Sta allo stesso livello di `layout.tsx`, quindi copre anche la sua attesa —
 * la verifica della sessione e `GET /me` — cioè il primo caricamento, quando
 * non si sa ancora dove si sta andando. Per questo è neutro e non ha la forma
 * di nessuna schermata in particolare: le rotte che hanno una forma
 * riconoscibile portano il proprio `loading.tsx` accanto alla pagina, e quello
 * vince perché è più vicino.
 *
 * `aria-busy` sul contenitore e una sola etichetta per i lettori di schermo:
 * gli scheletri dentro sono `aria-hidden`, altrimenti verrebbero annunciati
 * come una fila di elementi vuoti.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Un momento…</span>
      <Skeleton aria-hidden className="h-7 w-48" />
      <Skeleton aria-hidden className="h-64 w-full rounded-card" />
    </div>
  );
}
