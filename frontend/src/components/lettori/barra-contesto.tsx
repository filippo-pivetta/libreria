"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { iniziali } from "@/lib/iniziali";
import { PulsanteEsci } from "@/components/layout/pulsante-esci";

/**
 * Barra contestuale del collegato (design doc §15, emendamento 20 agosto
 * 2026): sostituisce per intero la barra globale, non è una sua
 * variazione. Uscita esplicita ("‹ Lettori", non il tasto indietro del
 * browser), nome della persona fisso mentre si scorre, due schede
 * interne — Libreria (`/lettori/[id]`) e Annali (`/lettori/[id]/annali`,
 * le sue metriche di lettura, issue #7).
 *
 * Piano 0, non piano 1: è la stanza, non un contenuto sollevato — stesso
 * principio della barra globale (design doc §5).
 */
export function BarraContesto({ utenteId, nomeUtente }: { utenteId: string; nomeUtente: string }) {
  const pathname = usePathname();
  const schedaAnnali = pathname === `/lettori/${utenteId}/annali`;

  return (
    <div
      className="plane-0 sticky top-0 z-30 border-b border-line"
      style={{ paddingTop: "var(--safe-t)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <PulsanteEsci href="/readers" label="Lettori" />
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-sm text-ink-soft"
          >
            {iniziali(nomeUtente)}
          </span>
          <span className="t-title truncate text-xl">{nomeUtente}</span>
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-6 px-4 sm:px-6" aria-label="Sezioni del collegato">
        <Link
          href={`/lettori/${utenteId}`}
          aria-current={!schedaAnnali ? "page" : undefined}
          className={`t-label relative pb-2.5 tracking-[0.1em] transition-colors ${
            !schedaAnnali
              ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Libreria
        </Link>
        <Link
          href={`/lettori/${utenteId}/annali`}
          aria-current={schedaAnnali ? "page" : undefined}
          className={`t-label relative pb-2.5 tracking-[0.1em] transition-colors ${
            schedaAnnali
              ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Annali
        </Link>
      </nav>
    </div>
  );
}
