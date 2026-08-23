"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registraAvanzamento, type Avanzamento } from "@/lib/api/avanzamenti";
import { getAccessToken } from "@/lib/api/access-token";
import type { Lettura, VoceDettaglio } from "@/lib/api/voci";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { ASSENZE } from "@/messaggi/it";

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
              ? ASSENZE.letturaSparita
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
    <form onSubmit={handleSubmit} className="mb-5 rounded-card border border-line bg-surface-2 p-5" noValidate>
      <p className="t-label mb-4">Registra un avanzamento</p>

      {massimo !== null && (
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          className="relative mb-4 h-3 touch-none rounded-full bg-ink/11"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-accent/40"
            style={{ width: `${percentoAvuto}%` }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{ left: `${percentoAvuto}%`, width: `${Math.max(percentoOra - percentoAvuto, 0)}%` }}
          />
          <span
            aria-hidden
            className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-line-strong"
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
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-surface-1 bg-accent shadow-plane-2 active:cursor-grabbing"
            style={{ left: `${percentoOra}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="t-meta" htmlFor="pagina-avanzamento">
            Pagina raggiunta
          </label>
          <div className="flex items-baseline gap-2">
            <input
              id="pagina-avanzamento"
              type="number"
              inputMode="numeric"
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
              className="field-line w-24 border-0 border-b border-line-strong bg-transparent px-0 font-ui text-3xl font-medium text-ink outline-none"
            />
            {massimo !== null && <span className="font-ui text-sm text-ink-soft">di {massimo}</span>}
          </div>
        </div>
        <CampoData
          ariaLabel="Data dell’avanzamento"
          value={data}
          min={dataMinima}
          max={oggiISO()}
          onChange={setData}
        />
        <Button type="submit" size="sm" disabled={mutazione.isPending}>
          Salva
        </Button>
      </div>

      <p className="t-meta t-num mt-3">
        {incremento > 0
          ? `Aggiungi ${incremento} pagine a quelle di questa lettura.`
          : "Trascina la barra o digita il numero."}
      </p>
    </form>
  );
}
