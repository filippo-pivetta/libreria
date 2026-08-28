"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancellaInsight,
  correggiInsight,
  creaInsight,
  rivelaInsightTesto,
  type InsightEssenziale,
  type Visibilita,
} from "@/lib/api/insight";
import type { Lettura } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaData, periodoLettura } from "@/lib/formato";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { AzioniModulo } from "@/components/ui/azioni-modulo";
import { Invito } from "@/components/ui/invito";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { InterruttoriScritto } from "@/components/ui/interruttori-scritto";
import { IconaAltro, IconaCoperto, IconaLucchetto, IconaMatita } from "@/components/ui/icone";
import { useLocale } from "next-intl";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

// Soglia tra i due trattamenti tipografici (design doc §10): sotto,
// "Sentenza" (opsz 32, senza troncamento); sopra, "Appunto" (opsz 12,
// troncato a otto righe con "mostra tutto").
const SOGLIA_SENTENZA = 200;

// Oltre questo numero la lista si chiude e offre di aprirsi. Il PRD dice
// "insight nell'ordine delle unità o decine per libro": a otto sentenze
// in Literata si è già a uno schermo pieno, e uno schermo pieno di prosa
// senza un appiglio è esattamente ciò che rende "caotica" una pagina che
// non ha nessun difetto di dato.
const PRIMI = 8;

/**
 * Il modulo dell'insight: lo STESSO per scriverne uno nuovo e per
 * correggerne uno esistente.
 *
 * Il PRD è netto — "l'Utente può correggere e cancellare ogni contenuto
 * proprio: avanzamenti sbagliati, Letture aperte per errore, insight,
 * recensioni, note" — e la correzione dell'insight era l'unica delle
 * cinque a non avere una superficie: la rotta `PATCH /insight/{id}`
 * esisteva sul server e il fetcher `correggiInsight` esisteva nel
 * client, ma niente in pagina li chiamava. Nel menù c'era solo
 * "Cancella", cioè l'unico modo di rimediare a un refuso era distruggere
 * il testo e riscriverlo — su un contenuto che il PRD dichiara
 * correggibile e che i collegati stanno già leggendo.
 *
 * Un modulo solo per i due gesti, e non due che si somigliano: spoiler e
 * visibilità decidono cosa i collegati vedranno, e devono avere la
 * stessa forma quando li scegli la prima volta e quando li cambi. Le
 * uniche differenze sono l'etichetta del bottone di conferma e il fatto
 * che in correzione i tre valori partono da quelli dell'insight.
 */
function ModuloInsight({
  testoIniziale = "",
  spoilerIniziale = false,
  visibilitaIniziale = "condiviso",
  etichettaSalva,
  inCorso,
  onSalva,
  onAnnulla,
}: {
  testoIniziale?: string;
  spoilerIniziale?: boolean;
  visibilitaIniziale?: Visibilita;
  etichettaSalva: string;
  inCorso: boolean;
  onSalva: (campi: { testo: string; spoiler: boolean; visibilita: Visibilita }) => void;
  onAnnulla: () => void;
}) {
  const [testo, setTesto] = useState(testoIniziale);
  const [spoiler, setSpoiler] = useState(spoilerIniziale);
  const [visibilita, setVisibilita] = useState<Visibilita>(visibilitaIniziale);

  return (
    <div className="pannello plane-1 grain p-4 sm:px-5">
      <textarea
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        rows={4}
        autoFocus
        placeholder="Cosa ti ha colpito?"
        className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
      />
      {/* Prima erano due comandi testuali sottolineati la cui etichetta
          era anche lo stato ("Segna come spoiler" ⇄ "Contrassegnato
          spoiler"), quindi da fermo non si sapeva se descrivessero o
          promettessero — su una scelta che decide cosa i collegati
          leggeranno. Ora sono interruttori premuti, con `aria-pressed`,
          e stanno in un componente solo (`ui/interruttori-scritto.tsx`):
          questa barra era ricopiata alla lettera anche nel modulo dei
          Quaderni.

          Due gruppi, impilati sotto i 640px: che cosa sarà questo testo,
          e cosa farne. Vedi lo stesso commento in `scrivi-pensiero.tsx`. */}
      <div className="mt-3.5 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <InterruttoriScritto
            spoiler={spoiler}
            onSpoiler={setSpoiler}
            visibilita={visibilita}
            onVisibilita={setVisibilita}
          />
        </div>

        <AzioniModulo
          etichettaSalva={etichettaSalva}
          salvaDisabilitato={testo.trim() === "" || inCorso}
          onSalva={() => onSalva({ testo: testo.trim(), spoiler, visibilita })}
          onAnnulla={onAnnulla}
        />
      </div>
    </div>
  );
}

