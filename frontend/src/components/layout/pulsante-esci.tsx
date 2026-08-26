import Link from "next/link";

import { IconaFreccia } from "@/components/ui/icone";

/**
 * Pulsante di uscita a pillola, usato identico in ogni barra contestuale
 * (design doc §15, §9): "‹ Lettori" per uscire dalla libreria di un
 * collegato, "‹ [nome]" per uscire dal suo libro verso la sua libreria.
 * Stesso componente in entrambi i posti perché deve essere lo stesso
 * pulsante, non due varianti simili.
 */
export function PulsanteEsci({ href, label }: { href: string; label: string }) {
  return (
    // `bersaglio` e non l'altezza gonfiata: la pillola resta alta 34px
    // (la misura giusta per una barra contestuale) e sotto il dito ne
    // prende 44. La chevron era il glifo di testo `‹`, che cambia
    // disegno col carattere di sistema — stessa correzione già fatta per
    // `⋯` e `▾` (`ui/icone.tsx`).
    <Link
      href={href}
      className="bersaglio t-meta inline-flex h-[2.125rem] shrink-0 items-center gap-1 rounded-full border border-line-strong pr-3.5 pl-2.5 text-ink transition-colors duration-(--dur-micro) hover:bg-surface-1"
    >
      <IconaFreccia aria-hidden className="size-4 shrink-0 rotate-90" />
      {label}
    </Link>
  );
}
