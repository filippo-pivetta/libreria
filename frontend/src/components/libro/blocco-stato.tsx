"use client";

import type { VoceDettaglio } from "@/lib/api/voci";
import { formattaData } from "@/lib/formato";
import { SegnalibroAvanzamento } from "@/components/libro/segnalibro-avanzamento";
import { TransizioniStato } from "@/components/libro/transizioni-stato";
import { useLocale } from "next-intl";

/**
 * La zona 2 della scheda: **dove sei**.
 *
 * Prima questa zona non esisteva come zona. La pagina destra apriva con
 * una `t-label` a corpo 10,5 che diceva lo stato, e sotto metteva in fila
 * otto cose senza rapporto fra loro: il modulo di avanzamento, quattro
 * transizioni, le stelle, la recensione, la nota, il parere e la
 * cancellazione. Su un libro "da leggere" o "letto" il modulo spariva e al
 * suo posto non veniva niente, quindi la parte alta della pagina restava
 * vuota proprio negli stati in cui c'è meno da fare e più da decidere.
 *
 * Qui c'è un blocco solo, sempre nello stesso posto, che cambia forma con
 * lo stato e porta **una sola azione piena**. Le transizioni scendono
 * sotto, fuori dalla carta: cambiare stato è una cosa che fai al libro,
 * non il libro che ti dice dove sei.
 *
 * Per il libro di un collegato tutto questo diventa un riquadro di sola
 * lettura: nessun segnalibro da afferrare, nessuna transizione, nessuna
 * traccia di dove sarebbero (§15).
 */
export function BloccoStato({
  voce,
  isOwner,
}: {
  voce: VoceDettaglio;
  isOwner: boolean;
}) {
  const lingua = useLocale();

  const letturaAperta = voce.letture.find((lettura) => lettura.dataFine === null) ?? null;
  const ultimaChiusa = [...voce.letture].reverse().find((lettura) => lettura.dataFine !== null) ?? null;
  const paginaSalvata = letturaAperta ? (letturaAperta.avanzamenti.at(-1)?.pagina ?? 0) : 0;
  const percentuale =
    voce.pagineAdottate && voce.pagineAdottate > 0
      ? Math.min(100, Math.round((paginaSalvata / voce.pagineAdottate) * 100))
      : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="plane-1 grain p-5 sm:p-6">
        {voce.stato === "in_lettura" && isOwner && letturaAperta ? (
          <SegnalibroAvanzamento
            voceId={voce.id}
            lettura={letturaAperta}
            pagineAdottate={voce.pagineAdottate}
          />
        ) : voce.stato === "da_leggere" ? (
          <Titolo
            testo="Non l’hai ancora cominciato"
            sotto={
              voce.pagineAdottate
                ? `${voce.pagineAdottate} pagine.`
                : "Nessun totale di pagine su questa copia."
            }
          />
        ) : voce.stato === "letto" && ultimaChiusa?.dataFine ? (
          <Titolo
            testo={`Finito il ${formattaData(ultimaChiusa.dataFine, lingua)}`}
            sotto={`Cominciato il ${formattaData(ultimaChiusa.dataInizio, lingua)}${
              voce.pagineAdottate ? `, ${voce.pagineAdottate} pagine` : ""
            }.`}
          />
        ) : voce.stato === "abbandonato" && ultimaChiusa?.dataFine ? (
          <>
            <Titolo
              testo={`Lasciato il ${formattaData(ultimaChiusa.dataFine, lingua)}`}
              sotto={
                voce.pagineAdottate && ultimaChiusa.avanzamenti.at(-1)
                  ? `Arrivato a pagina ${ultimaChiusa.avanzamenti.at(-1)!.pagina} di ${voce.pagineAdottate}.`
                  : `Cominciato il ${formattaData(ultimaChiusa.dataInizio, lingua)}.`
              }
            />
            {voce.pagineAdottate !== null && voce.pagineAdottate > 0 && ultimaChiusa.avanzamenti.at(-1) && (
              <Barra
                percentuale={Math.min(
                  100,
                  Math.round((ultimaChiusa.avanzamenti.at(-1)!.pagina / voce.pagineAdottate) * 100),
                )}
                spenta
              />
            )}
          </>
        ) : letturaAperta && percentuale !== null && voce.pagineAdottate ? (
          // In pausa, oppure la copia di un collegato: sola lettura. In
          // pausa non si registra un avanzamento, si riprende prima (§9).
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span className="t-section">{isOwner ? "Il segnalibro" : "A che punto è"}</span>
              <span className="t-meta t-num">{percentuale}&thinsp;%</span>
            </div>
            <p className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-5xl leading-none font-light tracking-tight tabular-nums text-ink">
                {paginaSalvata}
              </span>
              <span className="t-body text-base text-ink-soft">di {voce.pagineAdottate}</span>
            </p>
            <Barra percentuale={percentuale} spenta={voce.stato === "in_pausa"} />
            {voce.stato === "in_pausa" && (
              <p className="t-meta mt-3">In pausa non si registrano avanzamenti.</p>
            )}
          </>
        ) : (
          <Titolo
            testo={isOwner ? "Nessun avanzamento registrato" : "Non ha ancora segnato una pagina"}
            sotto={voce.pagineAdottate ? `${voce.pagineAdottate} pagine.` : undefined}
          />
        )}
      </section>

      {isOwner && <TransizioniStato voce={voce} />}
    </div>
  );
}

function Titolo({ testo, sotto }: { testo: string; sotto?: string }) {
  return (
    <>
      <p className="t-display text-2xl [--t-opsz:24] sm:text-[1.625rem] sm:[--t-opsz:26]">{testo}</p>
      {sotto && <p className="t-meta mt-2">{sotto}</p>}
    </>
  );
}

/** La barra di sola lettura. Alta 8px, non 1,5: era un filo, e un filo non
 * dice una frazione — la si legge solo perché accanto c'è il numero. */
function Barra({ percentuale, spenta }: { percentuale: number; spenta?: boolean }) {
  return (
    <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${spenta ? "bg-ink/30" : "bg-accent"}`}
        style={{ width: `${percentuale}%` }}
      />
    </div>
  );
}
