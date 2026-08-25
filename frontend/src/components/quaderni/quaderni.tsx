"use client";

import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { cercaSemantica } from "@/lib/api/ricerca-semantica";
import {
  getScritti,
  getSfaccettature,
  type FiltriScritti,
  type Scritto,
} from "@/lib/api/scritti";
import type { Tema } from "@/lib/api/sintesi";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { Corpus } from "@/components/quaderni/corpus";
import { FiltriScrittiBarra } from "@/components/quaderni/filtri-scritti";
import { PensieroCheTorna } from "@/components/quaderni/pensiero-che-torna";
import { ScriviPensiero } from "@/components/quaderni/scrivi-pensiero";
import { Temi, filtriDelTema } from "@/components/quaderni/temi";

/** Quanti scritti per volta. Trenta riempiono quindici righe a due
 * colonne: abbastanza da poter scorrere, non tanto da dover aspettare. */
const PAGINA = 30;

/**
 * Quaderni: ciò che l'Utente ha scritto leggendo (design doc §22).
 *
 * ===========================================================================
 * UN CORPUS, TRE LENTI.
 *
 * Fino al ridisegno del 25 agosto 2026 questa pagina non conteneva nulla
 * di proprio. Aveva un campo che interrogava i propri scritti e una
 * sintesi che li riassumeva, e le due regioni si ALTERNAVANO in un
 * ternario: a riposo i temi, dopo una domanda i risultati. Gli scritti
 * veri vivevano solo dentro la scheda del libro. Era, in sostanza,
 * un'interfaccia al modello con un nome da luogo — e la prova era il
 * consenso revocato, che riduceva l'intera pagina a due stati vuoti
 * mentre §5 prometteva l'esatto contrario ("i propri scritti esistono
 * anche a consenso revocato, ed è solo il modo di interrogarli che si
 * spegne").
 *
 * Il modello ora è un altro: **la pagina CONTIENE i propri scritti,
 * sempre**, e le tre lenti ne cambiano ordine e selezione, non
 * l'esistenza.
 *
 *     sfoglia   dal più recente. Nessuna chiamata al fornitore, quindi è
 *               anche l'unica che funziona identica a consenso revocato
 *     chiedi    riordina per vicinanza a una domanda (un embedding)
 *     tema      restringe agli scritti che sostengono un tema (nessuna
 *               chiamata: è un filtro per identificatore)
 *
 * Da qui tre conseguenze che si vedono nel codice qui sotto: c'è UNA
 * sola sorgente di carte (`Corpus`), i filtri valgono per tutte e tre le
 * lenti allo stesso modo, e non esiste più un ramo in cui la pagina
 * mostra un riquadro al posto del contenuto.
 *
 * ===========================================================================
 * LO SLOT SOLLEVATO IN CIMA, e cosa ci sta dentro.
 *
 * Un posto solo, sopra i comandi, che tiene due cose che non coesistono
 * mai: a riposo il pensiero che torna (piano 2, l'oggetto che ti viene
 * messo davanti), mentre si scrive il foglio su cui scrivere (piano 1,
 * la carta). Non due blocchi che si sommano: chi sta scrivendo non ha
 * bisogno di un vecchio pensiero sopra le mani, e chi ha appena posto
 * una domanda non lo vuole sopra la risposta — per questo lo slot
 * sparisce anche quando una lente è accesa.
 *
 * ===========================================================================
 * NON CERCA MENTRE SI DIGITA (§22, invariato): ogni interrogazione è una
 * chiamata al fornitore, e una domanda in linguaggio naturale si
 * finisce di scrivere prima di volerla porre. Cambiare un filtro mentre
 * una domanda è attiva invece RIFÀ la ricerca, ed è voluto: il filtro
 * deve restringere il risultato, non l'elenco già tagliato — ma
 * `staleTime` infinito e nessun refetch al ritorno sulla scheda evitano
 * che una domanda ferma costi due volte.
 */
