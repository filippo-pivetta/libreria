"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUtenti, type Membro } from "@/lib/api/utenti";
import { inviaRichiesta } from "@/lib/api/collegamenti";
import { getAccessToken } from "@/lib/api/access-token";
import { iniziali } from "@/lib/iniziali";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroElenco } from "@/components/states/scheletri";
import { Messaggio } from "@/components/ui/messaggio";
import { ASSENZE, ERRORI } from "@/messaggi/it";

/**
 * Lettori (design doc §16, emendamento 20 agosto 2026): due carte, non
 * una lista sola, perché fa due mestieri con frequenze opposte — andare
 * da qualcuno con cui sei già collegato (quotidiano) e trovare qualcuno
 * da chiedere (raro, in un gruppo chiuso). Iniziali in Fraunces, nessuna
 * immagine profilo, che il PRD non prevede.
 */
export function ElencoLettori({ membriIniziali }: { membriIniziali: Membro[] }) {
  const queryClient = useQueryClient();
  const [errore, setErrore] = useState<{ utenteId: string; messaggio: string } | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["utenti"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getUtenti(token);
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    initialData: membriIniziali,
  });

  const mutazione = useMutation({
    mutationFn: async (utenteId: string) => {
      const token = await getAccessToken();
      const result = await inviaRichiesta(token, utenteId);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found"
            ? ASSENZE.utenteSparito
            : result.status === "richiesta_a_se_stessi"
              ? "Non puoi collegarti a te stesso."
              : result.message,
        );
      }
    },
    onMutate: () => setErrore(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["utenti"] });
      void queryClient.invalidateQueries({ queryKey: ["collegamenti"] });
    },
    onError: (mutationError: unknown, utenteId: string) => {
      setErrore({
        utenteId,
        messaggio:
          mutationError instanceof Error
            ? mutationError.message
            : ERRORI.richiestaNonInviata,
      });
    },
  });

  if (isPending) {
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroElenco righe={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : ERRORI.lettoriNonCaricati}
        onRetry={() => void refetch()}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Nessun altro lettore"
        description="Nessun altro membro è ancora entrato nel gruppo."
      />
    );
  }

  const collegati = data.filter((m) => m.statoRelazione === "attiva");
  const altri = data.filter((m) => m.statoRelazione !== "attiva");

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-md text-sm text-ink-soft">
        Diviso in due perché fa due mestieri con frequenze opposte: andare da qualcuno, che è
        quotidiano, e trovare qualcuno da chiedere, che in un gruppo chiuso capita poche volte
        l&apos;anno.
      </p>

      {collegati.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="t-label">I tuoi collegamenti · {collegati.length}</p>
          <div className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
            {collegati.map((membro) => (
              <Link
                key={membro.id}
                href={`/lettori/${membro.id}`}
                className="flex items-center gap-3 p-4 hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm text-ink-soft"
                >
                  {iniziali(membro.nomeUtente)}
                </span>
                <span className="font-ui text-sm font-medium text-ink">{membro.nomeUtente}</span>
                <span aria-hidden className="ml-auto text-ink-soft">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {altri.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="t-label">Altri membri · {altri.length}</p>
          <div className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
            {altri.map((membro) => (
              <div key={membro.id} className="flex items-center gap-3 p-4">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm text-ink-soft"
                >
                  {iniziali(membro.nomeUtente)}
                </span>
                <span className="font-ui text-sm font-medium text-ink">{membro.nomeUtente}</span>

                <div className="ml-auto flex flex-col items-end gap-1">
                  {membro.statoRelazione === "assente" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mutazione.isPending && mutazione.variables === membro.id}
                      onClick={() => mutazione.mutate(membro.id)}
                    >
                      Chiedi il collegamento
                    </Button>
                  ) : (
                    <span className="t-meta">
                      {membro.richiestaRicevuta ? "Ti ha chiesto il collegamento" : "Richiesta inviata"}
                    </span>
                  )}
                  {errore?.utenteId === membro.id && (
                    <Messaggio className="text-right">{errore.messaggio}</Messaggio>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="max-w-md text-sm text-ink-soft">
            Le richieste si accettano nella Torre, dove il contatore le rende visibili. Qui una
            richiesta in attesa è testo e non un comando.
          </p>
        </section>
      )}
    </div>
  );
}
