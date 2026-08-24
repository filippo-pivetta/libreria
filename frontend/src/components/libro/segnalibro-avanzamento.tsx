"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registraAvanzamento, type Avanzamento } from "@/lib/api/avanzamenti";
import { getAccessToken } from "@/lib/api/access-token";
import type { Lettura, VoceDettaglio } from "@/lib/api/voci";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { IconaCalendario } from "@/components/ui/icone";
import { useTranslations } from "next-intl";

const MESSAGGI_ERRORE: Record<string, string> = {
  avanzamento_data_futura: "La data non può essere nel futuro.",
  avanzamento_data_regressiva: "La data precede l’ultimo avanzamento registrato.",
  avanzamento_pagina_regressiva: "La pagina è inferiore a quella già raggiunta.",
  avanzamento_pagina_supera_successivo: "La pagina supera un avanzamento successivo.",
  avanzamento_data_supera_successivo: "La data supera un avanzamento successivo.",
  avanzamento_oltre_pagine_adottate: "La pagina supera le pagine adottate per questa copia.",
};

type ContestoOttimistico = { precedente: VoceDettaglio | undefined };
type ValoriAvanzamento = { pagina: number; data: string };

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registrazione dell'avanzamento (design doc §12): segnalibro
 * trascinabile sulla barra + campo numerico, accoppiati — si trascina
 * per avvicinarsi, si digita per precisare. Il pavimento (l'ultimo
 * avanzamento) è un muro fisico per il trascinamento e la tastiera; il
 * campo numerico non lo impone mentre si sta ancora digitando le cifre,
 * solo alla perdita del focus — evita di combattere con l'utente a metà
 * digitazione. Il tetto (pagine adottate), se c'è, si applica sempre,
 * anche mentre si digita: "oltre il totale si corregge subito".
 *
 * Senza pagine adottate: sparisce la barra (non c'è una frazione da
 * disegnare), resta solo il campo numerico con incremento.
 */
