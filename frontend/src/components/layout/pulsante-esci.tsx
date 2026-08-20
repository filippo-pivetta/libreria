import Link from "next/link";

/**
 * Pulsante di uscita a pillola, usato identico in ogni barra contestuale
 * (design doc §15, §9): "‹ Lettori" per uscire dalla libreria di un
 * collegato, "‹ [nome]" per uscire dal suo libro verso la sua libreria.
 * Stesso componente in entrambi i posti perché deve essere lo stesso
 * pulsante, non due varianti simili.
 */
export function PulsanteEsci({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="t-meta inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-ink hover:bg-surface-1"
    >
      <span aria-hidden>‹</span> {label}
    </Link>
  );
}
