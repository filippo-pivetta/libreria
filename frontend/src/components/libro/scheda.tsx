"use client";

import { useQuery } from "@tanstack/react-query";

import { getVoceDettaglio, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { nomiAutori } from "@/lib/autori";
import { formattaLingua } from "@/lib/formato";
import { RIBBON } from "@/lib/ribbon";
import { coloreDorso } from "@/lib/spine-color";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { TransizioniStato } from "@/components/libro/transizioni-stato";
import { SegnalibroAvanzamento } from "@/components/libro/segnalibro-avanzamento";
import { CorreggiPagine } from "@/components/libro/correggi-pagine";
import { StoricoLetture } from "@/components/libro/storico-letture";
import { VotoStelle } from "@/components/libro/voto-stelle";
import { NotaIntenzione } from "@/components/libro/nota-intenzione";

const ETICHETTA_STATO: Record<string, string> = {
  da_leggere: "Da leggere",
  in_lettura: "In lettura",
  in_pausa: "In pausa",
  letto: "Letto",
  abbandonato: "Abbandonato",
};

/**
 * Volume aperto, due pagine (design doc §9). A sinistra l'opera, dato
 * condiviso — titolo, autori, anno, lingua, e le pagine della TUA copia
 * (unico dato bibliografico che l'Utente può correggere, quindi sta coi
 * fatti dell'opera e non nel pannello dell'avanzamento). A destra la tua
 * copia: stato, registrazione dell'avanzamento, transizioni, voto,
 * nota di intenzione, storico. Niente generi: l'elenco non è ancora
 * popolato fuori banda. Niente recensione/insight: issue #5, non
 * costruita.
 *
 * Nel contesto di un collegato (`isOwner === false`) la pagina destra
 * perde ogni superficie di scrittura — nessun pannello, nessuna
 * transizione, nessuna nota — e la barra di avanzamento diventa un
 * riquadro di sola lettura, non l'oggetto trascinabile.
 */
export function Scheda({
  voceIniziale,
  currentUserId,
}: {
  voceIniziale: VoceDettaglio;
  currentUserId: string;
}) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["voce", voceIniziale.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getVoceDettaglio(token, voceIniziale.id);
      if (result.status !== "ok") {
        throw new Error(result.status === "not_found" ? "Voce non trovata." : result.message);
      }
      return result.data;
    },
    initialData: voceIniziale,
  });

  if (isPending) {
    return <LoadingState label="Caricamento del libro…" />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Impossibile caricare il libro."}
        onRetry={() => void refetch()}
      />
    );
  }

  const letturaAperta = data.letture.find((lettura) => lettura.dataFine === null) ?? null;
  const paginaSalvata = letturaAperta ? (letturaAperta.avanzamenti.at(-1)?.pagina ?? 0) : 0;
  const percentualeSalvata =
    data.pagineAdottate && letturaAperta
      ? Math.min(100, Math.round((paginaSalvata / data.pagineAdottate) * 100))
      : null;
  const ribbon = RIBBON[data.stato];
  const autori = nomiAutori(data.libro.autori);
  const colore = coloreDorso(data.libro.id);
  // È il libro di un collegato, non il mio (issue #3): nessun controllo
  // di scrittura, nessuna traccia di dove sarebbero (design doc §15).
  // `data-guest` attiva l'attenuazione già pronta in tokens.css.
  const isOwner = data.utenteId === currentUserId;

  return (
    // Le due pagine, separate da un vuoto di 2px sul piano 0 (design doc
    // §9). Stesso ordine su ogni breakpoint: l'opera prima (sopra su
    // mobile, a sinistra da tablet in su), la copia dopo.
    <div
      className="flex flex-col gap-0.5 md:flex-row"
      {...(!isOwner ? { "data-guest": "" } : {})}
    >
      <section className="plane-1 pagina-opera grain min-h-[420px] flex-1 p-6 md:min-h-[640px]">
        <div
          className="cover mb-4 flex h-48 w-32 items-center justify-center p-3 text-center"
          style={{ backgroundColor: colore }}
        >
          <p className="font-display text-base leading-snug text-on-accent">
            {data.libro.titoloCanonico}
          </p>
        </div>
        <p className="t-title text-2xl">{data.libro.titoloCanonico}</p>
        {autori && <p className="t-meta mt-1">{autori}</p>}

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-b border-line pb-4">
          <div>
            <p className="t-label">Prima pubblicazione</p>
            <p className="mt-0.5 font-ui text-sm text-ink">
              {data.libro.annoPrimaPubblicazione ?? "Sconosciuta"}
            </p>
          </div>
          {data.libro.linguaOriginale && (
            <div>
              <p className="t-label">Lingua originale</p>
              <p className="mt-0.5 font-ui text-sm text-ink">
                {formattaLingua(data.libro.linguaOriginale)}
              </p>
            </div>
          )}
          {isOwner && (
            <div>
              <p className="t-label">Pagine</p>
              <CorreggiPagine voceId={data.id} pagineAdottate={data.pagineAdottate} />
            </div>
          )}
        </div>
      </section>

      <section className="plane-1 pagina-copia grain relative min-h-[420px] flex-1 p-6 md:min-h-[640px]">
        {ribbon && (
          // Altezza fissa e corta, indipendente dallo stato: sulla
          // scheda c'è un nastro solo (nessun bisogno di differenziare
          // la lunghezza per riconoscerlo fra tanti, come sullo
          // scaffale), e deve stare sopra la barra di avanzamento
          // sotto, mai attraversarla.
          <span
            aria-hidden
            className={`absolute top-0 right-6 w-3 rounded-b-sm ${ribbon.colorClass} ${ribbon.accessibileClass}`}
            style={{ height: "22px" }}
          />
        )}

        <p className="t-label mb-4">{ETICHETTA_STATO[data.stato]}</p>

        {isOwner && data.stato === "in_lettura" ? (
          letturaAperta && (
            <SegnalibroAvanzamento
              voceId={data.id}
              lettura={letturaAperta}
              pagineAdottate={data.pagineAdottate}
            />
          )
        ) : (
          // In pausa (proprio) o libro di un collegato: sola lettura,
          // niente campo, niente data, niente "Salva" — in pausa non si
          // registra un avanzamento, si riprende prima (design doc §9).
          letturaAperta &&
          data.pagineAdottate !== null &&
          percentualeSalvata !== null && (
            <div className="mb-5 max-w-[calc(100%-2.5rem)]">
              <div className="relative h-1.5 w-full overflow-hidden rounded-object bg-surface-2">
                <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${percentualeSalvata}%` }} />
              </div>
              <p className="t-meta t-num mt-1">
                {paginaSalvata} di {data.pagineAdottate} pagine
              </p>
            </div>
          )
        )}

        {isOwner && <TransizioniStato voce={data} />}

        <div className="mt-5">
          <VotoStelle voceId={data.id} voto={data.voto} isOwner={isOwner} />
        </div>

        {isOwner && <NotaIntenzione voceId={data.id} notaIntenzione={data.notaIntenzione} />}

        <StoricoLetture voceId={data.id} letture={data.letture} isOwner={isOwner} />
      </section>
    </div>
  );
}
