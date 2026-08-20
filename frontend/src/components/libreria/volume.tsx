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
 * guarda, con un segnaposto tipografico finché l'immagine non arriva — o
 * non esiste, che oggi è sempre il caso: la pipeline copertine (issue #4)
 * non è ancora costruita, `copertinaMiniaturaPath` è sempre null. Il
 * riquadro ha dimensioni fisse (--cover-w/--cover-h in tokens.css): non
 * salta mai quando un'immagine reale arriverà.
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
  const colore = coloreDorso(voce.libro.id);
  const spessore = spessoreCosta(voce.pagineAdottate);
  const immagine = voce.libro.copertinaMiniaturaPath;

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
