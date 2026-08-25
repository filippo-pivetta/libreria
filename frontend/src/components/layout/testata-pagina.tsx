"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La testata di una pagina: il titolo grande in cima e, sotto i 640px, la
 * barra che ne raccoglie la parola quando quello esce dallo schermo
 * (design-frontend.md §4/§8, revisione delle testate).
 *
 * Perché esiste. Su mobile `ProtectedNav` non monta niente in cima — la
 * navigazione è in fondo — quindi finito lo scorrimento del titolo la
 * pagina restava anonima: l'unica cosa a dire dove si fosse era la
 * linguetta accesa, `.t-label` a 10,5px, al bordo opposto a quello dove
 * cade l'occhio. Il §7 aveva usato proprio quella linguetta per
 * giustificare la rimozione del titolo dalla Libreria; l'argomento non
 * regge alla propria misura, e comunque non era stato applicato a
 * Quaderni, Lettori e Profilo, che ripetono la parola accesa tali e
 * quali. La risposta non è togliere il titolo né tenerlo fermo: è farlo
 * collassare, come fa iOS dal 2017 e come fa ancora in iOS 26.
 *
 * `IntersectionObserver` e non un ascoltatore di `scroll`: il secondo
 * costringerebbe a leggere `scrollTop` a ogni frame per animare una
 * proporzione, e la proporzione qui non serve — la barra c'è o non c'è, e
 * l'incrocio fra le due lo fa `opacity` con `--dur-panel`. Un osservatore
 * sta fermo finché il bordo non passa.
 *
 * La soglia non è "il titolo esce dal viewport" — a quel punto per un
 * istante non ci sarebbe titolo da nessuna parte — ma "il titolo sta
 * passando sotto la barra", con un anticipo che fa incrociare le due.
 *
 * L'anticipo è 22px, cioè mezza barra, e NON 44: con 44 la barra
 * comparirebbe a pagina ferma. Il conto è questo. `<main>` ha 12px di
 * padding, e un titolo da 44px con `text-box-trim` misura circa 31px di
 * riquadro visibile: sta quindi fra y=12 e y=43, cioè INTERAMENTE sopra
 * la linea dei 44. Con una soglia lì, `isIntersecting` sarebbe falsa già
 * al caricamento. A 22 il titolo a riposo la supera di ventun pixel, e
 * nel caso peggiore — un occhiello sopra, come sugli Annali, o due righe
 * di titolo, come su «Aggiungi un libro» — il margine cresce, non cala.
 *
 * La barra è `aria-hidden`: ripete alla lettera l'`<h1>` che sta nel
 * flusso, e a un lettore di schermo il titolo della pagina va detto una
 * volta sola. Chi naviga a salti continua a trovare l'`<h1>` vero.
 */
export function TestataPagina({
  titolo,
  titoloBarra,
  occhiello,
  sottotitolo,
  numero = false,
  children,
}: {
  /** Il titolo grande. */
  titolo: string;
  /** Che cosa scrive la barra, se diverso dal titolo: sugli Annali il
   *  titolo è «2026» ma la barra deve dire dove si è, cioè «Annali». */
  titoloBarra?: string;
  /** Micro-etichetta sopra il titolo. */
  occhiello?: string;
  /** Solo se dichiara un confine che la pagina non può mostrare (§4). */
  sottotitolo?: string;
  /** Il titolo è un numero: cifre tabulari e spaziatura a zero, che il
   *  tracking negativo di `.t-page` è pensato per parole. */
  numero?: boolean;
  /** Ciò che sta a fianco del titolo sulla stessa riga (il selettore
   *  d'anno degli Annali). Da 640px in su si affianca, sotto va a capo. */
  children?: React.ReactNode;
}) {
  const rifTitolo = useRef<HTMLHeadingElement>(null);
  const [collassato, setCollassato] = useState(false);

  useEffect(() => {
    const nodo = rifTitolo.current;
    if (!nodo) return;

    const osservatore = new IntersectionObserver(
      ([voce]) => setCollassato(!voce.isIntersecting),
      // Mezza barra di anticipo. Scritto a mano perché `rootMargin` non
      // accetta una variabile CSS; il perché di 22 e non 44 sta nel
      // commento in cima al file.
      { rootMargin: "-22px 0px 0px 0px", threshold: 0 },
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  return (
    <>
      <div className="barra-titolo" data-visibile={collassato || undefined} aria-hidden>
        <span>{titoloBarra ?? titolo}</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0">
          {occhiello && <p className="t-label">{occhiello}</p>}
          <h1
            ref={rifTitolo}
            // `.t-page-num` e non `.t-num`: quest'ultima porterebbe con sé
            // `font-family: var(--font-ui)` e il numero uscirebbe in Inter
            // Tight invece che in Fraunces (il perché sta in tokens.css,
            // accanto alla classe).
            className={`t-page${numero ? " t-page-num" : ""}${occhiello ? " mt-2" : ""}`}
          >
            {titolo}
          </h1>
          {sottotitolo && <p className="t-meta mt-2 max-w-prose">{sottotitolo}</p>}
        </div>
        {children}
      </div>
    </>
  );
}
