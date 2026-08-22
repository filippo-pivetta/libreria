"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { aggiornaConsenso, type IndiciStato } from "@/lib/api/me";
import { getAccessToken } from "@/lib/api/access-token";
import { Switch } from "@/components/ui/switch";
import {
  AVVISO_VISIBILITA,
  EFFETTO_REVOCA,
  EFFETTO_RIATTIVAZIONE,
  NOTE_FUORI_DAL_CONSENSO,
  TESTO_CONSENSO,
} from "@/lib/testi-consenso";

const NOTA_CANCELLAZIONE =
  "La cancellazione dell'account arriva con la prossima issue.";

/**
 * Sezione impostazioni della Torre (design doc §17): l'avviso di
 * visibilità, il consenso all'elaborazione assistita, la cancellazione
 * dell'account — tre cose e basta, in quest'ordine. La terza dipende
 * dall'issue #8 e resta una nota.
 *
 * **Nessuna finestra di annullamento** come quella dei collegamenti,
 * benché spegnere il consenso cancelli davvero gli indici: interrompere
 * un collegamento non è simmetricamente reversibile (per tornare indietro
 * serve che l'altro accetti), mentre questo interruttore lo è del tutto —
 * riaccendendolo gli indici si ricostruiscono da soli. Un "annulla" su un
 * gesto reversibile è rumore, non prudenza.
 *
 * I due testi lunghi arrivano da `lib/testi-consenso.ts`: sono del PRD,
 * parola per parola, e il design doc vieta di riscriverli in forma più
 * breve o più simpatica.
 */
export function SezioneImpostazioni({
  consensoIniziale,
  indiciStatoIniziale,
}: {
  consensoIniziale: boolean;
  /** Stato reale letto da `/me`: senza questo la sezione poteva solo
   * indovinare "in ricostruzione" dal booleano del consenso, senza mai
   * sapere se una ricostruzione precedente fosse davvero finita. */
  indiciStatoIniziale: IndiciStato;
}) {
  const [consenso, setConsenso] = useState(consensoIniziale);
  const [indiciStato, setIndiciStato] = useState(indiciStatoIniziale);
  const [errore, setErrore] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async (valore: boolean) => {
      const token = await getAccessToken();
      const result = await aggiornaConsenso(token, valore);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_provisioned"
            ? "Il tuo account non risulta completato."
            : result.message,
        );
      }
      return result.data;
    },
    onMutate: (valore: boolean) => {
      // Ottimistico: l'interruttore si muove subito, come ogni comando
      // dell'app, e torna indietro da solo se la scrittura non riesce.
      setErrore(null);
      setConsenso(valore);
    },
    onSuccess: (me) => {
      setConsenso(me.consensoElaborazioneAssistita);
      setIndiciStato(me.indiciStato);
    },
    onError: (err: unknown, valore: boolean) => {
      setConsenso(!valore);
      setErrore(
        err instanceof Error ? err.message : "Non è stato possibile cambiare il consenso.",
      );
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="t-label">Chi vede cosa</p>
        <p className="t-meta max-w-prose">{AVVISO_VISIBILITA}</p>
      </section>

      <section className="flex flex-col gap-3">
        <p className="t-label">Elaborazione assistita</p>
        <div className="plane-1 grain flex flex-col gap-3 rounded-card p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-prose font-ui text-sm text-ink">{TESTO_CONSENSO}</p>
            <Switch
              checked={consenso}
              onCheckedChange={(valore) => mutazione.mutate(valore)}
              disabled={mutazione.isPending}
              aria-label="Consenti l'elaborazione assistita"
            />
          </div>
          <p className="t-meta max-w-prose">
            {consenso ? EFFETTO_REVOCA : EFFETTO_RIATTIVAZIONE}
          </p>
          {consenso && (
            <p className="t-meta max-w-prose">
              {indiciStato === "in_ricostruzione"
                ? "Gli indici si stanno ricostruendo: la ricerca semantica è incompleta finché non hanno finito."
                : "Gli indici sono pronti."}
            </p>
          )}
          <p className="t-meta max-w-prose">{NOTE_FUORI_DAL_CONSENSO}</p>
          {errore && <p className="text-xs text-ink-soft">{errore}</p>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="t-label">Cancellazione dell&apos;account</p>
        <p className="t-meta max-w-prose">{NOTA_CANCELLAZIONE}</p>
      </section>
    </div>
  );
}
