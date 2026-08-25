"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { iniziali } from "@/lib/iniziali";
import { PulsanteEsci } from "@/components/layout/pulsante-esci";

/**
 * Barra contestuale del collegato (design doc §15, emendamento 25 agosto
 * 2026): non sostituisce più la barra globale — quella resta, con
 * "Lettori" accesa (Chrome, ProtectedNav) — è la TESTATA della pagina
 * dentro di lei. Due difetti che aveva prima, entrambi di questa
 * ridisegno: sotto i 640px la barra in fondo spariva del tutto, e la
 * riga di uscita "andava a capo" appena il nome utente era lungo,
 * perché pillola, iniziali e nome dovevano stare tutti sulla stessa riga
 * strettissima.
 *
 * ---------------------------------------------------------------------
 * IL TITOLO È UNA PERSONA
 *
 * Le tue pagine si intitolano con un luogo — "Annali", "Quaderni" — e
 * questa con un nome proprio, in Fraunces (`.t-contenuto`, 34/46),
 * esattamente come Annali e Lettori intitolano LE LORO pagine. È il
 * segnale più forte disponibile e non costa un avviso, un badge o un
 * "stai guardando…": nessuna pagina di casa tua si apre con il nome di
 * qualcun altro.
 *
 * ---------------------------------------------------------------------
 * DUE STATI SU MOBILE, UNA RIGA SOLA SU DESKTOP
 *
 * Sotto i 640px il titolo grande scorre via come ogni altro contenuto —
 * non viene mai tolto dal DOM, solo scorso fuori dallo schermo, altrimenti
 * la testata "scatterebbe" invece di scorrere. Ciò che cambia è il
 * contenuto della barra di ritorno, sempre alta 44px e sempre in cima
 * (`position: sticky`): finché il nome grande è visibile porta solo
 * l'uscita, senza bordo; quando il nome esce dallo schermo la barra
 * mostra le sue iniziali e il suo nome, e prende bordo e ombra corta —
 * la stessa transizione di piano di ogni altro elemento sollevato
 * dell'app, non un'invenzione per questa sola barra. Le due schede
 * restano sempre visibili, appena sotto.
 *
 * Da 640px in su c'è spazio per tutto: uscita, nome grande e schede non
 * scorrono via da nessuna barra, restano semplicemente in cima alla
 * pagina come il titolo di ogni altra sezione.
 *
 * Piano 0, non piano 1: è la stanza, non un contenuto sollevato — stesso
 * principio della barra globale (design doc §5).
 */
export function BarraContesto({
  utenteId,
  nomeUtente,
  /** "128 volumi" — l'unico fatto che accompagna il nome qui. Non "in
   * comune con te" (che resta dove già viveva, sopra lo scaffale: chiede
   * la TUA libreria, non solo la sua, e ripeterla nella testata di
   * entrambe le schede l'avrebbe resa una spiegazione invece che un
   * fatto) e non una data di collegamento, che oggi l'API non porta fin
   * qui — meglio ometterla che inventarla. */
  sottotitolo,
}: {
  utenteId: string;
  nomeUtente: string;
  sottotitolo?: string;
}) {
  const pathname = usePathname();
  const schedaAnnali = pathname === `/lettori/${utenteId}/annali`;

  const [scorso, setScorso] = useState(false);
  const idRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = idRef.current;
    if (!nodo) return;
    // La soglia è la stessa altezza della barra di ritorno (44px): il
    // titolo grande conta come "scorso via" nell'istante in cui il suo
    // bordo inferiore raggiungerebbe il bordo inferiore della barra, non
    // quando tocca il bordo dello schermo — altrimenti i due si
    // sovrapporrebbero per un istante prima dello scambio.
    const osservatore = new IntersectionObserver(([voce]) => setScorso(!voce.isIntersecting), {
      rootMargin: "-44px 0px 0px 0px",
      threshold: 0,
    });
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  const tabs = (
    <>
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
    </>
  );

  return (
    <div className="plane-0">
      {/* -----------------------------------------------------------
          SOTTO 640px — due stati nella stessa barra sticky.
          ----------------------------------------------------------- */}
      <div className="sm:hidden">
        {/* `padding-top` per la safe area sta sul contenitore ESTERNO, ad
            altezza naturale: sommarlo a un'altezza fissa sulla stessa
            scatola (come faceva una versione precedente di questa riga)
            fa traboccare il contenuto oltre il bordo superiore non
            appena `--safe-t` non è zero — un iPhone con la Dynamic
            Island, non un'eccezione rara. La riga a 44px resta solo
            dentro, sulla scatola interna, dove nessun altro padding la
            contende. */}
        <div
          className={`sticky top-0 z-30 bg-surface-0 transition-[border-color,box-shadow] duration-(--dur-micro) ${
            scorso ? "border-b border-line shadow-[0_1px_2px_-1px_rgb(0_0_0_/_0.14)]" : "border-b border-transparent"
          }`}
          style={{ paddingTop: "var(--safe-t)" }}
        >
          <div className="flex h-11 items-center">
            {scorso ? (
              <div className="grid w-full grid-cols-[44px_1fr_44px] items-center">
                <Link
                  href="/readers"
                  aria-label="Torna a Lettori"
                  className="flex h-11 items-center justify-center text-[22px] leading-none text-ink"
                >
                  ‹
                </Link>
                <span className="flex min-w-0 items-center justify-center gap-2 px-1">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-[10px] text-ink-soft"
                  >
                    {iniziali(nomeUtente)}
                  </span>
                  <span className="truncate font-ui text-[15px] font-semibold tracking-[-0.005em] text-ink">
                    {nomeUtente}
                  </span>
                </span>
                <span aria-hidden />
              </div>
            ) : (
              <div className="px-1.5">
                <PulsanteEsci href="/readers" label="Lettori" />
              </div>
            )}
          </div>
        </div>

        <div ref={idRef} className="flex min-w-0 items-center gap-3 px-4 pb-4 pt-2">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-xl text-ink-soft"
          >
            {iniziali(nomeUtente)}
          </span>
          <div className="min-w-0">
            <h1 className="t-contenuto truncate">{nomeUtente}</h1>
            {sottotitolo && <p className="t-meta mt-1.5">{sottotitolo}</p>}
          </div>
        </div>

        <nav
          className="sticky top-11 z-30 flex gap-6 bg-surface-0 px-4 pt-2.5"
          aria-label="Sezioni del collegato"
        >
          {tabs}
        </nav>
      </div>

      {/* -----------------------------------------------------------
          DA 640px IN SU — una riga sola, niente sticky: c'è spazio.
          ----------------------------------------------------------- */}
      <div className="mx-auto hidden w-full max-w-5xl px-6 pt-6 sm:block">
        <Link
          href="/readers"
          className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ink-soft hover:text-ink"
        >
          <span aria-hidden className="text-[17px] leading-none">‹</span> Lettori
        </Link>

        <div className="mt-5 flex items-center gap-5">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-2xl text-ink-soft"
          >
            {iniziali(nomeUtente)}
          </span>
          <div className="min-w-0">
            <h1 className="t-contenuto truncate">{nomeUtente}</h1>
            {sottotitolo && <p className="t-meta mt-2">{sottotitolo}</p>}
          </div>
        </div>

        <nav className="mt-6 flex gap-7 border-b border-line" aria-label="Sezioni del collegato">
          {tabs}
        </nav>
      </div>
    </div>
  );
}
