"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { cancellaVoce } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { ASSENZE, ERRORI } from "@/messaggi/it";

type Passo = "chiuso" | "riepilogo";

/**
 * Cancellazione dell'intera Voce (issue #33, PRD: "cancellare... la Voce
 * intera"). Non tocca il Libro né le Voci di altri Utenti sullo stesso
 * Libro (RLS + FK composita se ne occupano lato server) — qui si cancella
 * solo la propria copia.
 *
 * Stessi tre livelli di attrito della cancellazione di una Lettura
 * (design doc §9: menù "⋯" → comando → "Cancella davvero"/"Annulla"), ma
 * ciò che il comando rivela non è solo "Cancella davvero"/"Annulla": è un
 * riepilogo di cosa sta per sparire insieme alla voce, con i conteggi
 * reali (letture, insight, recensione, nota di intenzione) — l'attrito in
 * più sta nel contenuto di quel passo, non in un passo aggiuntivo,
 * proporzionato alla gravità maggiore (irreversibile, su più dati
 * contemporaneamente) senza aggiungere un clic. Nessun campo da digitare
 * (a differenza della cancellazione account, design doc §17): quella
 * riguarda l'intero account ed è per questo l'unica azione dell'app a
 * chiedere una conferma testuale.
 *
 * In fondo alla pagina della copia, in tono piano — stesso trattamento
 * della cancellazione account: non un pulsante rosso, nessun allarme
 * grafico (design doc §17, Button non ha variante "destructive").
 */
export function EliminaVoce({
  voceId,
  titoloLibro,
  numeroLetture,
  numeroInsight,
  haRecensione,
  haNotaIntenzione,
}: {
  voceId: string;
  titoloLibro: string;
  numeroLetture: number;
  numeroInsight: number;
  haRecensione: boolean;
  haNotaIntenzione: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [passo, setPasso] = useState<Passo>("chiuso");
  const [errore, setErrore] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaVoce(token, voceId);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? ASSENZE.voceSparita : result.message,
        );
      }
    },
    onMutate: () => setErrore(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
      router.push("/");
    },
    onError: (error: unknown) => {
      setErrore(
        error instanceof Error ? error.message : ERRORI.voceNonCancellata,
      );
    },
  });

  if (passo === "chiuso") {
    return (
      <div className="mt-8 border-t border-line pt-5">
        <details className="relative">
          <summary
            aria-label="Altre azioni"
            className="t-meta inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-field px-2.5 text-ink-soft hover:bg-surface-2 hover:text-ink"
          >
            ⋯
          </summary>
          <div className="absolute top-full left-0 z-10 pt-1.5">
            <div className="min-w-40 rounded-field border border-line bg-surface-1 p-1.5 shadow-plane-2">
              <button
                type="button"
                onClick={() => setPasso("riepilogo")}
                className="w-full rounded-object px-3 py-2 text-left font-ui text-sm text-ink hover:bg-surface-2"
              >
                Elimina la voce
              </button>
            </div>
          </div>
        </details>
      </div>
    );
  }

  // Cosa sparisce insieme alla voce: dice sempre la cosa che sta per
  // succedere, con i conteggi reali già disponibili sulla Voce (nessuna
  // query in più), non una frase generica (design doc §17, stesso
  // principio della riga di stato del consenso).
  const parti: string[] = [];
  parti.push(numeroLetture === 1 ? "1 lettura" : `${numeroLetture} letture`);
  if (numeroInsight > 0) {
    parti.push(numeroInsight === 1 ? "1 insight" : `${numeroInsight} insight`);
  }
  if (haRecensione) parti.push("la recensione");
  if (haNotaIntenzione) parti.push("la nota di intenzione");

  return (
    <div className="mt-8 border-t border-line pt-5">
      <div className="pannello plane-2 grain flex flex-col gap-3 rounded-card p-4">
        <p className="t-meta">
          Cancella «{titoloLibro}» dalla tua libreria, insieme a {parti.join(", ")} ed
          eventuali pareri generati. Non tocca il libro nel catalogo né le copie di altri. Non è
          reversibile.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => mutazione.mutate()}
          >
            Cancella davvero
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={mutazione.isPending}
            onClick={() => setPasso("chiuso")}
          >
            Annulla
          </Button>
        </div>
        <Messaggio>{errore}</Messaggio>
      </div>
    </div>
  );
}
