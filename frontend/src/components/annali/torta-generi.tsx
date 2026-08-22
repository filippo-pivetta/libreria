"use client";

import { useId, useMemo, useState } from "react";

import type { VoceClassifica } from "@/lib/api/metriche";
// Stessa forma di un voto in stelle: riusata invece di reimplementarla
// (stesso motivo di classifica.tsx).
import { formattaVoto as formattaPeso } from "@/components/libro/voto-stelle";

const SPICCHI_IDENTITA_MASSIMI = 5;
// Sotto questa quota uno spicchio non porta un'etichetta diretta sopra
// l'arco: lo spazio non basterebbe a scriverla senza sovrapposizioni
// (dataviz skill: "label selettivamente, mai un numero su ogni punto").
const QUOTA_MINIMA_ETICHETTA_DIRETTA = 0.12;

type Spicchio = {
  chiave: string;
  nome: string;
  peso: number;
  quota: number;
  opacita: number;
  neutro: boolean;
};

function puntoSuCerchio(cx: number, cy: number, r: number, angolo: number) {
  return { x: cx + r * Math.cos(angolo), y: cy + r * Math.sin(angolo) };
}

/** Il perimetro di uno spicchio di ciambella fra due raggi e due angoli
 * (radianti, 0 = ore tre, senso orario perché l'asse y dell'SVG cresce
 * verso il basso). L'arco esterno percorso in avanti, quello interno
 * all'indietro, per chiudere l'anello invece di un cerchio pieno. */
function pathSpicchio(
  cx: number,
  cy: number,
  rEsterno: number,
  rInterno: number,
  angoloIniziale: number,
  angoloFinale: number,
): string {
  const arcoGrande = angoloFinale - angoloIniziale > Math.PI ? 1 : 0;
  const pEsternoA = puntoSuCerchio(cx, cy, rEsterno, angoloIniziale);
  const pEsternoB = puntoSuCerchio(cx, cy, rEsterno, angoloFinale);
  const pInternoB = puntoSuCerchio(cx, cy, rInterno, angoloFinale);
  const pInternoA = puntoSuCerchio(cx, cy, rInterno, angoloIniziale);
  return [
    `M ${pEsternoA.x} ${pEsternoA.y}`,
    `A ${rEsterno} ${rEsterno} 0 ${arcoGrande} 1 ${pEsternoB.x} ${pEsternoB.y}`,
    `L ${pInternoB.x} ${pInternoB.y}`,
    `A ${rInterno} ${rInterno} 0 ${arcoGrande} 0 ${pInternoA.x} ${pInternoA.y}`,
    "Z",
  ].join(" ");
}

/**
 * "Generi principali", a ciambella invece che a barre. Un solo accento
 * (design doc §3: "un solo accento... mai una scala di colori diversi"),
 * non una tavolozza categorica: gli spicchi sono la stessa tinta a passi
 * di opacità decrescenti, cioè una rampa sequenziale sul peso — la
 * lettura è "quanto pesa" più che "quale identità", coerente con
 * l'elenco già ordinato per peso che c'era prima. "Non classificato" è
 * l'eccezione: `surface-2`, lo stesso neutro con cui lo scaffale marca
 * ciò che non è dato pieno (PRD, "lo scarto è dichiarato accanto" —
 * qui accanto E dentro la torta).
 *
 * Al più cinque spicchi con identità propria: oltre, si ripiegano in
 * "Altri generi" (dataviz: una torta con troppi spicchi indistinguibili
 * non è più leggibile) — "mostra tutte" nella legenda sotto la
 * ciambella resta comunque la via per vedere ogni genere singolarmente,
 * senza aggiungere un altro spicchio.
 */
