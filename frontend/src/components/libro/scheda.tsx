"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getVoceDettaglio, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaLingua } from "@/lib/formato";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScheda } from "@/components/states/scheletri";
import { Button } from "@/components/ui/button";
import { TestataLibro } from "@/components/libro/testata-libro";
import { BloccoStato } from "@/components/libro/blocco-stato";
import { CorreggiPagine } from "@/components/libro/correggi-pagine";
import { StoricoLetture } from "@/components/libro/storico-letture";
import { VotoStelle } from "@/components/libro/voto-stelle";
import { NotaIntenzione } from "@/components/libro/nota-intenzione";
import { Recensione } from "@/components/libro/recensione";
import { PreviewPersonalizzata } from "@/components/libro/preview-personalizzata";
import { InsightLista } from "@/components/libro/insight-lista";
import { EliminaVoce } from "@/components/libro/elimina-voce";
import { useLocale, useTranslations } from "next-intl";

/**
 * La scheda del libro, in cinque zone su due colonne.
 *
 *   1 TESTATA     copertina, titolo, autori, stato          piena larghezza
 *   ─────────────────────────────────────────────────────────────────────
 *   2 SEGNALIBRO  dove sei. UNA sola azione piena           ┐ colonna 1,
 *     il parere   solo su "da leggere"                      │ riga 1
 *   3 GIUDIZIO    voto, recensione, nota                    ┘
 *   4 IL LIBRO    fatti, generi, "di cosa parla"      colonna 2, sticky
 *                                                     su entrambe le righe
 *   5 LA STORIA   letture e insight                   colonna 1, riga 2
 *
 * Su mobile la griglia collassa e i tre blocchi si stackano nell'ordine
 * del DOM — 2+3, poi 4, poi 5 — che è anche l'ordine di questa lista.
 *
 * **La metafora è "dove sei / cosa ne pensi / cos'è", e parla del
 * lettore**, non dell'oggetto: la vecchia era "il volume aperto, due
 * pagine" — a sinistra l'opera, a destra la tua copia — che faceva della
 * colonna destra un deposito di otto cose senza rapporto fra loro, e su
 * mobile metteva copertina, dati, generi e descrizione intera PRIMA della
 * tua copia.
 *
 * **Perché la storia pesa quanto la colonna principale, ma non è più sua
 * figlia.** L'altezza è ancora la stessa ragione di prima: senza storico
 * e insight la colonna con segnalibro e giudizio resta a ~750px contro i
 * ~950 della laterale con la descrizione aperta, quindi qualunque cosa si
 * metta di lato la supera — è la causa di ogni buco che questa scheda ha
 * avuto, e con la storia a bilanciarla il rapporto torna 1300 contro 950:
 * lo squilibrio non è tappato, è impossibile.
 *
 * Ma la storia non è più DENTRO lo stesso contenitore di segnalibro e
 * giudizio: è un terzo figlio diretto della griglia, fra quel blocco e
 * l'aside. La prima versione la teneva annidata, e su mobile — dove la
 * griglia collassa a una colonna e si stacka nell'ordine del DOM — questo
 * significava che l'INTERO blocco "la tua copia" (storia compresa)
 * veniva prima dell'aside: il libro e la sua descrizione finivano sotto
 * gli insight. Tre figli separati, nell'ordine giusto nel markup — in
 * alto, aside, storia — risolvono la contraddizione: su mobile è
 * semplicemente l'ordine del DOM; da `lg:` in su tornano visivamente
 * dov'erano, con `lg:col-start`/`lg:row-start` espliciti e `row-span-2`
 * sull'aside per restare agganciata all'altezza di ENTRAMBI, non solo del
 * blocco in alto.
 *
 * Ci guadagnano anche gli insight. A 632px la misura interna
 * dell'appunto viene ~68ch e la sentenza ~34ch — il contrasto che §10
 * promette. A piena larghezza erano troppo larghi per il ruolo che hanno.
 *
 * **Perché il libro sta accanto e non sotto.** È il dato condiviso: non è
 * tuo, non lo correggi (il PRD vieta la correzione dei generi a
 * chiunque), e l'unica cosa tua che ci sta dentro — le pagine della tua
 * copia — resta lì perché è un fatto bibliografico, non un avanzamento.
 * Ma è anche il contesto per leggere tutto quello che c'è a sinistra, e
 * mandarlo in fondo alla pagina significava mostrare "pagina 284 di 712"
 * uno schermo prima del 712, che è il solo numero della pagina che si può
 * correggere.
 *
 * **Su mobile l'ordine è quello del DOM**: la tua copia, poi il libro,
 * poi la storia. Nessun `order-*` — quando serve un `order-*` per
 * raddrizzare la gerarchia, di solito un elemento è messo dove non
 * doveva, com'era il caso della storia annidata sopra.
 *
 * Nel contesto di un collegato (`isOwner === false`) sparisce ogni
 * superficie di scrittura, e non resta traccia di dove sarebbe (§15).
 */