export function Quaderni() {
  const [domanda, setDomanda] = useState("");
  const [chiesto, setChiesto] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriScritti>({});
  const [tema, setTema] = useState<Tema | null>(null);
  const [scrivendo, setScrivendo] = useState(false);
  const [mostrati, setMostrati] = useState(PAGINA);
  const [errore, setErrore] = useState<string | null>(null);
  const [spenta, setSpenta] = useState(false);

  const lente = chiesto ? "chiedi" : tema ? "tema" : "sfoglia";
  const filtriEffettivi: FiltriScritti = tema ? { ...filtri, ...filtriDelTema(tema) } : filtri;
  const conFiltri =
    !!filtri.tipo || !!filtri.soloSpoiler || filtri.anno != null || !!filtri.voceIds?.length;

  const elenco = useQuery({
    queryKey: ["scritti", "elenco", filtriEffettivi, mostrati],
    enabled: lente !== "chiedi",
    // Le carte precedenti restano finché non arrivano le nuove: senza,
    // ogni tocco di pastiglia svuoterebbe la regione per un istante, e
    // un elenco che sparisce si legge come un elenco che si è azzerato.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const token = await getAccessToken();
      // Una pagina sola che cresce, invece di accodare fette: alla scala
      // del PRD rileggere sessanta righe invece di trenta non si sente,
      // e in cambio non c'è uno stato di pagine da tenere allineato coi
      // filtri quando cambiano.
      const esito = await getScritti(token, filtriEffettivi, { limite: mostrati });
      if (esito.status !== "ok") throw new Error(esito.message);
      return esito.data;
    },
  });

  const ricerca = useQuery({
    queryKey: ["scritti", "ricerca", chiesto, filtri],
    enabled: chiesto !== null,
    // Ogni esecuzione è una chiamata al fornitore: non si rifà da sola
    // tornando sulla scheda, e non scade.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await cercaSemantica(token, chiesto ?? "", filtri);
      if (esito.status === "consenso_revocato") {
        setSpenta(true);
        return { risultati: [] as Scritto[], indiciIncompleti: false };
      }
      if (esito.status !== "ok") throw new Error(esito.message);
      setSpenta(false);
      return esito.data;
    },
  });

  // Quanti scritti esistono in tutto, per dare la scala al conteggio
  // filtrato ("9 di 142"). Viene dalle sfaccettature, che la barra dei
  // filtri sta già leggendo con la stessa chiave: react-query le serve
  // una volta sola, e il totale non filtrato non ha bisogno di una
  // rotta sua — `GET /scritti` risponde sempre della SELEZIONE, ed è
  // giusto che sia così.
  const { data: sfaccettature } = useQuery({
    queryKey: ["scritti", "sfaccettature"],
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await getSfaccettature(token);
      return esito.status === "ok" ? esito.data : { anni: [], libri: [] };
    },
  });
  const totaleCorpus = (sfaccettature?.anni ?? []).reduce((somma, anno) => somma + anno.n, 0);

  const indiciSpenti = spenta || (elenco.data?.indiciSpenti ?? false);
  const scritti: Scritto[] =
    lente === "chiedi" ? (ricerca.data?.risultati ?? []) : (elenco.data?.scritti ?? []);
  const totale = elenco.data?.totale ?? 0;

  function chiedi(evento: FormEvent) {
    evento.preventDefault();
    const testo = domanda.trim();
    if (testo.length < 2) return;
    setErrore(null);
    setTema(null);
    setChiesto(testo);
  }

  function tornaASfogliare() {
    setDomanda("");
    setChiesto(null);
    setTema(null);
    setErrore(null);
    setMostrati(PAGINA);
  }

  function cambiaFiltri(nuovi: FiltriScritti) {
    setFiltri(nuovi);
    setMostrati(PAGINA);
  }

  function apriTema(nuovo: Tema | null) {
    setChiesto(null);
    setDomanda("");
    setTema(nuovo);
    setMostrati(PAGINA);
  }

  function cercaIlTema(daCercare: Tema) {
    setTema(null);
    setDomanda(daCercare.nome);
    setChiesto(daCercare.nome);
  }

  const intestazione =
    lente === "chiedi"
      ? `${scritti.length} ${scritti.length === 1 ? "risultato" : "risultati"} per “${chiesto}”`
      : lente === "tema"
        ? // Non il nome del tema: quello è già l'intestazione che `Temi`
          // scrive sopra, e ripeterlo a due righe di distanza fa
          // sembrare due sezioni ciò che è una sola. Qui serve il
          // numero, che lì non c'è.
          `${totale} ${totale === 1 ? "scritto" : "scritti"} in questo tema`
        : "I tuoi scritti";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="t-display text-[44px] sm:text-[56px]">Quaderni</h1>
        <p className="t-meta max-w-prose">
          Ciò che hai scritto leggendo, in un posto solo. Solo i tuoi testi: quelli dei tuoi
          collegati restano fuori.
        </p>
      </section>

      {scrivendo ? (
        <ScriviPensiero onChiudi={() => setScrivendo(false)} />
      ) : (
        lente === "sfoglia" && <PensieroCheTorna />
      )}

      <section className="flex flex-col gap-4">
        {indiciSpenti ? (
          // Al posto del campo, la dichiarazione — non uno stato vuoto e
          // non un riquadro d'allarme (§19: gli errori sono testo, e
          // questo non è nemmeno un errore). Occupa esattamente il posto
          // della cosa che manca, e l'azione primaria resta al suo.
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <p className="t-meta max-w-prose flex-1 border-b border-line pb-1.5">
              L’elaborazione assistita è spenta: la ricerca per significato e i vicini non sono
              disponibili. Ciò che hai scritto resta qui, e i temi già generati restano leggibili.{" "}
              <a
                href="/profilo"
                className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                Riaccendila dal profilo
              </a>
            </p>
            {!scrivendo && (
              <Button size="lg" onClick={() => setScrivendo(true)}>
                Scrivi un pensiero
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={chiedi} className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1">
              <span className="sr-only">Cosa cerchi</span>
              <input
                type="search"
                value={domanda}
                onChange={(evento) => setDomanda(evento.target.value)}
                placeholder="Che cosa ho scritto sul tempo?"
                aria-label="Cerca nei tuoi quaderni"
                className="field-line w-full border-0 border-b border-line bg-transparent pb-1 font-ui text-base text-ink outline-none placeholder:text-ink-soft"
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              disabled={ricerca.isFetching || domanda.trim().length < 2}
            >
              Cerca
            </Button>
            {!scrivendo && (
              <Button type="button" size="lg" onClick={() => setScrivendo(true)}>
                Scrivi un pensiero
              </Button>
            )}
          </form>
        )}

        <FiltriScrittiBarra filtri={filtri} onCambia={cambiaFiltri} />

        {/* Come sullo scaffale (§7, emendamento 25 agosto 2026): il
            conteggio compare solo quando risponde a un gesto. Senza
            filtri il totale sta nell'intestazione della regione, dove è
            una didascalia dell'elenco e non un comando fra i comandi. */}
        {conFiltri && lente !== "chiedi" && totaleCorpus > 0 && (
          <p className="t-meta t-num">
            {totale} di {totaleCorpus}
          </p>
        )}
      </section>

      <Messaggio>{errore ?? (elenco.error ? "Gli scritti non sono arrivati." : null)}</Messaggio>

      <section className="flex flex-col gap-5 border-t border-line pt-6">
        <Temi temaAperto={tema} onApriTema={apriTema} onCercaTema={cercaIlTema} />

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <p className="t-section">{intestazione}</p>
          {lente === "sfoglia" ? (
            <p className="t-meta">
              <span className="t-num">{totale}</span> · dal più recente
            </p>
          ) : (
            <button
              type="button"
              onClick={tornaASfogliare}
              className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              ‹ Torna a sfogliare
            </button>
          )}
        </div>

        {lente === "chiedi" && ricerca.data?.indiciIncompleti && (
          // Sopra i risultati e non sotto: chi legge un elenco corto deve
          // sapere perché è corto prima di concludere che è tutto.
          <p className="t-meta max-w-prose">
            Gli indici si stanno ricostruendo: questi risultati sono incompleti. Riprova fra
            qualche minuto.
          </p>
        )}

        <Corpus
          scritti={scritti}
          inCorso={lente === "chiedi" ? ricerca.isFetching : elenco.isLoading}
          vuoto={
            lente === "chiedi"
              ? {
                  title: "Nessuna corrispondenza",
                  description: "Non hai ancora scritto nulla che somigli a questa domanda.",
                }
              : conFiltri || lente === "tema"
                ? {
                    title: "Nessuno scritto con questi filtri",
                    description: "I tuoi quaderni restano interi: hai filtrato, non perso niente.",
                  }
                : {
                    title: "Non hai ancora scritto niente",
                    description:
                      "Scrivi un pensiero su un libro che stai leggendo: da qui in poi lo ritrovi sempre.",
                  }
          }
        />

        {lente !== "chiedi" && scritti.length < totale && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setMostrati((quanti) => quanti + PAGINA)}
            disabled={elenco.isFetching}
          >
            Mostra gli altri {totale - scritti.length}
          </Button>
        )}
      </section>
    </div>
  );
}
