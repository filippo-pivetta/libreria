"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { VoceConLibro } from "@/lib/api/voci";
import { nomiAutori } from "@/lib/autori";
import { RIBBON } from "@/lib/ribbon";
import { coloreDorso } from "@/lib/spine-color";
import { spessoreCosta } from "@/lib/shelf-pack";

/**
 * Il volume: costa (spessore = pagine) + copertina vera 2:3 rivolta a chi
 * guarda, con un segnaposto tipografico finché l'immagine non arriva o
 * quando non esiste. Il riquadro ha dimensioni fisse (--cover-w/--cover-h
 * in tokens.css): **non salta mai** quando l'immagine arriva, che è
 * esattamente ciò che il design §13 chiede per il libro appena aggiunto,
 * il cui recupero copertina gira in secondo piano.
 *
 * Il colore di fondo è quello dominante estratto dalla copertina vera; se
 * non c'è ancora — o non ci sarà mai — si ricade sul colore derivato
 * dall'id (`lib/spine-color.ts`), che resta il ripiego e non la regola.
 * Nella stanza scura vince la variante desaturata (design doc §3): la
 * scelta fra le due sta in CSS (`[data-light="notte"] .volume`,
 * styles/tokens.css), non qui, perché la stanza cambia con l'orario del
 * server e questo componente non deve saperlo.
 *
 * `inFascia` aggiunge il filo di avanzamento di 3px sul bordo inferiore
 * (design doc §7, regola 8), disponibile solo per le voci nella fascia
 * "in corso": `paginaCorrente` arriva da GET /voci solo per la Lettura
 * aperta (backend/app/repositories/voce_repository.py).
 */
export function Volume({ voce, inFascia = false }: { voce: VoceConLibro; inFascia?: boolean }) {
  const senzaPagine = voce.pagineAdottate == null;
  const ribbon = RIBBON[voce.stato];
  const autori = nomiAutori(voce.libro.autori);
  const etichetta = autori ? `${voce.libro.titoloCanonico} · ${autori}` : voce.libro.titoloCanonico;
  const ripiego = coloreDorso(voce.libro.id);
  const colore = voce.libro.copertinaColoreDominante ?? ripiego;
  const coloreScuro = voce.libro.copertinaColoreDominanteScuro ?? ripiego;
  const spessore = spessoreCosta(voce.pagineAdottate);
  const immagine = voce.libro.copertinaMiniaturaUrl;

  const percentuale =
    inFascia && voce.pagineAdottate && voce.paginaCorrente != null
      ? Math.min(100, Math.round((voce.paginaCorrente / voce.pagineAdottate) * 100))
      : null;

  return (
    <Link
      href={`/libro/${voce.id}`}
      className="volume"
      title={etichetta}
      aria-label={etichetta}
      {...(senzaPagine ? { "data-no-pages": "" } : {})}
      style={
        {
          "--cover-color": colore,
          "--cover-color-notte": coloreScuro,
          "--spine-w": `${spessore}px`,
        } as CSSProperties
      }
    >
      {ribbon && (
        <span
          aria-hidden
          className={`volume__ribbon ${ribbon.colorClass} ${ribbon.accessibileClass}`}
          style={{ height: `var(${ribbon.lenVar})` }}
        />
      )}
      <span className="volume__spine" aria-hidden />
      <span className="volume__cover">
        {immagine && (
          // Il riquadro esiste prima dell'immagine (dimensione fissa via
          // --cover-w/--cover-h): l'opacità passa a 1 solo a caricamento
          // avvenuto, mai uno scatto di layout. Un errore di caricamento
          // ricade in silenzio sul segnaposto sottostante, già presente
          // nel markup — nessuna icona di immagine rotta. `<img>` piano,
          // non next/image: il dominio delle copertine non esiste ancora
          // (pipeline non costruita, issue #4), non configurabile in
          // anticipo senza saperlo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // Ref e non solo onLoad: se il browser decodifica l'immagine
            // prima che React attacchi il listener — rete locale veloce,
            // cache — l'evento `load` non si ripete e `onLoad` non scatta
            // mai (verificato: `complete` e `naturalWidth` confermano
            // l'immagine caricata, ma nessun evento arriva). La ref gira a
            // ogni render e copre anche il caso sincrono; `onLoad` resta
            // per il caso asincrono normale.
            ref={(elemento) => {
              if (elemento?.complete) elemento.setAttribute("data-loaded", "");
            }}
            src={immagine}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <span className="volume__placeholder">
          <b>{voce.libro.titoloCanonico}</b>
          {autori && <span>{autori}</span>}
        </span>
        {percentuale !== null && (
          <span aria-hidden className="volume__prog">
            <i style={{ width: `${percentuale}%` }} />
          </span>
        )}
      </span>
    </Link>
  );
}