export function Scheda({
  voceIniziale,
  currentUserId,
  nellaTuaLibreria,
}: {
  voceIniziale: VoceDettaglio;
  currentUserId: string;
  /** Solo sul libro di un collegato: la carta che agisce sulla TUA
   * libreria. Arriva come slot invece di essere montata qui perché ha
   * bisogno di un fetch lato server (la tua voce su quel libro) che la
   * scheda non fa e non deve fare. */
  nellaTuaLibreria?: React.ReactNode;
}) {
  const t = useTranslations();
  const lingua = useLocale();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["voce", voceIniziale.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getVoceDettaglio(token, voceIniziale.id);
      if (result.status !== "ok") {
        throw new Error(result.status === "not_found" ? t("assenze.voceSparita") : result.message);
      }
      return result.data;
    },
    initialData: voceIniziale,
  });

  if (isPending) {
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroScheda />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t("errori.libroNonCaricato")}
        onRetry={() => void refetch()}
      />
    );
  }

  // È il libro di un collegato, non il mio (issue #3): nessun controllo
  // di scrittura, nessuna traccia di dove sarebbero (§15). `data-guest`
  // attiva l'attenuazione già pronta in tokens.css.
  const isOwner = data.utenteId === currentUserId;

  return (
    <div {...(!isOwner ? { "data-guest": "" } : {})} className="flex flex-col">
      <TestataLibro voce={data} isOwner={isOwner} />

      {/* Tre figli diretti della griglia, non due: `storia` è uscita dalla
          colonna principale per tornare a essere sorella dell'aside,
          perché su mobile l'ordine è quello del DOM e prima aveva sempre
          l'aside dopo di sé (§9: "la storia sta nella colonna principale,
          e regge tutta la pagina" — vale ancora per l'ALTEZZA, l'aside
          resta più corto di main+storia insieme; qui cambia solo CHI è
          figlio diretto).

          Da `lg:` in su i tre tornano nella stessa disposizione visiva di
          prima con un posizionamento esplicito: il blocco in alto e la
          storia occupano la colonna 1 su due righe, l'aside prende
          `row-span-2` sulla colonna 2 — sticky su tutta l'altezza
          combinata, esattamente come quando storia stava dentro lo stesso
          contenitore. Sotto `lg:` queste classi non esistono, quindi resta
          solo l'ordine del DOM: la tua copia, poi il libro, poi la
          storia — la gerarchia che questo ridisegno è nato per
          raddrizzare, questa volta anche sotto gli insight. */}
      <div className="mt-6 grid items-start gap-5 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          {/* Per un collegato l'unico comando della pagina, in cima:
              agisce sulla TUA libreria, non sulla sua. Sta nella colonna
              principale e non di lato perché di lato, su mobile, sarebbe
              finito in fondo alla pagina. */}
          {!isOwner && nellaTuaLibreria}

          <BloccoStato voce={data} isOwner={isOwner} />

          {/* Il parere: l'aiuto a decidere il comando che `BloccoStato`
              offre un centimetro sopra ("Comincia a leggere"), quindi gli
              sta sotto. `decisioneAperta` spegne l'invito negli altri tre
              stati e riduce un parere già chiesto alla forma
              retrospettiva, che resta cancellabile; senza parere non
              compare affatto. */}
          {isOwner && (
            <PreviewPersonalizzata
              voceId={data.id}
              decisioneAperta={data.stato === "da_leggere"}
            />
          )}

          {/* ZONA 3 · il tuo giudizio. Una carta sola: voto, recensione e
              nota sono tre modi di dire la stessa cosa — che cosa ne
              pensi — e prima erano tre blocchi slegati fra un modulo di
              avanzamento e un pulsante di cancellazione. */}
          <section className="plane-1 grain flex flex-col gap-5 p-5 sm:p-6">
            <h2 className="t-section">{isOwner ? "Il tuo giudizio" : "Il suo giudizio"}</h2>
            <VotoStelle voceId={data.id} voto={data.voto} isOwner={isOwner} />
            <Recensione voceId={data.id} recensione={data.recensione} isOwner={isOwner} />
            {isOwner && <NotaIntenzione voceId={data.id} notaIntenzione={data.notaIntenzione} />}
          </section>
        </div>

        {/* ZONA 4 · cos'è il libro. ACCANTO alla tua copia, non sotto:
            è il dato condiviso — non è tuo, non lo correggi (il PRD vieta
            la correzione dei generi a chiunque) — ma è anche il contesto
            per leggere tutto quello che c'è a sinistra, e sotterrarlo in
            fondo alla pagina significava mostrare "pagina 284 di 712"
            uno schermo prima del 712, che è il solo numero qui dentro che
            puoi correggere.

            `sticky` da 1024px in su, `row-span-2` per restare agganciata
            all'altezza combinata di "dove sei" + "la storia": i dati
            dell'opera restano a fianco mentre si scorre tutta la colonna,
            non solo il primo blocco. */}
        <aside className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
          <SchedaOpera voce={data} isOwner={isOwner} lingua={lingua} />
          <DescrizioneOpera descrizione={data.libro.descrizione} />
        </aside>

        {/* ZONA 5 · la storia. Un filetto la separa dal giudizio: sopra
            c'è quello che pensi adesso, sotto quello che è successo. Da
            `lg:` in su torna sotto il giudizio, nella colonna 1: la
            griglia non ha un modo di dire "sotto il fratello precedente"
            se non elencando esplicitamente la riga, quindi `row-start-2`
            lo fa al posto suo. */}
        <div className="flex flex-col gap-8 border-t border-line pt-6 lg:col-start-1 lg:row-start-2">
          <StoricoLetture voceId={data.id} letture={data.letture} isOwner={isOwner} />
          <InsightLista
            voceId={data.id}
            letture={data.letture}
            insightSenzaLettura={data.insightSenzaLettura}
            isOwner={isOwner}
          />
        </div>
      </div>

      {isOwner && (
        <EliminaVoce
          voceId={data.id}
          titoloLibro={data.libro.titoloCanonico}
          numeroLetture={data.letture.length}
          numeroInsight={data.numeroInsight}
          haRecensione={data.haRecensione}
          haNotaIntenzione={data.notaIntenzione !== null}
        />
      )}
    </div>
  );
}

