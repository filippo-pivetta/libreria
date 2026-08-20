/**
 * Mensola vuota per lo stato vuoto della libreria. A tratto, colore da
 * `currentColor` (va colorata con una classe `text-*`, es. `text-ink-soft`):
 * nessuna illustrazione piena, nessuna mascotte, nessun rettangolo
 * tratteggiato. È l'unico disegno concesso in tutta l'app (design doc §4,
 * §18), e solo qui, perché senza dorsi non c'è colore in pagina.
 *
 * Inlineata come componente invece che importata come file `.svg`: questo
 * progetto non ha un loader SVGR configurato (next.config.ts), e
 * un'importazione come asset statico (`next/image`/`<img src>`) non
 * erediterebbe `currentColor` — l'unico modo per colorarla con i token di
 * luce del tema, che cambiano lungo il giorno.
 */
export function EmptyShelf({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 120"
      fill="none"
      role="img"
      aria-label="Mensola vuota"
      className={className}
    >
      <g stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" opacity={0.55}>
        {/* il ripiano */}
        <path d="M18 92h284" />
        <path d="M18 96h284" opacity={0.4} />
        {/* i montanti, appena accennati */}
        <path d="M18 92V70" opacity={0.5} />
        <path d="M302 92V70" opacity={0.5} />
        {/* tre sagome di volumi assenti, tratteggiate: dicono cosa ci andrà */}
        <path d="M52 92V54" strokeDasharray="3 5" opacity={0.45} />
        <path d="M74 92V54" strokeDasharray="3 5" opacity={0.45} />
        <path d="M52 54h22" strokeDasharray="3 5" opacity={0.45} />
        <path d="M96 92V44" strokeDasharray="3 5" opacity={0.35} />
        <path d="M126 92V44" strokeDasharray="3 5" opacity={0.35} />
        <path d="M96 44h30" strokeDasharray="3 5" opacity={0.35} />
        <path d="M148 92V62" strokeDasharray="3 5" opacity={0.25} />
        <path d="M162 92V62" strokeDasharray="3 5" opacity={0.25} />
        <path d="M148 62h14" strokeDasharray="3 5" opacity={0.25} />
      </g>
    </svg>
  );
}
