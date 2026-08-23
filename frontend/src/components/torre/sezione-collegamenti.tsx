"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  accettaCollegamento,
  getCollegamenti,
  terminaCollegamento,
  type Collegamento,
} from "@/lib/api/collegamenti";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroElenco } from "@/components/states/scheletri";
import { Messaggio } from "@/components/ui/messaggio";
import { ASSENZE, ERRORI } from "@/messaggi/it";

// Stessa costante di providers/toast-provider.tsx (DURATA_MS), per
// coerenza fra le due finestre di "annulla" dell'app.
const ATTESA_INTERRUZIONE_MS = 6000;

/**
 * Sezione collegamenti della Torre (design doc §17): richieste ricevute
 * (accetta/rifiuta), inviate (ritira), collegamenti attivi (interrompi).
 * La sezione impostazioni vive accanto, in `sezione-impostazioni.tsx`
 * (issue #6); della cancellazione dell'account (issue #8) resta là una
 * nota.
 */
export function SezioneCollegamenti({
  collegamentiIniziali,
}: {
  collegamentiIniziali: Collegamento[];
}) {
  const queryClient = useQueryClient();
  const [erroreAzione, setErroreAzione] = useState<{ id: string; messaggio: string } | null>(
    null,
  );
  // Un collegamento "in fase di interruzione" non ha ancora chiamato il
  // backend (design doc §17: interrompere non è simmetricamente
  // reversibile — riavere il collegamento richiede una nuova richiesta
  // accettata dall'altro). La DELETE parte solo quando il timer scade
  // senza che "Annulla" sia stato premuto.
  const [inInterruzione, setInInterruzione] = useState<Set<string>>(() => new Set());
  const timer = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timer.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["collegamenti"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getCollegamenti(token);
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    initialData: collegamentiIniziali,
  });

  const invalida = () => void queryClient.invalidateQueries({ queryKey: ["collegamenti"] });

  const accetta = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await accettaCollegamento(token, id);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? ASSENZE.richiestaSparita : result.message,
        );
      }
    },
    onMutate: () => setErroreAzione(null),
    onSuccess: invalida,
    onError: (err: unknown, id: string) =>
      setErroreAzione({
        id,
        messaggio:
          err instanceof Error ? err.message : ERRORI.richiestaNonAccettata,
      }),
  });

  const termina = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await terminaCollegamento(token, id);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? ASSENZE.collegamentoSparito : result.message,
        );
      }
    },
    onMutate: () => setErroreAzione(null),
    onSuccess: invalida,
    onError: (err: unknown, id: string) =>
      setErroreAzione({
        id,
        messaggio: err instanceof Error ? err.message : ERRORI.collegamentoNonAggiornato,
      }),
  });

  function avviaInterruzione(id: string) {
    setInInterruzione((precedente) => new Set(precedente).add(id));
    const t = setTimeout(() => {
      timer.current.delete(id);
      setInInterruzione((precedente) => {
        const successivo = new Set(precedente);
        successivo.delete(id);
        return successivo;
      });
      termina.mutate(id);
    }, ATTESA_INTERRUZIONE_MS);
    timer.current.set(id, t);
  }

  function annullaInterruzione(id: string) {
    const t = timer.current.get(id);
    if (t) {
      clearTimeout(t);
      timer.current.delete(id);
    }
    setInInterruzione((precedente) => {
      const successivo = new Set(precedente);
      successivo.delete(id);
      return successivo;
    });
  }

  if (isPending) {
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroElenco righe={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : ERRORI.collegamentiNonCaricati}
        onRetry={() => void refetch()}
      />
    );
  }

  const ricevute = data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe);
  const inviate = data.filter((c) => c.stato === "in_attesa" && c.richiestoDaMe);
  const attive = data.filter((c) => c.stato === "attiva");

  if (ricevute.length === 0 && inviate.length === 0 && attive.length === 0) {
    // L'unico stato vuoto di questa pagina che spiega la reciprocità
    // (design doc §18), non un elenco vuoto ripetuto tre volte.
    return (
      <EmptyState
        title="Nessun collegamento"
        description="Finché nessuno accetta, nessuno vede nulla dell’altro, in nessuna delle due direzioni."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="t-label">Richieste ricevute</p>
        {ricevute.length === 0 ? (
          <p className="t-meta">Nessuna richiesta ricevuta.</p>
        ) : (
          <ul className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
            {ricevute.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <span className="font-ui text-sm text-ink">{c.altro.nomeUtente}</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => accetta.mutate(c.id)}
                      disabled={accetta.isPending && accetta.variables === c.id}
                    >
                      Accetta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => termina.mutate(c.id)}
                      disabled={termina.isPending && termina.variables === c.id}
                    >
                      Rifiuta
                    </Button>
                  </div>
                  {erroreAzione?.id === c.id && (
                    <Messaggio className="text-right">{erroreAzione.messaggio}</Messaggio>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="t-label">Richieste inviate</p>
        {inviate.length === 0 ? (
          <p className="t-meta">Nessuna richiesta inviata.</p>
        ) : (
          <ul className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
            {inviate.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <span className="font-ui text-sm text-ink">{c.altro.nomeUtente}</span>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => termina.mutate(c.id)}
                    disabled={termina.isPending && termina.variables === c.id}
                  >
                    Ritira
                  </Button>
                  {erroreAzione?.id === c.id && (
                    <Messaggio className="text-right">{erroreAzione.messaggio}</Messaggio>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="t-label">Collegamenti attivi</p>
        {attive.length === 0 ? (
          <p className="t-meta">Nessun collegamento attivo.</p>
        ) : (
          <ul className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
            {attive.map((c) =>
              inInterruzione.has(c.id) ? (
                <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="t-meta">{c.altro.nomeUtente} — interrotto</span>
                  <Button variant="outline" size="sm" onClick={() => annullaInterruzione(c.id)}>
                    Annulla
                  </Button>
                </li>
              ) : (
                <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="font-ui text-sm text-ink">{c.altro.nomeUtente}</span>
                  <Button variant="outline" size="sm" onClick={() => avviaInterruzione(c.id)}>
                    Interrompi
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
