"use client";

import type { VoceDettaglio } from "@/lib/api/voci";
import { nomiAutori } from "@/lib/autori";
import { formattaData } from "@/lib/formato";
import { coloreDorso } from "@/lib/spine-color";
import { PastigliaStato } from "@/components/ui/pastiglia-stato";
import { useLocale } from "next-intl";

/**
 * La zona 1 della scheda: **che cos'è, e che cos'è per te**.
 *
 * Prima non c'era una testata. La copertina stava in cima alla colonna di
 * sinistra a 128×192, con il titolo SOTTO in `t-title` a corpo 24 — cioè
 * un'intestazione impilata dentro una delle due colonne, non sopra la
 * pagina. Su mobile, dove le colonne si sovrappongono, questo significava
 * scorrere copertina, titolo, autori, tre dati bibliografici, le
 * pastiglie dei generi e la descrizione INTERA prima di arrivare alla
 * propria copia: cioè prima della ragione per cui la pagina era stata
 * aperta.
 *
 * Qui la copertina sta ACCANTO al titolo su ogni schermo, e la riga sotto
 * il nome dell'autore non ripete i dati dell'opera (quelli vivono nella
 * colonna laterale) ma racconta la tua storia con questo libro: è
 * l'unica cosa, in cima, che non si trova già da nessun'altra parte.
 */
export function TestataLibro({ voce, isOwner }: { voce: VoceDettaglio; isOwner: boolean }) {
  const lingua = useLocale();
  const autori = nomiAutori(voce.libro.autori);
  const colore = coloreDorso(voce.libro.id);
  const prima = voce.letture[0] ?? null;
  const numeroInsight =
    voce.insightSenzaLettura.length +
    voce.letture.reduce((somma, lettura) => somma + lettura.insight.length, 0);

  const cronaca: string[] = [];
  if (prima) {
    cronaca.push(`Cominciato il ${formattaData(prima.dataInizio, lingua)}`);
    if (voce.letture.length > 1) {
      cronaca.push(voce.letture.length === 2 ? "riletto una volta" : `${voce.letture.length} letture`);
    }
  }
  if (numeroInsight > 0) {
    cronaca.push(numeroInsight === 1 ? "1 insight" : `${numeroInsight} insight`);
  }

  return (
    <header className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-start gap-4 border-b border-line pb-6 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-7 sm:pb-8">
      <div className="cover aspect-[2/3] w-full" style={{ backgroundColor: colore }}>
        {voce.libro.copertinaGrandeUrl && (
          // <img> piano, non next/image: come sullo scaffale, il dominio
          // delle copertine è privato e firmato, non configurabile in
          // anticipo per l'ottimizzatore di Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={(elemento) => {
              if (elemento?.complete) elemento.setAttribute("data-loaded", "");
            }}
            src={voce.libro.copertinaGrandeUrl}
            alt=""
            decoding="async"
            onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <p className="cover__placeholder flex items-center justify-center p-3 text-center font-display text-sm leading-snug sm:text-base">
          {voce.libro.titoloCanonico}
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3.5 sm:pt-1">
        <PastigliaStato stato={voce.stato} />
        <h1 className="t-display text-[1.75rem] sm:text-[2.5rem] lg:text-[2.875rem]">
          {voce.libro.titoloCanonico}
        </h1>
        {autori && <p className="t-body text-ink-soft sm:text-[1.0625rem]">{autori}</p>}
        {isOwner && cronaca.length > 0 && (
          <p className="t-meta sm:mt-1.5">{cronaca.join(" · ")}</p>
        )}
      </div>
    </header>
  );
}
