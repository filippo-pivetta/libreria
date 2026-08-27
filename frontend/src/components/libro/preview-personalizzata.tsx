"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancellaArtefatto, generaPreview, getPreview } from "@/lib/api/preview";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { IconaAltro } from "@/components/ui/icone";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { Messaggio } from "@/components/ui/messaggio";
import { useTranslations } from "next-intl";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/**
 * "Me lo consigli?" (design doc §9, issue #6): un parere su questo libro
 * a partire dal proprio storico e dai propri insight.
 *
 * **Esiste solo su "da leggere", ed è la cosa più importante di questo
 * file.** Prima stava nella colonna laterale in ogni stato, e in tre
 * stati su quattro faceva una domanda a cui la pagina stessa aveva già
 * risposto: a chi sta leggendo un libro, a chi l'ha finito e gli ha dato
 * quattro stelle, a chi l'ha abbandonato a pagina sessanta, "me lo
 * consigli?" non chiede niente. La decisione è aperta in un solo stato —
 * quello in cui il libro è lì e non l'hai ancora cominciato — e lì il
 * parere è esattamente il consiglio che serve.
 *
 * Perché nella colonna principale e non più in quella laterale: la
 * domanda "lo comincio?" appartiene alla stessa zona di `BloccoStato`,
 * che in "da leggere" dice "non l'hai ancora cominciato" e offre "Comincia
 * a leggere". Il parere è l'aiuto a decidere quel comando, quindi gli sta
 * sotto invece che di lato. E in colonna piena il testo respira su una
 * misura da leggere, invece di incolonnarsi in 320px sotto la descrizione
 * del libro — che è ciò che rendeva quella colonna una striscia lunga con
 * il vuoto accanto.
 *
 * **Un parere già chiesto non sparisce mai, ma si fa da parte.**
 * `decisioneAperta` governa l'INVITO a chiederne uno, non l'esistenza del
 * blocco: legare anche quella allo stato renderebbe un contenuto
 * dell'Utente irraggiungibile e incancellabile appena preme "Comincia a
 * leggere", e il PRD dice che ogni contenuto proprio si può cancellare.
 *
 * Ma non basta spegnere i comandi e lasciare la carta com'era: una carta
 * alta seicento pixel, intitolata con una domanda, che spiega perché non
 * leggere un libro che stai leggendo, è rumore — e su "in lettura"
 * occupava più spazio del giudizio. A decisione chiusa il parere diventa
 * **retrospettivo**: cambia titolo ("Il parere che avevi chiesto", al
 * passato, perché è quello che è), scende da `t-sentenza` a `t-appunto`
 * (non è più una frase che decide, è un appunto di allora), si taglia a
 * due righe, e resta il solo comando che serve — cancellarlo. Da seicento
 * pixel a centoventi.
 *
 * Con nessun parere e nessuna decisione aperta il blocco non compare
 * affatto: l'assenza è muta (§15), non una carta vuota.
 *
 * **Nessun comando di condivisione, in nessuna forma.** La regola 23 del
 * PRD vieta che una preview sia condivisibile o visibile ad altri, e il
 * modo di garantirlo è che l'operazione non esista: non un interruttore
 * spento, non un menù senza la voce. Nemmeno il database la concede.
 *
 * Niente più etichetta "Sintesi generata" sopra il testo. Era il terzo
 * vincolo della regola 20, ora caduto: il parere lo legge solo chi l'ha
 * chiesto un momento prima premendo un pulsante, sotto un titolo che è la
 * domanda stessa, e la regola 23 garantisce che non lo veda nessun altro.
 * Non restava nessuno da avvertire, e il tag apriva il blocco al posto
 * della risposta.
 */
