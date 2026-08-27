"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getVoci, type StatoVoce, type VoceConLibro } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { getAccessToken } from "@/lib/api/access-token";
import { nomiAutori } from "@/lib/autori";
import { RIBBON } from "@/lib/ribbon";
import { costruisciElementi, impacchetta, type ShelfItem } from "@/lib/shelf-pack";
import { useContainerWidth, useMisureScaffale } from "@/lib/use-container-width";
import Link from "next/link";

import { Volume } from "@/components/libreria/volume";
import { EmptyShelf } from "@/components/states/empty-shelf";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { Button } from "@/components/ui/button";
import { CampoRicerca } from "@/components/ui/campo-ricerca";
import { IconaPiu } from "@/components/ui/icone";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { useTranslations } from "next-intl";
import { ErroreApp, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

const IN_CORSO = new Set(["in_lettura", "in_pausa"]);

const STATI: { valore: StatoVoce; etichetta: string }[] = [
  { valore: "in_lettura", etichetta: "In lettura" },
  { valore: "in_pausa", etichetta: "In pausa" },
  { valore: "letto", etichetta: "Letto" },
  { valore: "abbandonato", etichetta: "Abbandonato" },
  { valore: "da_leggere", etichetta: "Da leggere" },
];

/**
 * La Libreria: vista unica (design-frontend.md §7). Uno scaffale di copertine
 * con la costa, mensole che si riempiono sulla larghezza reale, fascia delle
 * letture in corso in cima. Filtro testuale su titolo/autore e filtro per
 * stato, entrambi "gratuiti", nessuna chiamata esterna.
 *
 * ---------------------------------------------------------------------------
 * LA TESTATA, RISCRITTA (sessione UI di agosto 2026).
 *
 * Sopra lo scaffale c'erano quattro fasce di comandi: il titolo di pagina con
 * l'azione primaria, il campo col conteggio appeso in coda, cinque pastiglie,
 * e un <details> chiuso — "Chiedi alla libreria" — che teneva dentro ricerca
 * semantica, suggerimenti e sintesi. Misurate, facevano 232 px su desktop e
 * 307 su un telefono: mezza schermata di comandi prima del primo libro.
 *
 * Ora sono tre righe, e ognuna fa un mestiere solo:
 *
 *   1. il campo, che sale in cima e prende la riga che il titolo lasciava
 *      libera, con l'azione primaria accanto. "La tua libreria" non c'è più:
 *      lo dice la voce accesa in barra, e su telefono la linguetta in fondo;
 *   2. le pastiglie, ADDITIVE invece che a sottrazione, col conteggio in fondo
 *      alla stessa riga — che è esattamente ciò che le pastiglie decidono;
 *   3. lo scaffale, che finalmente ha anche lui un'intestazione: prima ce
 *      l'aveva solo la fascia in cima.
 *
 * Il cassetto è sparito: la ricerca dentro i propri scritti e i temi vivono
 * in **Quaderni** (§22), che è una voce di navigazione e non un disclosure di
 * 13 px; i suggerimenti stanno in "Aggiungi un libro" (§13), dove il bisogno
 * è lo stesso — voglio un libro nuovo.
 * ---------------------------------------------------------------------------
 */
export function Scaffale({
  vociIniziali,
  utenteCollegatoId,
}: {
  vociIniziali: VoceConLibro[];
  /** Presente solo sulla pagina /lettori/[id] (design doc §15): la
   * libreria mostrata è quella di un collegato, non la propria — cambia
   * solo da dove arrivano i dati, il rendering sotto resta identico
   * (Volume è già di sola lettura). */
  utenteCollegatoId?: string;
}) {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const [filtroTesto, setFiltroTesto] = useState("");
  // Additivo: l'insieme vuoto vuole dire "tutti", non "nessuno".
  const [statiInclusi, setStatiInclusi] = useState<Set<StatoVoce>>(() => new Set());
  const [containerRef, larghezza] = useContainerWidth<HTMLDivElement>();
  const [sondaRef, misure] = useMisureScaffale();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: utenteCollegatoId ? ["utente-voci", utenteCollegatoId] : ["voci"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (utenteCollegatoId) {
        const result = await getLibreriaCollegato(token, utenteCollegatoId);
        if (result.status === "not_found") {
          throw new Error(t("assenze.utenteInesistente"));
        }
        if (result.status === "non_collegato") {
          // Refetch in background (es. l'altro interrompe il
          // collegamento mentre si sta guardando la sua libreria):
          // ricade sull'ErrorState con lo stesso testo della pagina
          // (design doc §15, mai "sei stato rimosso"/"errore").
          throw new Error(t("assenze.libreriaChiusa"));
        }
        if (result.status === "error") {
          throw new ErroreApp(result.errore);
        }
        return result.voci;
      }
      const result = await getVoci(token);
      if (result.status === "error") {
        throw new ErroreApp(result.errore);
      }
      return result.data;
    },
    initialData: vociIniziali,
    // Un libro appena aggiunto compare come segnaposto tipografico e si
    // riempie quando il lavoro in secondo piano ha recuperato la
    // copertina (design doc §13). Si ricontrolla finché c'è almeno una
    // scheda in attesa, e **si smette da soli** quando non ce n'è più:
    // un intervallo fisso terrebbe sveglia una pagina che non aspetta
    // più nulla. È lo stato osservabile della colonna a dirlo, non la
    // coda dei lavori, che resta chiusa.
    refetchInterval: (query) =>
      query.state.data?.some((voce) => voce.libro.copertinaStato === "in_attesa") ? 5000 : false,
  });

  const filtrate = useMemo(() => {
    const testo = filtroTesto.trim().toLowerCase();
    return data.filter((voce) => {
      if (statiInclusi.size > 0 && !statiInclusi.has(voce.stato)) return false;
      if (!testo) return true;
      const dentroTitolo = voce.libro.titoloCanonico.toLowerCase().includes(testo);
      const dentroAutore = nomiAutori(voce.libro.autori).toLowerCase().includes(testo);
      return dentroTitolo || dentroAutore;
    });
  }, [data, filtroTesto, statiInclusi]);

  function toggleStato(stato: StatoVoce) {
    setStatiInclusi((precedente) => {
      const successivo = new Set(precedente);
      if (successivo.has(stato)) {
        successivo.delete(stato);
      } else {
        successivo.add(stato);
      }
      return successivo;
    });
  }

  if (isPending) {
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroScaffale />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={spiega("libreriaNonCaricata", erroreDi(error))}
        onRetry={() => void refetch()}
      />
    );
  }

  if (data.length === 0) {
    // L'unico disegno concesso in tutta l'app (design doc §18/§4): solo
    // qui, perché senza dorsi non c'è colore in pagina. Non riusa
    // <EmptyState>, pensato per un vicolo cieco generico (es. "nessun
    // libro trovato" più sotto) — questo è l'unico posto con
    // un'illustrazione.
    return (
      <div className="plane-1 grain flex flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:py-16">
        <EmptyShelf className="h-[70px] w-auto text-ink-soft" />
        <p className="max-w-sm text-sm text-ink-soft">
          Puoi datare una lettura a quando è successa davvero, non a oggi: i libri di anni fa
          entrano al loro posto, non nel giorno in cui li registri.
        </p>
        {/* Era `outline` a 32px: il peso più leggero della scala, per la
            sola azione che questa schermata contiene e per il primo gesto
            che un Utente nuovo compie nell'app. La gerarchia dei comandi
            (§9) dice che l'unica azione piena di una zona sta a 44px, e
            qui la zona è la pagina intera. */}
        {!utenteCollegatoId && (
          <Button render={<Link href="/aggiungi" />} nativeButton={false} size="lg" data-icon="inline-start">
            <IconaPiu />
            Aggiungi il primo libro
          </Button>
        )}
      </div>
    );
  }

  // I libri in lettura stanno solo nella fascia in cima: due insiemi
  // distinti, non due viste sugli stessi dati (design doc §7).
  const inCorso = filtrate.filter((voce) => IN_CORSO.has(voce.stato));
  const restoScaffale = filtrate.filter((voce) => !IN_CORSO.has(voce.stato));
  const righe = impacchetta(costruisciElementi(restoScaffale), larghezza, misure);
  const filtroAttivo = filtrate.length !== data.length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Sonda alta zero, larga `--cover-w`: è così che l'impacchettamento
          legge dai token la larghezza che il CSS sta davvero applicando,
          invece di ricopiarne la formula in JavaScript
          (lib/use-container-width.ts). */}
      <div ref={sondaRef} aria-hidden className="h-0 w-(--cover-w) overflow-hidden" />

      {/* 1. IL CAMPO E L'AZIONE.

          Sulla libreria di un collegato l'azione non c'è (non si aggiunge un
          libro a casa d'altri) e il campo prende tutta la riga da solo.

          ---------------------------------------------------------------
          "CERCA" È SPARITO (26 agosto 2026), e con lui la riga a tre.

          Non faceva partire niente che il campo non stesse già facendo: qui
          il filtro è sempre attivo, a ogni battuta (§7, "sempre disponibile,
          nessuna chiamata a nessun modello"). Restava per due argomenti, e
          nessuno dei due regge. Il primo era la simmetria col campo di
          Quaderni: ma quella era simmetria fra due copie dello stesso
          errore, e ora nemmeno Quaderni ce l'ha. Il secondo era vero — su un
          telefono un `submit` chiude la tastiera — e si ottiene senza
          pulsante: `CampoRicerca` è già dentro un `<form role="search">` che
          fa `blur` all'invio, quindi il tastierino di sistema mostra "Cerca"
          e chiuderlo funziona come prima.

          Il conto su 390px era questo: campo + "Cerca" (72px) + "Aggiungi un
          libro" (152px) + due gap = al campo restavano ~110px, cioè sei
          caratteri di titolo. Il bersaglio che non faceva nulla si prendeva
          più spazio del campo che faceva tutto.

          ---------------------------------------------------------------
          DUE RIGHE SOTTO I 640px, UNA SOPRA.

          Impilare campo e azione non è una resa: sono due gesti diversi —
          cercare fra i propri libri, andarne a prendere uno nuovo — e su un
          telefono nessuno dei due deve stringere l'altro. Il campo prende la
          riga intera, l'azione sta sotto a piena larghezza dove il pollice
          la trova. Da 640px in su tornano affiancati, perché lo spazio c'è.

          L'etichetta si accorcia con lo schermo: "Aggiungi un libro" per
          esteso dove c'è posto, "Aggiungi" sotto i 640 — il verbo è la parte
          che porta il significato, e "un libro" in una pagina che è una
          libreria non aggiunge nulla. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <CampoRicerca
          taglia="piena"
          valore={filtroTesto}
          onCambia={setFiltroTesto}
          etichetta="Cerca per titolo o autore"
          segnaposto="Titolo o autore"
          className="min-w-0 flex-1"
        />
        {!utenteCollegatoId && (
          <Button
            render={<Link href="/aggiungi" />}
            nativeButton={false}
            size="lg"
            data-icon="inline-start"
            className="w-full sm:w-auto"
          >
            <IconaPiu />
            <span className="sm:hidden">Aggiungi</span>
            <span className="hidden sm:inline">Aggiungi un libro</span>
          </Button>
        )}
      </div>

      {/* 2. LE PASTIGLIE, ADDITIVE.

          Erano cinque e nascevano tutte accese: si spegneva per escludere.
          Cinque bersagli accesi che nessuno ha toccato dicono "cinque filtri
          applicati" quando non ne è applicato nessuno, e `aria-pressed`
          raccontava all'assistente vocale l'inverso di quel che l'Utente
          crede di fare. Ora nessuna nasce accesa, "Tutti" è lo stato di
          partenza dichiarato invece che dedotto, e le accese si sommano.

          Il conteggio non sta più in coda a questa riga (emendamento 25
          agosto 2026): un numero perenne in mezzo ai comandi si legge come
          un comando anche lui, e questo invece è il RISULTATO dei comandi.
          Ora vive sotto le pastiglie e solo mentre un filtro è attivo —
          vedi il blocco subito dopo la riga. */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Le pastiglie scorrono in orizzontale sotto i 640px invece di andare
            a capo: cinque etichette impilate rubavano una riga intera allo
            scaffale. Ora la riga è tutta loro — il conteggio che le stava in
            coda è uscito di qui — quindi il nastro usa l'intera larghezza.
            `-ml-4 pl-4` fa sì che la prima pastiglia non resti incollata al
            bordo dello schermo mentre si scorre indietro. */}
        <div
          className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:ml-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pl-0"
          role="group"
          aria-label="Filtra per stato"
        >
          <button
            type="button"
            aria-pressed={statiInclusi.size === 0}
            onClick={() => setStatiInclusi(new Set())}
            {...attributiPastiglia}
            className={pastigliaVariants({ taglia: "filtro", acceso: statiInclusi.size === 0 })}
          >
            Tutti
          </button>
          {STATI.map(({ valore, etichetta }) => {
            const attivo = statiInclusi.has(valore);
            const ribbon = RIBBON[valore];
            return (
              <button
                key={valore}
                type="button"
                aria-pressed={attivo}
                onClick={() => toggleStato(valore)}
                {...attributiPastiglia}
                className={pastigliaVariants({ taglia: "filtro", acceso: attivo })}
              >
                <span
                  aria-hidden
                  className={`block h-1.75 w-1.75 rounded-[2px] ${ribbon ? ribbon.colorClass : "border border-line"}`}
                />
                {etichetta}
              </button>
            );
          })}
        </div>
      </div>

      {/* IL CONTEGGIO COMPARE SOLO QUANDO RISPONDE A QUALCOSA.

          Stava in coda alle pastiglie, sempre acceso, e diceva due fatti
          insieme ("26 volumi · 1 in lettura"). Nessuno dei due si guardava:
          il totale della propria libreria non cambia da un giorno all'altro
          e non c'è niente da deciderci sopra, e i libri in lettura sono nella
          fascia qui sotto, che si chiama "In lettura" e si conta guardandola.
          Un numero che nessuno legge occupa comunque una riga e, stando fra i
          comandi, si legge come un comando anche lui.

          Con un filtro attivo, invece, il numero fa un lavoro vero: dice se
          il gesto ha avuto effetto e quanto della libreria si sta guardando.
          Quindi esiste esattamente allora, in `t-meta`, su una riga sua sotto
          le pastiglie — vicino a ciò che descrive, non in mezzo a ciò che lo
          decide — e sparisce appena si torna a "Tutti".

          Stessa regola nelle due librerie, senza eccezioni: in quella di un
          collegato il totale lo dice già la testata (`BarraContesto`, sotto
          il suo nome), nella propria non lo dice nessuno, ed è giusto così.

          (Qui era passato anche un titolo di pagina che diceva il conteggio,
          sulla scia del titolo-anno degli Annali. Non regge: l'anno È il
          soggetto della pagina Annali, mentre un totale è una misura del
          contenuto, non il contenuto — e a corpo 56 gridava un dato che
          nessuno stava cercando. La Libreria resta senza titolo, che è la
          scelta originale di design-frontend.md §7.) */}
      {filtroAttivo && (
        <p className="t-meta t-num">
          {filtrate.length} di {data.length}
        </p>
      )}

      {inCorso.length === 0 && righe.length === 0 ? (
        <EmptyState
          title={
            filtroTesto.trim()
              ? `Nessun libro con “${filtroTesto.trim()}” nel titolo o nell’autore`
              : "Nessun libro con questo stato"
          }
          description="Il tuo scaffale resta intero: hai filtrato, non perso niente."
        />
      ) : (
        <div ref={containerRef} className="flex flex-col gap-10">
          {inCorso.length > 0 && (
            <section aria-label="Letture in corso" className="flex flex-col gap-3">
              <p className="t-label">In lettura</p>
              <div className="reading-band pb-1">
                {inCorso.map((voce) => (
                  <Volume key={voce.id} voce={voce} inFascia />
                ))}
              </div>
              <div className="shelf-board" />
            </section>
          )}

          {/* Prima solo la fascia in cima portava la sua etichetta, e le
              mensole sotto — cioè la libreria — non ne avevano nessuna
              visibile: due sezioni sorelle, una annunciata e una no. */}
          {righe.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="t-label">Tutta la libreria</p>
              <div className="flex flex-col gap-7">
                {righe.map((riga, indice) => (
                  <div key={indice} className="flex flex-col gap-0">
                    <div className="shelf-row">
                      {riga.map((item: ShelfItem) =>
                        item.type === "tick" ? (
                          <div key={item.key} className="shelf-tick" aria-hidden>
                            <span>{item.letter}</span>
                          </div>
                        ) : (
                          <Volume key={item.key} voce={item.voce} />
                        ),
                      )}
                    </div>
                    <div className="shelf-board" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
