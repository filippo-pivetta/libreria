"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancellaInsight,
  creaInsight,
  rivelaInsightTesto,
  type InsightEssenziale,
  type Visibilita,
} from "@/lib/api/insight";
import type { Lettura } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaData } from "@/lib/formato";
import { useToast } from "@/providers/toast-provider";

// Soglia tra i due trattamenti tipografici (design doc §10): sotto,
// "Sentenza" (opsz 32, senza troncamento); sopra, "Appunto" (opsz 12,
// troncato a otto righe con "mostra tutto").
const SOGLIA_SENTENZA = 200;

function UnSoloInsight({
  voceId,
  insight,
  isOwner,
}: {
  voceId: string;
  insight: InsightEssenziale;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [testoRivelato, setTestoRivelato] = useState<string | null>(null);
  const [espansa, setEspansa] = useState(false);

  const mutazioneRivela = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await rivelaInsightTesto(token, insight.id);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? "Questo insight non esiste più." : result.message,
        );
      }
      return result.testo;
    },
    onSuccess: (testo) => setTestoRivelato(testo),
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile scoprire il testo.",
      );
    },
  });

  const mutazioneCancella = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaInsight(token, insight.id);
      if (result.status !== "ok" && result.status !== "not_found") {
        throw new Error(result.message);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["voce", voceId] }),
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile cancellare l'insight.",
      );
    },
  });

  // Tagliata finché lo spoiler è acceso e nessuno ha ancora chiesto di
  // scoprirlo in questa sessione (design doc §11: "il server manda solo
  // il fatto che esiste, il gesto di scoprire fa una richiesta"). Vale
  // identico sui propri insight quanto su quelli di un collegato — non è
  // un permesso, è un avviso.
  const tagliata = insight.spoiler && testoRivelato === null;
  const testo = testoRivelato ?? insight.testo ?? "";
  const isAppunto = testo.length > SOGLIA_SENTENZA;

  return (
    <div className="relative px-4 py-3">
      {tagliata ? (
        <button
          type="button"
          disabled={mutazioneRivela.isPending}
          onClick={() => mutazioneRivela.mutate()}
          className="t-meta w-full py-3 text-left text-ink-soft underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Taglia per leggere
        </button>
      ) : (
        <>
          <p className={isAppunto ? "t-appunto" : "t-sentenza"} data-clamped={isAppunto && !espansa ? "" : undefined}>
            {testo}
          </p>
          {isAppunto && !espansa && (
            <button
              type="button"
              onClick={() => setEspansa(true)}
              className="t-meta mt-1 underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Mostra tutto
            </button>
          )}
          <p className="t-meta mt-2">{formattaData(insight.data)}</p>
        </>
      )}
      {isOwner && (
        <button
          type="button"
          onClick={() => mutazioneCancella.mutate()}
          aria-label="Cancella l'insight"
          className="t-meta absolute top-2 right-2 text-ink-soft hover:text-ink"
        >
          ⋯
        </button>
      )}
    </div>
  );
}

function GruppoInsight({
  voceId,
  titolo,
  insightList,
  isOwner,
  indice,
}: {
  voceId: string;
  titolo: string | null;
  insightList: InsightEssenziale[];
  isOwner: boolean;
  indice: number;
}) {
  if (insightList.length === 0) return null;

  // Le letture più vecchie stanno su una carta di luminanza appena più
  // vicina al fondo (design doc §10): una miscela continua verso
  // surface-0 invece di un piano nuovo — "tre piani soli" resta valido,
  // questa è una variazione dentro plane-1, non un piano 3.
  const percentualeSurface1 = Math.max(70, 100 - indice * 10);

  return (
    <div
      className="overflow-hidden rounded-card"
      style={{
        backgroundColor: `color-mix(in oklab, var(--mtg-surface-1) ${percentualeSurface1}%, var(--mtg-surface-0))`,
      }}
    >
      {titolo && <p className="t-label px-4 pt-3 pb-1">{titolo}</p>}
      <div className="divide-y divide-line">
        {insightList.map((insight) => (
          <UnSoloInsight key={insight.id} voceId={voceId} insight={insight} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}

function InsightForm({ voceId }: { voceId: string }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [visibilita, setVisibilita] = useState<Visibilita>("condiviso");

  const mutazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await creaInsight(token, voceId, testo.trim(), spoiler, visibilita);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? "Questa voce non esiste più." : result.message,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      setTesto("");
      setSpoiler(false);
      setVisibilita("condiviso");
      setAperto(false);
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : "Non è stato possibile salvare l'insight.");
    },
  });

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="t-meta self-start underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        Scrivi un insight
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface-2 p-4">
      <textarea
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        rows={4}
        placeholder="Cosa ti ha colpito?"
        className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSpoiler((valore) => !valore)}
            className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {spoiler ? "Contrassegnato spoiler" : "Segna come spoiler"}
          </button>
          <button
            type="button"
            onClick={() => setVisibilita((valore) => (valore === "condiviso" ? "privato" : "condiviso"))}
            className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {visibilita === "condiviso" ? "Condiviso con i collegati" : "Privato, solo tuo"}
          </button>
        </div>
        <button
          type="button"
          disabled={testo.trim() === "" || mutazione.isPending}
          onClick={() => mutazione.mutate()}
          className="t-meta text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink disabled:opacity-40"
        >
          Salva
        </button>
      </div>
    </div>
  );
}

/**
 * Insight raggruppati per Lettura (design doc §10, "come impone il PRD,
 * che lega ogni insight alla lettura in cui è nato"). Sta a piena
 * larghezza sotto le due pagine (§9, "Sotto le due pagine"), non nella
 * colonna stretta della copia. Solo dentro la scheda del libro: nessuna
 * vista trasversale (rinviata).
 */
export function InsightLista({
  voceId,
  letture,
  insightSenzaLettura,
  isOwner,
}: {
  voceId: string;
  letture: Lettura[];
  insightSenzaLettura: InsightEssenziale[];
  isOwner: boolean;
}) {
  const totale =
    insightSenzaLettura.length + letture.reduce((somma, lettura) => somma + lettura.insight.length, 0);
  if (totale === 0 && !isOwner) return null;

  const offsetIndice = insightSenzaLettura.length > 0 ? 1 : 0;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <p className="t-label">Insight</p>
      {isOwner && <InsightForm voceId={voceId} />}
      {insightSenzaLettura.length > 0 && (
        <GruppoInsight
          voceId={voceId}
          titolo={null}
          insightList={insightSenzaLettura}
          isOwner={isOwner}
          indice={0}
        />
      )}
      {letture.map((lettura, indice) => (
        <GruppoInsight
          key={lettura.id}
          voceId={voceId}
          titolo={
            formattaData(lettura.dataInizio) +
            (lettura.dataFine ? ` – ${formattaData(lettura.dataFine)}` : " – in corso")
          }
          insightList={lettura.insight}
          isOwner={isOwner}
          indice={indice + offsetIndice}
        />
      ))}
    </div>
  );
}
