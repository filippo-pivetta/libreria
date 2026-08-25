"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { TitoloPopolare } from "@/lib/api/ricerca";
import { coloreDorso } from "@/lib/spine-color";
import { spessoreGrezzo } from "@/lib/shelf-pack";

/**
 * Un volume su «I titoli che tornano» (§13): la stessa costa+copertina
 * dello scaffale (`components/libreria/volume.tsx`, stesse classi CSS),
 * ma per un libro che non ha ancora una Voce. Non `Volume` stesso: quel
 * componente è tipato su `VoceConLibro` e porta nastro di stato e filo
 * di avanzamento, due cose che un libro senza Voce non ha e non può
 * avere — un componente parallelo, non una variante con metà delle
 * prop opzionali.
 *
 * Il clic porta alla scheda, non aggiunge: "una copertina apre la sua
 * scheda, si può guardare un libro senza prenderlo" è il punto di questa
 * corsia. Nessun comando sopra la mensola, di proposito.
 */
export function TitoloMensola({ titolo }: { titolo: TitoloPopolare }) {
  const autori = titolo.autori.join(", ");
  const etichetta = autori ? `${titolo.titolo} · ${autori}` : titolo.titolo;
  const ripiego = coloreDorso(titolo.libroId);
  const colore = titolo.copertinaColoreDominante ?? ripiego;
  const coloreScuro = titolo.copertinaColoreDominanteScuro ?? ripiego;
  const pagine = titolo.pagineMedianeCatalogo;

  return (
    <Link
      href={`/book/catalogo/${titolo.libroId}`}
      className="volume liftable"
      title={etichetta}
      aria-label={etichetta}
      {...(pagine == null ? { "data-no-pages": "" } : {})}
      style={
        {
          "--cover-color": colore,
          "--cover-color-notte": coloreScuro,
          ...(pagine == null ? {} : { "--spine-w": `${spessoreGrezzo(pagine)}px` }),
        } as CSSProperties
      }
    >
      <span className="volume__spine" aria-hidden />
      <span className="volume__cover">
        {titolo.copertinaUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- copertina firmata dal nostro storage, non ottimizzabile da next/image
          <img
            ref={(elemento) => {
              if (elemento?.complete) elemento.setAttribute("data-loaded", "");
            }}
            src={titolo.copertinaUrl}
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
          <b>{titolo.titolo}</b>
          {autori && <span>{autori}</span>}
        </span>
      </span>
    </Link>
  );
}