export function PreviewPersonalizzata({
  voceId,
  decisioneAperta,
}: {
  voceId: string;
  /** Vero solo su "da leggere": lo stato in cui "lo comincio?" è ancora
   * una domanda. Governa l'invito a chiedere un parere, non la
   * visibilità di uno già chiesto. */
  decisioneAperta: boolean;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const [spenta, setSpenta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [apertoPerIntero, setApertoPerIntero] = useState(false);

  const chiave = ["preview", voceId];

  const { data: preview } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getPreview(token, voceId);
      if (result.status === "ok") return result.data;
      if (result.status === "not_found") return null;
      // Consenso revocato: nessuna preview da mostrare, e non è un
      // errore da segnalare — l'interfaccia lo dice già con la riga di
      // `spentaDavvero`, che nasce dalla query sul consenso.
      if (result.status === "consenso_revocato") return null;
      throw new ErroreApp(result.errore);
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
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
      return result.data;
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chiave }),
    onError: (err: unknown) => setErrore(spiega("anteprimaNonArrivata", erroreDi(err))),
  });

  const cancella = useMutation({
    mutationFn: async (artefattoId: string) => {
      const token = await getAccessToken();
      const result = await cancellaArtefatto(token, artefattoId);
      if (result.status === "error") throw new ErroreApp(result.errore);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chiave }),
    onError: (err: unknown) => setErrore(spiega("parereNonCancellato", erroreDi(err))),
  });

  const spentaDavvero = spenta || consenso === false;

  // Nessun parere e nessuna decisione da prendere: non c'è niente da
  // dire, quindi non c'è niente in pagina.
  if (!preview && !decisioneAperta) return null;

  // A decisione chiusa il parere è un appunto di allora, non una domanda
  // aperta: titolo al passato, misura da appunto, tagliato a due righe.
  if (preview && !decisioneAperta) {
    return (
      <section className="plane-1 grain p-5">
        <h2 className="t-section">Il parere che avevi chiesto</h2>
        <p
          className="t-appunto mt-2.5 max-w-[68ch]"
          style={
            apertoPerIntero
              ? undefined
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }
          }
        >
          {preview.testo}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {!apertoPerIntero && (
            <Button variant="quiet" size="testo" onClick={() => setApertoPerIntero(true)}>
              Continua a leggere
            </Button>
          )}
          {/* La cancellazione di un artefatto generato sta in un menù, non
              accanto al comando che lo rigenera: stessa correzione fatta
              ai temi dei Quaderni (`quaderni/temi.tsx`) e stesso pattern
              già in uso sulle righe di insight. Buttare un parere non ha
              lo stesso peso di aprirlo per intero, e prima ce l'aveva. */}
          <MenuCancella
            className="ml-auto"
            inCorso={cancella.isPending}
            onCancella={() => cancella.mutate(preview.id)}
          />
        </div>
        <Messaggio className="mt-2">{errore}</Messaggio>
      </section>
    );
  }

  return (
    <section className="plane-1 grain p-5">
      <h2 className="t-section">Me lo consigli?</h2>

      {preview ? (
        <div className="mt-3.5 flex flex-col gap-4">
          <p className="t-sentenza max-w-[60ch]">{preview.testo}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {!spentaDavvero && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => genera.mutate()}
                disabled={genera.isPending}
              >
                {genera.isPending ? t("attesa.penso") : "Chiedine un altro"}
              </Button>
            )}
            <MenuCancella
              inCorso={cancella.isPending}
              onCancella={() => cancella.mutate(preview.id)}
            />
          </div>
        </div>
      ) : spentaDavvero ? (
        <p className="t-meta mt-2 max-w-[52ch]">{t("regole.consenso_revocato")}</p>
      ) : (
        <>
          <p className="t-meta mt-2 max-w-[60ch]">
            Un parere che nasce dai libri che hai letto e da ciò che ne hai scritto: come
            chiederlo a qualcuno che conosce i tuoi scaffali. Resta tuo, non lo vede nessun
            altro.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => genera.mutate()}
            disabled={genera.isPending}
          >
            {genera.isPending ? t("attesa.penso") : "Chiedi un parere"}
          </Button>
        </>
      )}

      <Messaggio className="mt-2">{errore}</Messaggio>
    </section>
  );
}

/**
 * Il menù di manutenzione di un parere: una voce sola, e va bene così.
 *
 * Una voce in un menù sembra troppo, finché non si guarda l'alternativa:
 * "Cancella" scritto accanto a "Chiedine un altro", allo stesso corpo e
 * allo stesso colore, con la differenza che uno dei due non torna
 * indietro. Il menù non nasconde la cancellazione — la mette dove l'app
 * mette già le azioni che si compiono di rado e che non si vogliono
 * sfiorare per sbaglio (le righe di insight, i temi dei Quaderni), cioè
 * dietro un gesto in più.
 */
function MenuCancella({
  inCorso,
  onCancella,
  className,
}: {
  inCorso: boolean;
  onCancella: () => void;
  className?: string;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label="Altre azioni sul parere"
          >
            <IconaAltro />
          </Button>
        }
      />
      <MenuContenuto align="end">
        <MenuVoce disabled={inCorso} onClick={onCancella}>
          Cancella il parere
        </MenuVoce>
      </MenuContenuto>
    </Menu>
  );
}