/**
 * Un insight. Il testo è l'oggetto; tutto il resto è marginalia.
 *
 * Tre cose cambiano rispetto a prima:
 *
 * 1. **il `⋯` esce dal testo.** Era `absolute top-2 right-2`, cioè
 *    sospeso sopra l'angolo del paragrafo, a corpo 12,5 — un bersaglio
 *    di 13px a due centimetri da dove il pollice scorre. Ora sta nel
 *    piede, in riga con la data, ed è un menù vero (Escape, fuoco,
 *    frecce) invece di un bottone che rivelava due comandi al suo posto;
 * 2. **privato e spoiler diventano segni nel margine.** Prima un insight
 *    privato era indistinguibile da uno condiviso: la visibilità per
 *    singolo insight è una promessa del PRD ed è reversibile, quindi
 *    dev'essere scandibile con l'occhio, non deducibile. Condiviso è il
 *    default e NON prende segno — assenza, non colore, come "da leggere"
 *    non ha nastro (§7);
 * 3. **la sentenza guadagna il margine.** Misura stretta contro la misura
 *    piena dell'appunto. È così che si mantiene la promessa di §10 — "in
 *    un libro con dodici insight, le due frasi buone risaltano da sole" —
 *    che prima non poteva realizzarsi, perché i due trattamenti stavano
 *    nella stessa riga a piena larghezza divisi da un filetto.
 */
