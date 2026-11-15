import { Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";

import { ContatoreConDati } from "@/components/layout/barra-dati";
import { Link } from "@/components/ui/link";
import type { DatiBarra } from "@/lib/dati/barra";
import { precaricaPercorso } from "@/rotte/precarica";

/**
 * LA BARRA IN FONDO, SOTTO I 640px (novembre 2026).
 *
 * Era una striscia opaca a tutta larghezza, incollata al bordo, con quattro
 * parole in maiuscoletto da 10,5px e un filetto sopra la voce accesa. Ora è
 * ciò che un iPhone mostra in ogni app di sistema: una capsula che galleggia
 * sopra il contenuto, in vetro (il contenuto ci scorre sotto e si intuisce),
 * con icona ed etichetta per ogni voce e una pillola che dice dove sei.
 *
 * ---------------------------------------------------------------------------
 * LA PILLOLA E LA GOCCIA.
 *
 * La pillola non salta da una voce all'altra: ci scivola, con un piccolo
 * oltrepasso, e mentre scivola si allunga e si schiaccia come una goccia che
 * corre (`.barra-schede__goccia`, tokens.css) per poi ricomporsi. Sono due
 * proprietà distinte su due elementi — `translate` sulla pillola, `scale`
 * sulla goccia dentro — così la corsa e la deformazione non si pestano.
 *
 * Si può anche trascinare: si appoggia il dito, la goccia si gonfia come una
 * lente e segue il pollice, e al rilascio si apre la voce su cui è caduta.
 * È il gesto della barra di iOS 26 ed è un'aggiunta, non un'alternativa: il
 * tocco semplice e la tastiera restano quelli di un `<Link>`.
 *
 * La voce accesa si sposta subito al tocco, non quando la pagina nuova ha
 * finito di caricare: `useNavigation` dà la destinazione in corso, e la
 * pillola va lì mentre i dati arrivano.
 *
 * ---------------------------------------------------------------------------
 * Il vetro, la goccia e la corsa stanno tutti in tokens.css: lì ci sono anche
 * il ripiego opaco per chi alza il contrasto e l'immobilità per chi riduce il
 * movimento.
 */

type Voce = {
  href: string;
  label: string;
  Icona: ComponentType<{ piena?: boolean; className?: string }>;
};

/** Oltre questa distanza (px) un tocco diventa un trascinamento. */
const SOGLIA_TRASCINAMENTO = 8;

export function BarraSchede({
  voci,
  attiva,
  dati,
}: {
  voci: readonly Voce[];
  attiva: (pathname: string, href: string) => boolean;
  dati: Promise<DatiBarra>;
}) {
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();

  // La destinazione in corso vince sulla pagina mostrata: la pillola parte
  // al tocco, non all'arrivo dei dati.
  const percorso = navigation.location?.pathname ?? location.pathname;
  const indice = voci.findIndex((voce) => attiva(percorso, voce.href));

  // La goccia si deforma a ogni CAMBIO di voce, non al primo disegno: la
  // chiave cambia solo quando l'indice cambia dopo il montaggio.
  const [salto, setSalto] = useState(0);
  const indicePrecedente = useRef(indice);
  useEffect(() => {
    if (indicePrecedente.current !== indice && indicePrecedente.current !== -1 && indice !== -1) {
      setSalto((n) => n + 1);
    }
    indicePrecedente.current = indice;
  }, [indice]);

  const vetroRef = useRef<HTMLDivElement>(null);
  const pillolaRef = useRef<HTMLSpanElement>(null);
  const tocco = useRef<{ x: number; trascina: boolean; id: number } | null>(null);
  const ignoraClic = useRef(false);
  const [trascina, setTrascina] = useState(false);

  function misure() {
    const vetro = vetroRef.current;
    if (!vetro) return null;
    const rect = vetro.getBoundingClientRect();
    const stile = getComputedStyle(vetro);
    const pad = parseFloat(stile.paddingLeft) || 0;
    const larghezzaVoce = (rect.width - pad * 2) / voci.length;
    return { sinistra: rect.left + pad, larghezzaVoce };
  }

  function indiceSotto(x: number) {
    const m = misure();
    if (!m) return -1;
    const i = Math.floor((x - m.sinistra) / m.larghezzaVoce);
    return Math.min(voci.length - 1, Math.max(0, i));
  }

  function seguiDito(x: number) {
    const m = misure();
    const pillola = pillolaRef.current;
    if (!m || !pillola) return;
    const massimo = (voci.length - 1) * m.larghezzaVoce;
    const posizione = Math.min(massimo, Math.max(0, x - m.sinistra - m.larghezzaVoce / 2));
    pillola.style.setProperty("--trascina", `${posizione}px`);
  }

  return (
    <nav
      aria-label="Navigazione principale"
      className="barra-schede sm:hidden"
      data-trascina={trascina ? "" : undefined}
      onPointerDown={(evento) => {
        if (evento.button !== 0) return;
        tocco.current = { x: evento.clientX, trascina: false, id: evento.pointerId };
      }}
      onPointerMove={(evento) => {
        const t = tocco.current;
        if (!t || t.id !== evento.pointerId) return;
        if (!t.trascina) {
          if (Math.abs(evento.clientX - t.x) < SOGLIA_TRASCINAMENTO) return;
          t.trascina = true;
          setTrascina(true);
        }
        seguiDito(evento.clientX);
        const sotto = voci[indiceSotto(evento.clientX)];
        if (sotto) precaricaPercorso(sotto.href);
      }}
      onPointerUp={(evento) => {
        const t = tocco.current;
        tocco.current = null;
        if (!t?.trascina) return;
        setTrascina(false);
        const destinazione = voci[indiceSotto(evento.clientX)];
        // Il clic che il browser potrebbe ancora mandare al link sotto il
        // punto di PARTENZA non deve aprire quella voce invece di questa.
        ignoraClic.current = true;
        window.setTimeout(() => (ignoraClic.current = false), 400);
        if (destinazione && !attiva(percorso, destinazione.href)) navigate(destinazione.href);
      }}
      onPointerCancel={() => {
        tocco.current = null;
        setTrascina(false);
      }}
      onClickCapture={(evento) => {
        if (ignoraClic.current) {
          evento.preventDefault();
          evento.stopPropagation();
        }
      }}
    >
      <div ref={vetroRef} className="barra-schede__vetro" style={{ "--voci": voci.length } as React.CSSProperties}>
        <span
          ref={pillolaRef}
          aria-hidden
          className="barra-schede__pillola"
          data-visibile={indice !== -1 || trascina ? "" : undefined}
          style={{ "--indice": Math.max(indice, 0) } as React.CSSProperties}
        >
          <span key={salto} className="barra-schede__goccia" data-salto={salto > 0 ? "" : undefined} />
        </span>

        {voci.map((voce) => {
          const accesa = attiva(percorso, voce.href);
          return (
            <Link
              key={voce.href}
              href={voce.href}
              prefetch
              draggable={false}
              aria-current={accesa ? "page" : undefined}
              className="barra-schede__voce"
            >
              <span className="relative">
                <voce.Icona piena={accesa} className="size-6" />
                {voce.href === "/readers" && (
                  <span className="barra-schede__contatore">
                    <Suspense fallback={null}>
                      <ContatoreConDati promessa={dati} />
                    </Suspense>
                  </span>
                )}
              </span>
              <span className="barra-schede__etichetta">{voce.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