/**
 * I dati dell'opera: **solo fatti in riga**, più i generi.
 *

 * La descrizione vive nella carta accanto (`DescrizioneOpera`, appena
 * sotto nella stessa colonna): questa è fatta di coppie etichetta/valore
 * da scandire con l'occhio, quella è prosa da leggere, e un paragrafo
 * lungo in fondo a un elenco di fatti è fuori posto anche quando ci sta.
 */
function SchedaOpera({
  voce,
  isOwner,
  lingua,
}: {
  voce: VoceDettaglio;
  isOwner: boolean;
  lingua: string;
}) {
  return (
    <section className="plane-1 grain p-5">
      <h2 className="t-section">Il libro</h2>

      <dl className="mt-3.5 flex flex-col">
        <Riga etichetta="Prima pubblicazione">
          {voce.libro.annoPrimaPubblicazione ?? "Sconosciuta"}
        </Riga>
        {voce.libro.linguaOriginale && (
          <Riga etichetta="Lingua originale">
            {formattaLingua(voce.libro.linguaOriginale, lingua)}
          </Riga>
        )}
        <Riga etichetta={isOwner ? "Pagine, tua copia" : "Pagine, sua copia"}>
          {isOwner ? (
            <CorreggiPagine voceId={voce.id} pagineAdottate={voce.pagineAdottate} />
          ) : (
            (voce.pagineAdottate ?? "—")
          )}
        </Riga>
      </dl>

      {voce.libro.generi.length > 0 && (
        // Pastiglie senza alcuna affordance di modifica (§9): il PRD
        // vieta la correzione a qualsiasi utente e non prevede nemmeno
        // una segnalazione. L'assenza di comandi è il messaggio.
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
          {voce.libro.generi.map((genere) => (
            <span key={genere.id} className="t-meta rounded-full border border-line px-3 py-1">
              {genere.etichetta}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * "Di cosa parla": l'abstract dell'opera, in colonna laterale sotto i
 * fatti, tagliato e apribile.
 *
 * È una carta a sé e non un blocco dentro `SchedaOpera` perché sono due
 * cose diverse: là ci sono coppie etichetta/valore da scandire con
 * l'occhio, qui c'è prosa da leggere. Un paragrafo lungo in fondo a un
 * elenco di fatti è fuori posto anche quando ci sta.
 *
 * **Il taglio è tarato sulla colonna, non su una misura ideale.** A 320px
 * una riga di Literata a 15px porta ~37 battute, quindi sei righe sono
 * ~230 caratteri: è lì che sta la soglia. Tararla a 520 — il numero
 * giusto per una misura da 68ch — vorrebbe dire lasciare quattordici
 * righe di seguito prima di offrire il taglio, cioè non tagliare.
 *
 * Aperta può arrivare a una trentina di righe, e non è più un problema:
 * la colonna principale porta anche storico e insight, quindi resta la
 * più lunga delle due in qualunque caso realistico. È la ragione per cui
 * questa descrizione può stare qui e non doveva scendere in fondo alla
 * pagina.
 *
 * L'assenza resta muta: senza abstract non c'è né titolo né carta vuota.
 */
function DescrizioneOpera({ descrizione }: { descrizione: string | null }) {
  const [aperta, setAperta] = useState(false);
  if (!descrizione) return null;

  const lunga = descrizione.length > 230;

  return (
    <section className="plane-1 grain p-5">
      <h2 className="t-section">Di cosa parla</h2>
      <p
        className="t-appunto mt-3"
        style={
          lunga && !aperta
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 6,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {descrizione}
      </p>
      {lunga && !aperta && (
        <Button variant="link" size="sm" className="mt-1.5 px-0" onClick={() => setAperta(true)}>
          Continua a leggere
        </Button>
      )}
    </section>
  );
}

function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <dt className="t-meta">{etichetta}</dt>
      <dd className="t-body text-sm tabular-nums">{children}</dd>
    </div>
  );
}