export function SegnalibroAvanzamento({
  voceId,
  lettura,
  pagineAdottate,
}: {
  voceId: string;
  lettura: Lettura;
  pagineAdottate: number | null;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const t = useTranslations();
  const ultimo = lettura.avanzamenti.at(-1);
  const minimo = ultimo?.pagina ?? 0;
  const dataMinima = ultimo?.data ?? lettura.dataInizio;
  const massimo = pagineAdottate;

  const [testoPagina, setTestoPagina] = useState(String(minimo));
  const [data, setData] = useState(oggiISO);
  const trackRef = useRef<HTMLDivElement>(null);
  const trascinandoRef = useRef(false);

  function clamp(valoreGrezzo: number): number {
    const alto = massimo ?? Infinity;
    return Math.min(alto, Math.max(minimo, Math.round(valoreGrezzo)));
  }

  const valoreDigitato = Number(testoPagina);
  const paginaDigitata = Number.isFinite(valoreDigitato) ? valoreDigitato : minimo;
  const paginaFinale = clamp(paginaDigitata);

  function impostaPagina(valore: number) {
    setTestoPagina(String(clamp(valore)));
  }

  function daPosizioneX(clientX: number) {
    if (massimo === null) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const frazione = (clientX - rect.left) / rect.width;
    impostaPagina(frazione * massimo);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (massimo === null) return;
    trascinandoRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    daPosizioneX(event.clientX);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (trascinandoRef.current) daPosizioneX(event.clientX);
    }
    function onUp() {
      trascinandoRef.current = false;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimo, massimo]);

  function onKeyDownSegnalibro(event: KeyboardEvent) {
    const passo = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      impostaPagina(paginaFinale + passo);
      event.preventDefault();
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      impostaPagina(paginaFinale - passo);
      event.preventDefault();
    }
    if (event.key === "Home") {
      impostaPagina(minimo);
      event.preventDefault();
    }
    if (event.key === "End" && massimo !== null) {
      impostaPagina(massimo);
      event.preventDefault();
    }
  }

  const mutazione = useMutation<Avanzamento, Error, ValoriAvanzamento, ContestoOttimistico>({
    mutationFn: async ({ pagina, data: dataScelta }) => {
      const token = await getAccessToken();
      const result = await registraAvanzamento(token, lettura.id, pagina, dataScelta);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "non_valido"
            ? (MESSAGGI_ERRORE[result.errorCode] ?? result.message)
            : result.status === "not_found"
              ? t("assenze.letturaSparita")
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    onMutate: async ({ pagina, data: dataScelta }) => {
      await queryClient.cancelQueries({ queryKey: ["voce", voceId] });
      const precedente = queryClient.getQueryData<VoceDettaglio>(["voce", voceId]);

      queryClient.setQueryData<VoceDettaglio>(["voce", voceId], (voce) => {
        if (!voce) return voce;
        return {
          ...voce,
          letture: voce.letture.map((l) =>
            l.id === lettura.id
              ? {
                  ...l,
                  avanzamenti: [
                    ...l.avanzamenti,
                    {
                      id: `ottimistico-${Date.now()}`,
                      pagina,
                      data: dataScelta,
                      generatoAutomaticamente: false,
                    },
                  ],
                }
              : l,
          ),
        };
      });

      return { precedente };
    },
    onError: (error, _valori, context) => {
      if (context?.precedente) {
        queryClient.setQueryData(["voce", voceId], context.precedente);
      }
      showError(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutazione.mutate({ pagina: paginaFinale, data });
  }

  const percentoAvuto = massimo ? Math.min(100, (minimo / massimo) * 100) : 0;
  const percentoOra = massimo ? Math.min(100, (paginaFinale / massimo) * 100) : 0;
  const incremento = paginaFinale - minimo;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-baseline justify-between gap-4">
        <span className="t-section">Il segnalibro</span>
        <span className="t-meta t-num">
          {massimo !== null ? `${Math.round((paginaFinale / massimo) * 100)}\u2009%` : "\u00a0"}
        </span>
      </div>

      {/* Il numero è il dato, quindi è grande e ci si scrive dentro. Prima
          era un campo di 96px a corpo 30 sotto l'etichetta "Pagina
          raggiunta" in `t-meta`: il valore e la sua etichetta pesavano
          quanto la data accanto e quanto il bottone accanto ancora. Qui la
          pagina è la cosa, e "di 712" è solo la scala. */}
      <div className="mt-4 flex items-baseline gap-3">
        <input
          id="pagina-avanzamento"
          type="number"
          inputMode="numeric"
          aria-label="Pagina raggiunta"
          value={testoPagina}
          onChange={(event) => {
            const testo = event.target.value;
            const valore = Number(testo);
            if (massimo !== null && Number.isFinite(valore) && valore > massimo) {
              setTestoPagina(String(massimo));
            } else {
              setTestoPagina(testo);
            }
          }}
          onBlur={() => setTestoPagina(String(clamp(paginaDigitata)))}
          className="field-line min-w-[2.5ch] border-0 border-b border-line-strong bg-transparent px-0 font-display text-5xl leading-none font-light tracking-tight tabular-nums text-ink outline-none"
          style={{ width: `${Math.max(2.5, testoPagina.length + 0.6)}ch` }}
        />
        {massimo !== null && <span className="t-body text-base text-ink-soft">di {massimo}</span>}
      </div>

      {massimo !== null && (
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          className="relative mt-5 h-2.5 touch-none rounded-full bg-ink/10"
        >
          {/* Quanto era già salvato, in accento smorzato. */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-accent/40"
            style={{ width: `${percentoAvuto}%` }}
          />
          {/* Quanto stai aggiungendo ORA, in accento pieno: è la sola parte
              della barra che cambia mentre trascini, quindi è la sola che
              deve essere satura. */}
          <span
            aria-hidden
            className="absolute inset-y-0 bg-accent"
            style={{ left: `${percentoAvuto}%`, width: `${Math.max(percentoOra - percentoAvuto, 0)}%` }}
          />
          <span
            aria-hidden
            className="absolute top-[-4px] bottom-[-4px] w-[1.5px] bg-line-strong"
            style={{ left: `${percentoAvuto}%` }}
          />
          <button
            type="button"
            role="slider"
            aria-label="Pagina raggiunta"
            aria-valuemin={minimo}
            aria-valuemax={massimo}
            aria-valuenow={paginaFinale}
            aria-valuetext={`pagina ${paginaFinale} di ${massimo}`}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDownSegnalibro}
            className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-surface-1 bg-accent shadow-plane-2 active:cursor-grabbing"
            style={{ left: `${percentoOra}%` }}
          />
        </div>
      )}

      <p className="t-meta mt-3">
        {incremento > 0 ? (
          <>
            {minimo > 0 && `Eri a ${minimo}. `}
            <span className="font-medium text-ink">
              {incremento === 1 ? "1 pagina da salvare." : `${incremento} pagine da salvare.`}
            </span>
          </>
        ) : massimo !== null ? (
          "Trascina il segnalibro o scrivi il numero."
        ) : (
          "Scrivi il numero della pagina."
        )}
      </p>

      {/* Una sola azione piena in tutta la zona, e a 44px anche col mouse.
          Prima era `size="sm"` — 28px, corpo 12,8 — esattamente come i
          quattro comandi di cambio stato sotto, uno dei quali annulla la
          lettura in corso. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={mutazione.isPending || incremento <= 0}>
          Segna la pagina
        </Button>
        <span className="inline-flex items-center gap-2 rounded-field border border-line-strong bg-surface-1 px-3 text-ink">
          <IconaCalendario className="size-[1.0625rem] shrink-0 text-ink-soft" />
          <CampoData
            ariaLabel="Data dell’avanzamento"
            value={data}
            min={dataMinima}
            max={oggiISO()}
            onChange={setData}
          />
        </span>
      </div>
    </form>
  );
}
