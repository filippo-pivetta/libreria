"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { cancellaVoce } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

type Passo = "chiuso" | "conferma";

/**
 * Cancellazione dell'intera Voce (issue #33, PRD: "cancellare... la Voce
 * intera"). Non tocca il Libro né le Voci di altri Utenti sullo stesso
 * Libro (RLS + FK composita se ne occupano lato server) — qui si cancella
 * solo la propria copia.
 *
 * **Due passaggi, non tre.** Prima il comando apriva un menù ("Togli
 * dalla libreria" → "Elimina la voce" → "Cancella davvero"), e il passo
 * di mezzo non chiedeva niente: era un menù con una sola voce, cioè un
 * clic che ripeteva la parola del bottone che l'aveva aperto. Un attrito
 * che non fa pensare non protegge, stanca e basta. Ora il comando apre
 * direttamente la conferma, e l'attrito sta dove serve — nel CONTENUTO
 * della conferma, che dice con i conteggi reali cosa sparisce insieme
 * alla voce (letture, insight, recensione, nota di intenzione), non in
 * una frase generica.
 *
 * Il riquadro di conferma è un pannello in pagina, non un modale: §19
 * dice che l'app non ne ha, e questo non è il caso per cui fare
 * un'eccezione. Nessun campo da digitare (a differenza della
 * cancellazione account, design doc §17): quella riguarda l'intero
 * account ed è per questo l'unica azione dell'app a chiedere una
 * conferma testuale.
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
  const spiega = useMessaggioErrore();
  const [passo, setPasso] = useState<Passo>("chiuso");
  const [errore, setErrore] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaVoce(token, voceId);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
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
        spiega("voceNonCancellata", erroreDi(error)),
      );
    },
  });

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

  // Riga di piede a piena larghezza, in fondo a tutta la pagina. Prima
  // stava a metà della colonna della copia, fra il parere e lo storico:
  // cioè l'azione irreversibile della pagina si trovava PRIMA di contenuti
  // che si possono ancora leggere. Il tono resta piano — niente rosso,
  // `alert` ha un solo uso in tutta l'app (§3) — ma la posizione ora
  // corrisponde al peso: ultima cosa, dopo tutto il resto.
  if (passo === "chiuso") {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5">
        <p className="t-meta">
          Toglierlo cancella {parti.join(", ")}. Non è reversibile.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setPasso("conferma")}>
          Togli dalla libreria
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-line pt-5">
      <div className="pannello plane-2 grain flex flex-col gap-4 rounded-card p-5">
        <p className="t-body max-w-prose text-sm">
          Cancella «{titoloLibro}» dalla tua libreria, insieme a {parti.join(", ")} ed
          eventuali pareri generati. Non tocca il libro nel catalogo né le copie di altri. Non è
          reversibile.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={mutazione.isPending}
            onClick={() => mutazione.mutate()}
          >
            Cancella davvero
          </Button>
          <Button variant="ghost" disabled={mutazione.isPending} onClick={() => setPasso("chiuso")}>
            Annulla
          </Button>
        </div>
        <Messaggio>{errore}</Messaggio>
      </div>
    </div>
  );
}