export function TortaGeneri({
  righe,
  libriSenzaGenere,
}: {
  righe: VoceClassifica[];
  libriSenzaGenere: number;
}) {
  const idLegenda = useId();
  const [espansa, setEspansa] = useState(false);
  const [attivo, setAttivo] = useState<string | null>(null);

  const { spicchi, totale, restanti } = useMemo(() => {
    const totalePesi = righe.reduce((somma, riga) => somma + riga.peso, 0);
    const totale = totalePesi + libriSenzaGenere;
    if (totale <= 0) return { spicchi: [] as Spicchio[], totale: 0, restanti: [] as VoceClassifica[] };

    const reali = righe.slice(0, SPICCHI_IDENTITA_MASSIMI);
    const restanti = righe.slice(SPICCHI_IDENTITA_MASSIMI);
    const pesoAltri = restanti.reduce((somma, riga) => somma + riga.peso, 0);

    // Rampa di opacità sul solo accento: dal pieno a un pavimento
    // leggibile, un passo per spicchio reale — mai una scala di tinte.
    const opacitaMinima = 0.32;
    const passo = reali.length > 1 ? (1 - opacitaMinima) / (reali.length - 1) : 0;

    const spicchi: Spicchio[] = reali.map((riga, indice) => ({
      chiave: riga.id,
      nome: riga.nome,
      peso: riga.peso,
      quota: riga.peso / totale,
      opacita: 1 - passo * indice,
      neutro: false,
    }));
    if (pesoAltri > 0) {
      spicchi.push({
        chiave: "__altri__",
        nome: restanti.length === 1 ? "Altro genere" : "Altri generi",
        peso: pesoAltri,
        quota: pesoAltri / totale,
        opacita: Math.max(opacitaMinima - 0.1, 0.14),
        neutro: false,
      });
    }
    if (libriSenzaGenere > 0) {
      spicchi.push({
        chiave: "__senza_genere__",
        nome: "Non classificato",
        peso: libriSenzaGenere,
        quota: libriSenzaGenere / totale,
        opacita: 1,
        neutro: true,
      });
    }
    return { spicchi, totale, restanti };
  }, [righe, libriSenzaGenere]);

  if (totale === 0) {
    return (
      <div>
        <p className="t-label">Generi principali</p>
        <p className="t-meta mt-2">Nessun dato per l&apos;anno selezionato.</p>
      </div>
    );
  }

  const raggioEsterno = 68;
  const raggioInterno = 42;
  const dimensione = raggioEsterno * 2;

  // reduce, non map con una variabile esterna riassegnata: il compilatore
  // React tratta la mutazione di una variabile catturata durante il
  // render come impura, anche quando qui è innocua (un solo passaggio
  // sincrono). L'angolo corrente viaggia nell'accumulatore.
  const { archi } = spicchi.reduce<{
    archi: (Spicchio & { inizio: number; fine: number })[];
    angoloCorrente: number;
  }>(
    (stato, spicchio) => {
      // Il tetto sotto il giro completo evita un arco degenere quando
      // uno spicchio solo copre tutta la torta (inizio e fine
      // coinciderebbero).
      const ampiezza = Math.min(spicchio.quota * 2 * Math.PI, 2 * Math.PI - 0.0001);
      const inizio = stato.angoloCorrente;
      const fine = inizio + ampiezza;
      return {
        archi: [...stato.archi, { ...spicchio, inizio, fine }],
        angoloCorrente: fine,
      };
    },
    { archi: [], angoloCorrente: -Math.PI / 2 }, // dodici in punto, poi in senso orario
  );

  // Righe della legenda: la stessa cinquina più "Altri generi" in un
  // unico rigo finché non si apre "mostra tutte" — a quel punto ogni
  // genere ripiegato torna a essere una riga propria (senza un secondo
  // spicchio: sono già tutti dentro "Altri generi" nella ciambella).
  const righeEspanse: Spicchio[] = espansa
    ? [
        ...archi.filter((a) => a.chiave !== "__altri__" && a.chiave !== "__senza_genere__"),
        ...restanti.map((riga) => ({
          chiave: riga.id,
          nome: riga.nome,
          peso: riga.peso,
          quota: riga.peso / totale,
          opacita: 0.14,
          neutro: false,
        })),
        ...archi.filter((a) => a.chiave === "__senza_genere__"),
      ]
    : archi;

  return (
    <div>
      <p className="t-label">Generi principali</p>
      <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <svg
          viewBox={`0 0 ${dimensione} ${dimensione}`}
          width={dimensione}
          height={dimensione}
          className="shrink-0"
          role="img"
          aria-label="Generi principali"
          aria-describedby={idLegenda}
        >
          {archi.map((arco) => (
            <g key={arco.chiave}>
              <path
                d={pathSpicchio(
                  raggioEsterno,
                  raggioEsterno,
                  raggioEsterno,
                  raggioInterno,
                  arco.inizio,
                  arco.fine,
                )}
                fill={arco.neutro ? "var(--mtg-surface-2)" : "var(--mtg-accent-strong)"}
                fillOpacity={arco.neutro ? 1 : arco.opacita}
                stroke="var(--mtg-surface-1)"
                strokeWidth={2}
                tabIndex={0}
                role="button"
                aria-label={`${arco.nome}: ${formattaPeso(arco.peso)}`}
                className="cursor-pointer outline-none transition-opacity duration-150 motion-reduce:transition-none"
                style={{ opacity: attivo && attivo !== arco.chiave ? 0.4 : 1 }}
                onMouseEnter={() => setAttivo(arco.chiave)}
                onMouseLeave={() => setAttivo(null)}
                onFocus={() => setAttivo(arco.chiave)}
                onBlur={() => setAttivo(null)}
              />
              {arco.quota >= QUOTA_MINIMA_ETICHETTA_DIRETTA && (
                <text
                  x={
                    puntoSuCerchio(
                      raggioEsterno,
                      raggioEsterno,
                      (raggioEsterno + raggioInterno) / 2,
                      (arco.inizio + arco.fine) / 2,
                    ).x
                  }
                  y={
                    puntoSuCerchio(
                      raggioEsterno,
                      raggioEsterno,
                      (raggioEsterno + raggioInterno) / 2,
                      (arco.inizio + arco.fine) / 2,
                    ).y
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  aria-hidden
                  className="pointer-events-none select-none font-ui text-[9px] font-medium"
                  // `on-accent` è tarato per un riempimento pieno: sotto
                  // un certo passo della rampa il lavaggio è troppo
                  // chiaro perché un testo chiaro ci si legga sopra
                  // (dataviz skill: il colore del testo segue la
                  // luminanza effettiva del riempimento, non la sua tinta
                  // nominale). Soglia empirica sulla stessa opacità che
                  // già governa il riempimento, non un calcolo di
                  // contrasto vero: `ink` è comunque sicuro su qualunque
                  // lavaggio chiaro.
                  fill={
                    arco.neutro
                      ? "var(--mtg-ink-soft)"
                      : arco.opacita >= 0.55
                        ? "var(--mtg-on-accent)"
                        : "var(--mtg-ink)"
                  }
                >
                  {Math.round(arco.quota * 100)}%
                </text>
              )}
            </g>
          ))}
        </svg>

        <ul className="flex w-full min-w-0 flex-col gap-1.5" id={idLegenda}>
          {righeEspanse.map((riga) => (
            <li
              key={riga.chiave}
              className={`flex items-center gap-2.5 rounded-object px-1.5 py-1 transition-colors duration-150 motion-reduce:transition-none ${
                attivo === riga.chiave ? "bg-surface-2" : ""
              }`}
              onMouseEnter={() => setAttivo(riga.chiave)}
              onMouseLeave={() => setAttivo(null)}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: riga.neutro ? "var(--mtg-surface-2)" : "var(--mtg-accent-strong)",
                  opacity: riga.neutro ? 1 : riga.opacita,
                  boxShadow: riga.neutro ? "inset 0 0 0 1px var(--mtg-line-strong)" : undefined,
                }}
              />
              <span className="min-w-0 flex-1 truncate font-ui text-sm text-ink" title={riga.nome}>
                {riga.nome}
              </span>
              <span className="t-num t-meta shrink-0">{formattaPeso(riga.peso)}</span>
            </li>
          ))}
        </ul>
      </div>

      {restanti.length > 0 && (
        <button
          type="button"
          onClick={() => setEspansa((v) => !v)}
          className="t-meta mt-3 underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {espansa ? "mostra meno" : "mostra tutte"}
        </button>
      )}
      <p className="t-meta mt-3 border-t border-line pt-3">
        Il peso di un libro con più generi si ripartisce tra loro, come per gli autori — la
        ciambella misura il peso, non il numero di libri.
      </p>
    </div>
  );
}
