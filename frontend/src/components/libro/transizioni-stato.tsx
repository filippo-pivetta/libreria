"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cambiaStato, type StatoVoce, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { useTranslations } from "next-intl";

type Transizione = { stato: StatoVoce; etichetta: string; chiedeData?: boolean };

/**
 * Rispecchia esattamente la matrice validata da `cambia_stato_voce`
 * (supabase/migrations/20260820065144_ciclo_di_lettura.sql, docs/adr/0015):
 * "l'interfaccia non offre mai una transizione vietata, invece di
 * offrirla e poi rifiutarla" (design doc §9). Se la matrice della RPC
 * cambia, questa tabella va aggiornata insieme.
 */
const TRANSIZIONI: Record<StatoVoce, Transizione[]> = {
  // `chiedeData`: il PRD lo impone esplicitamente ("entrambe le date sono
  // scelte dall'Utente, con il giorno corrente come predefinito: è ciò
  // che permette di registrare letture concluse prima di usare l'app").
  // Senza, la data di inizio resterebbe sempre oggi, e con essa il
  // minimo selezionabile per ogni avanzamento — impedendo di fatto di
  // registrare una lettura già cominciata in passato.
  da_leggere: [{ stato: "in_lettura", etichetta: "Inizia a leggere", chiedeData: true }],
  in_lettura: [
    { stato: "in_pausa", etichetta: "Metti in pausa" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  in_pausa: [
    { stato: "in_lettura", etichetta: "Riprendi" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  letto: [
    { stato: "in_lettura", etichetta: "Rileggi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
  abbandonato: [
    { stato: "in_lettura", etichetta: "Riprendi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
};

// Le due azioni frequenti restano sempre in vista, in contorno (mai
// piene: l'unica azione piena della pagina è "Salva" dell'avanzamento).
// Tutte le altre — comprese quelle che annullano una lettura — stanno
// sotto "Altro", in tono piano: design doc §9, punto 1, correzione del
// 20 agosto 2026 ("oggi quattro comandi hanno lo stesso peso e uno di
// essi cancella la lettura in corso"). Gli stati con due sole transizioni
// non hanno bisogno del menù: nascondere l'unica alternativa non
// semplifica nulla.
const FREQUENTI: Partial<Record<StatoVoce, StatoVoce[]>> = {
  in_lettura: ["in_pausa", "letto"],
  in_pausa: ["in_lettura", "letto"],
};

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransizioniStato({ voce }: { voce: VoceDettaglio }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const t = useTranslations();
  const [pendente, setPendente] = useState<Transizione | null>(null);
  const [data, setData] = useState<string>(oggiISO);
  const altroRef = useRef<HTMLDetailsElement>(null);
  const chiusuraAltroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chiusura ritardata (non al primo mouseleave): fra "Altro" e il menù
  // sotto c'è comunque un attimo di movimento diagonale del mouse, e un
  // ritardo breve lo assorbe senza dover ricliccare (design doc §9).
  function programmaChiusuraAltro() {
    chiusuraAltroTimer.current = setTimeout(() => {
      if (altroRef.current) altroRef.current.open = false;
    }, 350);
  }
  function annullaChiusuraAltro() {
    if (chiusuraAltroTimer.current) {
      clearTimeout(chiusuraAltroTimer.current);
      chiusuraAltroTimer.current = null;
    }
  }

  const mutazione = useMutation({
    mutationFn: async ({ stato, conData }: { stato: StatoVoce; conData?: string }) => {
      const token = await getAccessToken();
      const result = await cambiaStato(token, voce.id, stato, conData);
      if (result.status !== "ok") {
        const messaggio =
          result.status === "conflitto"
            ? result.message
            : result.status === "not_found"
              ? t("assenze.voceSparita")
              : result.message;
        throw new Error(messaggio);
      }
      return result.data;
    },
    onSuccess: () => {
      setPendente(null);
      void queryClient.invalidateQueries({ queryKey: ["voce", voce.id] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : t("errori.statoNonCambiato"));
    },
  });

  const opzioni = TRANSIZIONI[voce.stato];
  if (opzioni.length === 0) return null;

  const nomiFrequenti = FREQUENTI[voce.stato];
  const frequenti = nomiFrequenti
    ? opzioni.filter((o) => nomiFrequenti.includes(o.stato))
    : opzioni;
  const altre = nomiFrequenti ? opzioni.filter((o) => !nomiFrequenti.includes(o.stato)) : [];

  function avvia(opzione: Transizione) {
    if (altroRef.current) altroRef.current.open = false;
    if (opzione.chiedeData) {
      setData(oggiISO());
      setPendente(opzione);
    } else {
      mutazione.mutate({ stato: opzione.stato });
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {frequenti.map((opzione) => (
          <Button
            key={opzione.stato}
            variant="outline"
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => avvia(opzione)}
          >
            {opzione.etichetta}
          </Button>
        ))}

        {altre.length > 0 && (
          <details
            ref={altroRef}
            className="relative"
            onMouseEnter={annullaChiusuraAltro}
            onMouseLeave={programmaChiusuraAltro}
          >
            <summary className="t-meta inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-field px-2.5 text-ink-soft hover:bg-surface-2 hover:text-ink">
              Altro
              <span aria-hidden className="text-[9px]">
                ▾
              </span>
            </summary>
            {/* `pt-1.5` invece di un margine sul riquadro sotto: il
                riquadro comincia subito a `top-full`, senza spazio morto
                fra "Altro" e il menù dove il mouse potrebbe "uscire" dal
                `<details>` a metà del movimento. */}
            <div className="absolute top-full left-0 z-10 pt-1.5">
              <div className="flex min-w-44 flex-col gap-0.5 rounded-field border border-line bg-surface-1 p-1.5 shadow-plane-2">
                {altre.map((opzione) => (
                  <button
                    key={opzione.stato}
                    type="button"
                    disabled={mutazione.isPending}
                    onClick={() => avvia(opzione)}
                    className="rounded-object px-3 py-2 text-left font-ui text-sm text-ink hover:bg-surface-2"
                  >
                    {opzione.etichetta}
                  </button>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      {pendente && (
        <div className="flex flex-wrap items-center gap-2">
          <CampoData
            id="data-transizione"
            ariaLabel="Data"
            value={data}
            max={oggiISO()}
            onChange={setData}
          />
          <Button
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => mutazione.mutate({ stato: pendente.stato, conData: data })}
          >
            Conferma
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendente(null)}>
            Annulla
          </Button>
        </div>
      )}
    </div>
  );
}
