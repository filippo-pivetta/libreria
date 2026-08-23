"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancellaArtefatto, generaPreview, getPreview } from "@/lib/api/preview";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { useTranslations } from "next-intl";

/**
 * "Me lo consigli?" (design doc §9, issue #6): un parere su questo libro
 * a partire dal proprio storico e dai propri insight.
 *
 * Quando la Voce è "da leggere" prende il posto dei dati di lettura —
 * non c'è niente da registrare, e questa è la domanda che ci si fa
 * davanti a un libro in coda. Negli altri stati resta un comando sobrio
 * più in basso: il PRD non lo limita a uno stato, e su un libro già
 * letto un parere ha comunque senso, semplicemente non è la cosa
 * principale.
 *
 * **Nessun comando di condivisione, in nessuna forma.** La regola 23 del
 * PRD vieta che una preview sia condivisibile o visibile ad altri, e il
 * modo di garantirlo è che l'operazione non esista: non un interruttore
 * spento, non un menù senza la voce. Nemmeno il database la concede.
 *
 * L'avviso "Sintesi generata" arriva dal server come campo obbligatorio
 * della risposta e si mostra sempre, sopra il testo: è il terzo vincolo
 * della regola 20, e affidarlo al modello avrebbe significato perderlo
 * la prima volta che si distrae.
 */
export function PreviewPersonalizzata({
  voceId,
  inEvidenza,
}: {
  voceId: string;
  /** Vero quando la Voce è "da leggere": il blocco prende il posto dei
   * dati di lettura invece di stare in coda alla pagina. */
  inEvidenza: boolean;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const [spenta, setSpenta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const chiave = ["preview", voceId];

  const { data: preview } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getPreview(token, voceId);
      if (result.status === "ok") return result.data;
      if (result.status === "not_found") return null;
      throw new Error(result.status === "consenso_revocato" ? "spenta" : result.message);
    },
  });

  // Solo per sapere se l'interruttore è acceso prima di offrire il
  // comando: a consenso revocato il PRD vuole che l'interfaccia dica che
  // la funzione è spenta, non che finga che non esista.
  const { data: consenso } = useQuery({
    queryKey: ["me", "consenso"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMe(token);
      return result.status === "ok" ? result.data.consensoElaborazioneAssistita : true;
    },
  });

  const genera = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await generaPreview(token, voceId);
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        return null;
      }
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? t("assenze.voceSparita") : result.message,
        );
      }
      return result.data;
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chiave }),
    onError: (err: unknown) =>
      setErrore(err instanceof Error ? err.message : "Il parere non è arrivato."),
  });

  const cancella = useMutation({
    mutationFn: async (artefattoId: string) => {
      const token = await getAccessToken();
      const result = await cancellaArtefatto(token, artefattoId);
      if (result.status === "error") throw new Error(result.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chiave }),
    onError: () => setErrore(t("errori.parereNonCancellato")),
  });

  const spentaDavvero = spenta || consenso === false;

  return (
    <div className={inEvidenza ? "mb-5" : "mt-8 border-t border-line pt-5"}>
      <p className="t-label mb-2">Me lo consigli?</p>

      {preview ? (
        <div className="plane-2 grain flex flex-col gap-2 rounded-card p-4">
          <p className="t-meta">{preview.avviso}</p>
          <p className="t-sentenza">{preview.testo}</p>
          <div className="flex gap-2">
            {!spentaDavvero && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => genera.mutate()}
                disabled={genera.isPending}
              >
                {genera.isPending ? t("attesa.penso") :"Chiedine un altro"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancella.mutate(preview.id)}
              disabled={cancella.isPending}
            >
              Cancella
            </Button>
          </div>
        </div>
      ) : spentaDavvero ? (
        <p className="t-meta max-w-prose">
          L&apos;elaborazione assistita è spenta. Puoi riaccenderla dalle impostazioni nella
          Torre.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="t-meta max-w-prose">
            Un parere su questo libro, a partire da quello che hai già letto e scritto. Resta
            tuo e non lo vede nessun altro.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => genera.mutate()}
            disabled={genera.isPending}
          >
            {genera.isPending ? t("attesa.penso") :"Chiedi un parere"}
          </Button>
        </div>
      )}

      <Messaggio className="mt-2">{errore}</Messaggio>
    </div>
  );
}