function UnSoloInsight({
  voceId,
  insight,
  isOwner,
}: {
  voceId: string;
  insight: InsightEssenziale;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const spiega = useMessaggioErrore();
  const lingua = useLocale();
  const [testoRivelato, setTestoRivelato] = useState<string | null>(null);
  const [espansa, setEspansa] = useState(false);
  const [confermaCancella, setConfermaCancella] = useState(false);
  const [inCorrezione, setInCorrezione] = useState(false);

  const mutazioneRivela = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await rivelaInsightTesto(token, insight.id);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("insightSparito") : result.errore,
        );
      }
      return result.testo;
    },
    onSuccess: (testo) => setTestoRivelato(testo),
    onError: (error: unknown) => {
      showError(
        spiega("insightNonScoperto", erroreDi(error)),
      );
    },
  });

  const mutazioneCorreggi = useMutation({
    mutationFn: async (campi: { testo: string; spoiler: boolean; visibilita: Visibilita }) => {
      const token = await getAccessToken();
      const result = await correggiInsight(token, insight.id, campi);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("insightSparito") : result.errore,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      // Il testo rivelato di un collegato non c'entra qui (si corregge
      // solo il proprio), ma azzerarlo evita che una copia vecchia resti
      // a schermo se il refetch tarda.
      setTestoRivelato(null);
      setInCorrezione(false);
    },
    onError: (error: unknown) => {
      showError(
        spiega("insightNonSalvato", erroreDi(error)),
      );
    },
  });

  const mutazioneCancella = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaInsight(token, insight.id);
      if (result.status !== "ok" && result.status !== "not_found") {
        throw new ErroreApp(result.errore);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["voce", voceId] }),
    onError: (error: unknown) => {
      showError(
        spiega("insightNonCancellato", erroreDi(error)),
      );
    },
  });

  // Tagliata finché lo spoiler è acceso e nessuno ha ancora chiesto di
  // scoprirlo in questa sessione (design doc §11: "il server manda solo
  // il fatto che esiste, il gesto di scoprire fa una richiesta") — ma
  // solo per un collegato: la regola 10 protegge da uno spoiler altrui,
  // non da un proprio testo.
  const tagliata = !isOwner && insight.spoiler && testoRivelato === null;
  const testo = testoRivelato ?? insight.testo ?? "";
  const isAppunto = testo.length > SOGLIA_SENTENZA;

  if (tagliata) {
    return (
      <article className="flex flex-wrap items-center justify-between gap-4 rounded-field bg-surface-2/60 p-5">
        <span className="t-body flex items-center gap-3 text-sm text-ink-soft">
          <IconaCoperto aria-hidden className="size-[1.125rem] shrink-0" />
          Un insight con spoiler, del {formattaData(insight.data, lingua)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={mutazioneRivela.isPending}
          onClick={() => mutazioneRivela.mutate()}
        >
          Taglia per leggere
        </Button>
      </article>
    );
  }

  // In correzione l'insight cede il posto al modulo, esattamente come
  // l'invito cede il posto al modulo di scrittura: è la stessa
  // transizione dei pannelli in pagina (§19, l'app non ha modali), e il
  // testo si corregge dove sta invece che altrove.
  if (inCorrezione) {
    return (
      <ModuloInsight
        testoIniziale={testo}
        spoilerIniziale={insight.spoiler}
        visibilitaIniziale={insight.visibilita}
        etichettaSalva="Salva le correzioni"
        inCorso={mutazioneCorreggi.isPending}
        onSalva={(campi) => mutazioneCorreggi.mutate(campi)}
        onAnnulla={() => setInCorrezione(false)}
      />
    );
  }

  // Il segno nel margine. Condiviso non ne ha: è il default.
  const segno =
    insight.visibilita === "privato"
      ? { Icona: IconaLucchetto, parola: "solo tuo" }
      : isOwner && insight.spoiler
        ? { Icona: IconaCoperto, parola: "coperto per i collegati" }
        : null;

  return (
    <article className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 rounded-field bg-surface-2/60 p-5">
      <span aria-hidden className="flex justify-center pt-1 text-ink-soft opacity-60">
        {segno && <segno.Icona className="size-[1.0625rem] shrink-0" />}
      </span>

      <div className="min-w-0">
        <p
          className={isAppunto ? "t-appunto" : "t-sentenza max-w-[34ch]"}
          data-clamped={isAppunto && !espansa ? "" : undefined}
        >
          {testo}
        </p>
        {isAppunto && !espansa && (
          <Button
            variant="quiet"
            size="testo"
            className="mt-2"
            onClick={() => setEspansa(true)}
          >
            Mostra tutto
          </Button>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="t-meta">{formattaData(insight.data, lingua)}</span>
          {segno && <span className="t-meta">· {segno.parola}</span>}

          {isOwner && (
            <span className="ml-auto">
              {confermaCancella ? (
                <span className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutazioneCancella.isPending}
                    onClick={() => mutazioneCancella.mutate()}
                  >
                    Cancella davvero
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfermaCancella(false)}>
                    Annulla
                  </Button>
                </span>
              ) : (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Altre azioni sull’insight">
                        <IconaAltro />
                      </Button>
                    }
                  />
                  <MenuContenuto align="end">
                    <MenuVoce onClick={() => setInCorrezione(true)}>
                      <IconaMatita />
                      Modifica
                    </MenuVoce>
                    <MenuVoce onClick={() => setConfermaCancella(true)}>Cancella</MenuVoce>
                  </MenuContenuto>
                </Menu>
              )}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * La lettura come CAPO, non come carta.
 *
 * Prima ogni gruppo era una carta il cui fondo veniva calcolato con
 * `Math.max(70, 100 - indice * 10)`, cioè una rampa di luminanza verso
 * `surface-0` che avrebbe dovuto dire "più vecchia". Non lo diceva: fra
 * un gruppo e il successivo la differenza è del 10% su una superficie già
 * chiarissima, sotto la soglia in cui si legge come intenzione. E in
 * cambio rendeva la CARTA l'unità visibile, invece del testo.
 *
 * Qui la profondità nel tempo la porta un punto del colore del nastro —
 * lo stesso vocabolario dello scaffale e della pastiglia di stato — e il
 * gruppo torna a essere solo un'intestazione con dello spazio sotto.
 */
function GruppoInsight({
  voceId,
  titolo,
  spiegazione,
  colorePunto,
  insightList,
  isOwner,
}: {
  voceId: string;
  titolo: string;
  spiegazione?: string;
  /** `null` per gli orfani: un cerchio vuoto, che non è una lettura. */
  colorePunto: string | null;
  insightList: InsightEssenziale[];
  isOwner: boolean;
}) {
  const [tutti, setTutti] = useState(false);
  if (insightList.length === 0) return null;

  const visibili = tutti ? insightList : insightList.slice(0, PRIMI);
  const nascosti = insightList.length - visibili.length;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 px-0.5 pb-1">
        <span
          aria-hidden
          className={`size-2.5 shrink-0 rounded-full ${
            colorePunto ?? "border-[1.5px] border-line-strong"
          }`}
        />
        <span className="t-section font-medium text-ink-soft">{titolo}</span>
        <span className="t-meta t-num">{insightList.length}</span>
      </div>
      {spiegazione && <p className="t-meta -mt-1.5 px-0.5 pb-1">{spiegazione}</p>}

      {visibili.map((insight) => (
        <UnSoloInsight key={insight.id} voceId={voceId} insight={insight} isOwner={isOwner} />
      ))}

      {nascosti > 0 && (
        <Button variant="quiet" size="testo" className="self-start" onClick={() => setTutti(true)}>
          {nascosti === 1
            ? "Mostra l’altro insight di questa lettura"
            : `Mostra gli altri ${nascosti} insight di questa lettura`}
        </Button>
      )}
    </section>
  );
}

function InsightForm({ voceId }: { voceId: string }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const spiega = useMessaggioErrore();
  const [aperto, setAperto] = useState(false);

  const mutazione = useMutation({
    mutationFn: async (campi: { testo: string; spoiler: boolean; visibilita: Visibilita }) => {
      const token = await getAccessToken();
      const result = await creaInsight(token, voceId, campi.testo, campi.spoiler, campi.visibilita);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      setAperto(false);
    },
    onError: (error: unknown) => {
      showError(spiega("insightNonSalvato", erroreDi(error)));
    },
  });

  if (!aperto) {
    return <Invito onClick={() => setAperto(true)}>Annota un insight</Invito>;
  }

  // I tre valori vivono dentro `ModuloInsight`, che qui si smonta
  // insieme all'invito: chiudere e riaprire dà un modulo pulito senza
  // doverli azzerare a mano dopo il salvataggio.
  return (
    <ModuloInsight
      etichettaSalva="Salva l’insight"
      inCorso={mutazione.isPending}
      onSalva={(campi) => mutazione.mutate(campi)}
      onAnnulla={() => setAperto(false)}
    />
  );
}

/**
 * Gli insight, raggruppati per Lettura come impone il PRD, che lega ogni
 * insight alla lettura in cui è nato.
 *
 * Due cose che prima non c'erano e che sono metà del disordine:
 *
 * - **l'ordine è dichiarato, ed è dal più recente.** Prima i gruppi
 *   scorrevano dalla lettura più vecchia alla più nuova e niente lo
 *   diceva. Un quaderno a cui si torna mostra per prima l'ultima cosa che
 *   ci hai scritto;
 * - **gli orfani vanno in fondo, con un nome.** Prima stavano in cima,
 *   in una carta SENZA titolo: la prima cosa che vedevi era un gruppo di
 *   testi di cui niente spiegava la provenienza. Sono il residuo (scritti
 *   prima di cominciare, o rimasti dopo aver cancellato la lettura a cui
 *   erano legati), quindi stanno alla fine e lo dicono.
 */
export function InsightLista({
  voceId,
  letture,
  insightSenzaLettura,
  isOwner,
}: {
  voceId: string;
  letture: Lettura[];
  insightSenzaLettura: InsightEssenziale[];
  isOwner: boolean;
}) {
  const lingua = useLocale();
  const totale =
    insightSenzaLettura.length + letture.reduce((somma, lettura) => somma + lettura.insight.length, 0);
  if (totale === 0 && !isOwner) return null;

  // Dal più recente. `letture` arriva dal più vecchio.
  const lettureRecenti = [...letture].reverse();

  const puntoLettura = (lettura: Lettura) =>
    lettura.esito === null
      ? "bg-ribbon-reading ring-1 ring-inset ring-surface-2/70"
      : lettura.esito === "abbandonata"
        ? "bg-ribbon-abandoned"
        : "bg-ribbon-done";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3.5">
        <h2 className="t-section text-[0.9375rem]">{isOwner ? "Insight" : "I suoi insight"}</h2>
        {totale > 0 && <span className="t-meta">{totale} · dal più recente</span>}
      </div>

      {isOwner && <InsightForm voceId={voceId} />}

      {totale === 0 ? null : (
        <div className="flex flex-col gap-8">
          {lettureRecenti.map((lettura) => (
            <GruppoInsight
              key={lettura.id}
              voceId={voceId}
              titolo={
                lettura.esito === null
                  ? periodoLettura(lettura, lingua)
                  : `${periodoLettura(lettura, lingua)}` +
                    (lettura.esito === "abbandonata" ? ", abbandonata" : ", conclusa")
              }
              colorePunto={puntoLettura(lettura)}
              insightList={lettura.insight}
              isOwner={isOwner}
            />
          ))}

          <GruppoInsight
            voceId={voceId}
            titolo="Fuori da una lettura"
            spiegazione={
              isOwner
                ? "Scritti prima di cominciare il libro, o rimasti quando hai cancellato la lettura a cui erano legati."
                : undefined
            }
            colorePunto={null}
            insightList={insightSenzaLettura}
            isOwner={isOwner}
          />
        </div>
      )}
    </div>
  );
}
