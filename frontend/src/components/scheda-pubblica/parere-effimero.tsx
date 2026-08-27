"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { chiediParere, type FonteScheda } from "@/lib/api/schede";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/**
 * "Me lo consigli?" su un libro che non si ha in libreria (§13).
 *
 * **La decisione qui è aperta per definizione.** Sulla scheda del libro
 * il parere esiste in un solo stato — "da leggere" — perché negli altri
 * la domanda ha già una risposta implicita nei fatti (§9). Su questa
 * carta quello stato è l'unico possibile: il libro non è tuo, la domanda
 * "lo prendo?" è l'intera ragione della pagina. Nessun `decisioneAperta`
 * da passare, quindi, e nessuna forma retrospettiva.
 *
 * **Il parere non viene salvato**, ed è l'unica differenza vera con
 * quello della scheda del libro. `artefatto_generato` lega una preview
 * alla Voce da cui è stata invocata (vincolo di schema, regola 23 del
 * PRD), e qui una Voce non c'è: il PRD chiama l'artefatto un contenuto
 * "conservato nella sua libreria", e senza libreria non c'è conservazione.
 * Vive quanto la pagina, e la riga d'invito lo dice prima che qualcuno
 * ci si affezioni — non dopo averlo perso.
 *
 * Per la stessa ragione non c'è comando "Cancella": non c'è niente da
 * cancellare. Ricaricare la pagina è già la cancellazione.
 *
 * **Appena il libro entra in libreria l'invito sparisce**, ma un parere
 * già letto resta dov'è. Da quel momento la domanda ha un posto migliore
 * — la scheda del libro, dove il parere si salva e si può rileggere — e
 * offrirlo due volte con due comportamenti diversi sarebbe una promessa
 * ambigua su quale dei due si conserva. Far sparire di colpo un testo che
 * si sta leggendo sarebbe però peggio.
 */
export function ParereEffimero({
  fonte,
  identificativo,
  inLibreria,
}: {
  fonte: FonteScheda;
  identificativo: string;
  inLibreria: boolean;
}) {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const [parere, setParere] = useState<string | null>(null);
  const [spenta, setSpenta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Solo per sapere se l'interruttore è acceso prima di offrire il
  // comando: a consenso revocato il PRD vuole che l'interfaccia dica che
  // la funzione è spenta, non che finga che non esista.
  const { data: consenso } = useQuery({
    queryKey: ["me", "consenso"],
    queryFn: async () => {
      const result = await getMe(await getAccessToken());
      return result.status === "ok" ? result.data.consensoElaborazioneAssistita : true;
    },
  });

  const chiedi = useMutation({
    mutationFn: async () => {
      const result = await chiediParere(await getAccessToken(), fonte, identificativo);
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        return null;
      }
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("schedaSparita") : result.errore,
        );
      }
      return result.testo;
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: (testo) => setParere(testo),
    onError: (err: unknown) => setErrore(spiega("parereNonArrivato", erroreDi(err))),
  });

  const spentaDavvero = spenta || consenso === false;

  // Niente parere e niente da chiedere: l'assenza è muta, non una carta
  // vuota (§15).
  if (inLibreria && !parere) return null;

  return (
    <section className="plane-1 grain p-5">
      <h2 className="t-section">Me lo consigli?</h2>

      {parere ? (
        <div className="mt-3.5 flex flex-col gap-4">
          <p className="t-sentenza max-w-[60ch]">{parere}</p>
          {!inLibreria && !spentaDavvero && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => chiedi.mutate()}
                disabled={chiedi.isPending}
              >
                {chiedi.isPending ? t("attesa.penso") : "Chiedine un altro"}
              </Button>
            </div>
          )}
        </div>
      ) : spentaDavvero ? (
        <p className="t-meta mt-2 max-w-[52ch]">
          L&apos;elaborazione assistita è spenta. Puoi riaccenderla dal tuo profilo.
        </p>
      ) : (
        <>
          <p className="t-meta mt-2 max-w-[60ch]">
            Un parere a partire da quello che hai già letto e scritto, prima di decidere se
            prenderlo. Resta tuo, non lo vede nessun altro, e vive quanto questa pagina: non viene
            salvato.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => chiedi.mutate()}
            disabled={chiedi.isPending}
          >
            {chiedi.isPending ? t("attesa.penso") : "Chiedi un parere"}
          </Button>
        </>
      )}

      <Messaggio className="mt-2">{errore}</Messaggio>
    </section>
  );
}
