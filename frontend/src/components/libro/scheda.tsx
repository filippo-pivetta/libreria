"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getVoceDettaglio, type Lettura, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { nomiAutori } from "@/lib/autori";
import { formattaLingua } from "@/lib/formato";
import { RIBBON } from "@/lib/ribbon";
import { coloreDorso } from "@/lib/spine-color";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { TransizioniStato } from "@/components/libro/transizioni-stato";
import { PannelloAvanzamento } from "@/components/libro/pannello-avanzamento";
import { CorreggiPagine } from "@/components/libro/correggi-pagine";
import { StoricoLetture } from "@/components/libro/storico-letture";

const ETICHETTA_STATO: Record<string, string> = {
  da_leggere: "Da leggere",
  in_lettura: "In lettura",
  in_pausa: "In pausa",
  letto: "Letto",
  abbandonato: "Abbandonato",
};

function ultimaPagina(lettura: Lettura): number {
  return lettura.avanzamenti.at(-1)?.pagina ?? 0;
}

/**
 * Volume aperto, due pagine (design doc §9, corretta il 20 agosto 2026 su
 * otto punti — vedi i commenti sotto per ciascuno). L'opera (dato
 * condiviso, sola lettura in questa issue: titolo, autori, anno, lingua —
 * niente generi, l'elenco `genere` non è ancora popolato fuori banda) e
 * la propria copia (stato, nastro nella stessa posizione del dorso,
 * transizioni ammesse, pannello di registrazione dell'avanzamento,
 * correzione delle pagine adottate, storico delle Letture).
 *
 * Ancora mancanti sulla pagina destra — punto 7, fuori dal perimetro di
 * questa issue: voto in stelle, recensione, nota di intenzione, insight
 * raggruppati per lettura appartengono all'issue #5 ("Recensioni e
 * insight con regole di visibilità", non ancora costruita — il PRD lo
 * dice esplicitamente: "il voto è già un campo di voce_di_libreria,
 * esposto qui insieme al resto"). Lo spazio vuoto sotto le due pagine
 * resta per quello, non perché serva più aria.
 *
 * Ordine identico su ogni breakpoint (l'opera per prima nel markup):
 * a sinistra su desktop, sopra su mobile — nessuna inversione fra i due,
 * a differenza della prima stesura di questa schermata (design doc §8
 * proponeva "la copia sopra, l'opera sotto"; deviazione decisa in corso
 * d'opera, annotata lì). Nessun header separato sopra le due pagine: la
 * pagina dell'opera, in cima su mobile, mostra già copertina/titolo/
 * autore, un secondo riassunto sarebbe una ripetizione.
 *
 * `.pagina-opera`/`.pagina-copia` (tokens.css) fanno leggere le due
 * carte come un volume aperto su ogni breakpoint: angoli esterni
 * arrotondati, angoli interni verso la piega squadrati (orizzontale su
 * mobile, verticale da tablet in su). La piega centrale è il VUOTO di
 * 2px fra le carte (punto 6), non più un'ombra disegnata — rimossa.
 * `min-h` le porta a una lunghezza da pagina vera invece di stringersi
 * al contenuto.
 */
export function Scheda({ voceIniziale }: { voceIniziale: VoceDettaglio }) {
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

  const [correzionePagineAperta, setCorrezionePagineAperta] = useState(false);
  // Punto 8: "la barra di avanzamento è a due colori, quello che avevi in
  // ink-soft, quello che aggiungi adesso in accent". Riportato dal campo
  // numerico di PannelloAvanzamento (mai dal segnalibro trascinabile,
  // rimosso su richiesta esplicita): null finché non si tocca il campo.
  const [paginaInModifica, setPaginaInModifica] = useState<number | null>(null);

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
  const paginaSalvata = letturaAperta ? ultimaPagina(letturaAperta) : 0;
  const paginaMostrata = paginaInModifica ?? paginaSalvata;
  const percentualeSalvata =
    data.pagineAdottate && letturaAperta
      ? Math.min(100, Math.round((paginaSalvata / data.pagineAdottate) * 100))
      : null;
  const percentualeMostrata =
    data.pagineAdottate && letturaAperta
      ? Math.min(100, Math.round((paginaMostrata / data.pagineAdottate) * 100))
      : null;
  const ribbon = RIBBON[data.stato];
  const autori = nomiAutori(data.libro.autori);
  const colore = coloreDorso(data.libro.id);

  return (
    // Le due pagine, separate da un vuoto di 2px sul piano 0 (design doc
    // §9). Stesso ordine su ogni breakpoint: l'opera prima (sopra su
    // mobile, a sinistra da tablet in su), la copia dopo.
    <div className="flex flex-col gap-0.5 md:flex-row">
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
        <p className="t-meta mt-2">
          {data.libro.annoPrimaPubblicazione ?? "Anno sconosciuto"}
          {data.libro.linguaOriginale ? ` · ${formattaLingua(data.libro.linguaOriginale)}` : ""}
        </p>
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

        <p className="t-label">{ETICHETTA_STATO[data.stato]}</p>

        {letturaAperta && data.pagineAdottate !== null && percentualeSalvata !== null && (
          <div className="mt-3 max-w-[calc(100%-2.5rem)]">
            <div className="relative h-1.5 w-full overflow-hidden rounded-object bg-surface-2">
              <div className="absolute inset-y-0 left-0 bg-ink-soft/50" style={{ width: `${percentualeSalvata}%` }} />
              <div
                className="absolute inset-y-0 bg-accent transition-[width]"
                style={{
                  left: `${percentualeSalvata}%`,
                  width: `${Math.max((percentualeMostrata ?? percentualeSalvata) - percentualeSalvata, 0)}%`,
                }}
              />
            </div>
            <p className="t-meta t-num mt-1">
              {paginaMostrata} di {data.pagineAdottate} pagine
            </p>
          </div>
        )}

        <TransizioniStato voce={data} />

        {letturaAperta && (
          <PannelloAvanzamento
            voceId={data.id}
            lettura={letturaAperta}
            pagineAdottate={data.pagineAdottate}
            onPaginaChange={setPaginaInModifica}
          />
        )}

        {correzionePagineAperta ? (
          <CorreggiPagine
            voceId={data.id}
            pagineAdottate={data.pagineAdottate}
            onChiudi={() => setCorrezionePagineAperta(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCorrezionePagineAperta(true)}
            className="t-meta mt-3 self-start underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {data.pagineAdottate === null
              ? "Aggiungi le pagine totali"
              : "Correggi le pagine totali"}
          </button>
        )}

        <StoricoLetture voceId={data.id} letture={data.letture} />
      </section>
    </div>
  );
}
