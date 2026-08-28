"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancellaArtefatto } from "@/lib/api/preview";
import { generaSintesi, getSintesi, type Tema } from "@/lib/api/sintesi";
import type { FiltriScritti } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { IconaAltro, IconaFreccia } from "@/components/ui/icone";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { Messaggio } from "@/components/ui/messaggio";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ERRORE_SERVER, ErroreApp, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/** I filtri che un tema impone al corpus.
 *
 * Un tema non è un attributo di uno scritto — è un ELENCO di scritti che
 * il modello ha messo insieme — quindi la lente restringe per
 * identificatore, non per proprietà. Il filtro va al server e non al
 * client: i riferimenti di un tema possono essere più vecchi della prima
 * trentina di righe caricate, e filtrare in pagina li perderebbe senza
 * dirlo.
 *
 * Sulle sintesi generate prima del 25 agosto 2026 i riferimenti non
 * portano l'id del contenuto (`lib/api/sintesi.ts`): lì si ricade sui
 * libri del tema, che è più largo ma non è mai sbagliato — e la prima
 * rigenerazione rimette le cose a posto. */
export function filtriDelTema(tema: Tema): FiltriScritti {
  const contenutoIds = tema.riferimenti
    .map((riferimento) => riferimento.contenutoId)
    .filter((id): id is string => id !== null);

  if (contenutoIds.length > 0) return { contenutoIds };
  return { voceIds: [...new Set(tema.riferimenti.map((r) => r.voceId))] };
}

/**
 * I temi che tornano, come LENTE sul corpus (design doc §22).
 *
 * ---------------------------------------------------------------------------
 * ERANO CARTE, ORA SONO PASTIGLIE.
 *
 * Un tema era una carta con dentro nome, frase, libri e — dietro "Mostra
 * gli insight" — un elenco degli scritti che l'avevano prodotto. Cioè un
 * elenco di scritti dentro una carta dentro un elenco di carte, mentre la
 * pagina intorno non conteneva gli scritti affatto. Ora la pagina li
 * contiene: il tema non ha più bisogno di portarseli dietro, gli basta
 * dire QUALI, e il corpus sotto si restringe a quelli.
 *
 * È anche il ponte che mancava fra le due regioni, che prima si
 * alternavano soltanto: da un tema si arriva ai suoi scritti senza
 * passare dal campo di ricerca, e da lì alla ricerca vera con un comando
 * esplicito.
 *
 * ---------------------------------------------------------------------------
 * IL NOME DEL TEMA PORTA IL CARATTERE DEL DISPLAY, non quello dei
 * comandi. Sopra c'è la riga delle pastiglie di filtro in Inter Tight; se
 * i temi avessero lo stesso vestito, la pagina avrebbe due righe di
 * pastiglie che si somigliano e fanno cose diverse — una restringe per un
 * attributo, l'altra apre un'interpretazione. Un tema è un nome che il
 * modello ha scritto, cioè materia della stessa famiglia dei titoli
 * (§4), e prende Fraunces per questo.
 *
 * ---------------------------------------------------------------------------
 * A CONSENSO REVOCATO LA STRISCIA RESTA. Una sintesi già generata è un
 * artefatto dell'Utente (§22: "resta leggibile e cancellabile dal
 * proprietario"), e restringere il corpus sui suoi riferimenti non chiede
 * niente a nessuno — è un confronto fra id, non una chiamata. Sparisce
 * solo "Genera di nuovo".
 */
export function Temi({
  temaAperto,
  onApriTema,
  onCercaTema,
}: {
  temaAperto: Tema | null;
  onApriTema: (tema: Tema | null) => void;
  onCercaTema: (tema: Tema) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const [messaggioVuoto, setMessaggioVuoto] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  // Cancellare una sintesi butta un artefatto che non torna indietro:
  // due tocchi, come per un insight (`libro/insight-lista.tsx`).
  const [confermaCancella, setConfermaCancella] = useState(false);

  const chiave = ["sintesi-tematica"];

  const { data: sintesi } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getSintesi(token);
      if (result.status === "ok") return result.data;
      if (result.status === "not_found") return null;
      throw new ErroreApp(ERRORE_SERVER);
    },
  });

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
      return generaSintesi(token);
    },
    onMutate: () => {
      setErrore(null);
      setMessaggioVuoto(null);
    },
    onSuccess: (result) => {
      if (result.status === "consenso_revocato") {
        setErrore(null);
        return;
      }
      if (result.status === "insight_insufficienti" || result.status === "nessun_tema_rilevante") {
        setMessaggioVuoto(spiega("sintesiNonArrivata", result.errore));
        return;
      }
      if (result.status !== "ok") {
        setErrore(spiega("sintesiNonArrivata", result.status === "not_found" ? undefined : result.errore));
        return;
      }
      onApriTema(null);
      void queryClient.invalidateQueries({ queryKey: chiave });
    },
    onError: (err: unknown) => setErrore(spiega("sintesiNonArrivata", erroreDi(err))),
  });

  const cancella = useMutation({
    mutationFn: async (artefattoId: string) => {
      const token = await getAccessToken();
      const result = await cancellaArtefatto(token, artefattoId);
      if (result.status === "error") throw new ErroreApp(result.errore);
    },
    onSuccess: () => {
      setConfermaCancella(false);
      onApriTema(null);
      void queryClient.invalidateQueries({ queryKey: chiave });
    },
    onError: () => setErrore(t("errori.sintesiNonCancellata")),
  });

  const temi = sintesi?.temi ?? [];
  const spento = consenso === false;

  // Senza sintesi la striscia è una riga sola, non un blocco: a riposo la
  // pagina deve mostrare ciò che si è scritto, non un invito a generare
  // qualcosa. Era il difetto della vecchia regione a riposo, che nasceva
  // con un pulsante e nient'altro.
  if (temi.length === 0) {
    if (spento) return null;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="t-label">Temi</span>
          <Button
            variant="quiet"
            size="testo"
            onClick={() => genera.mutate()}
            disabled={genera.isPending}
          >
            {genera.isPending ? t("attesa.cercoTemi") : "Genera i temi"}
          </Button>
        </div>
        {messaggioVuoto && <p className="t-meta max-w-prose">{messaggioVuoto}</p>}
        <Messaggio>{errore}</Messaggio>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Due contenitori e non uno: il nastro scorre, il menù no. Prima
          erano la stessa riga con `overflow-x-auto`, quindi tutto ciò che
          stava dopo l'ultima pastiglia usciva dallo schermo con lei. */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="-ml-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:ml-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pl-0">
          <span className="t-label shrink-0 pr-1">Temi</span>

          {temi.map((tema, indice) => {
            const attivo = temaAperto?.nome === tema.nome;
            const libri = new Set(tema.riferimenti.map((r) => r.voceId)).size;
            return (
              <button
                key={`${tema.nome}-${indice}`}
                type="button"
                aria-pressed={attivo}
                onClick={() => onApriTema(attivo ? null : tema)}
                {...attributiPastiglia}
                className={pastigliaVariants({ taglia: "tema", acceso: attivo })}
              >
                {/* Il nome si tronca sotto i 640px. Un tema che il modello
                    chiama "La solitudine dei numeri primi e altre forme
                    di distanza" spingeva le pastiglie successive fuori
                    dallo scorrimento utile: il titolo per esteso resta
                    nel `title` e nel pannello che si apre sotto. */}
                <span className="max-w-[16ch] truncate sm:max-w-none" title={tema.nome}>
                  {tema.nome}
                </span>
                <span className={`font-ui text-[11px] ${attivo ? "opacity-70" : "text-ink-soft"}`}>
                  {libri}
                </span>
              </button>
            );
          })}
        </div>

        {/* ERANO DUE COMANDI NUDI IN CODA ALLA STRISCIA, e sbagliavano
            tre cose insieme.

            La prima: stavano DENTRO il nastro che scorre in orizzontale.
            Sotto i 640px "Genera di nuovo" e "Cancella" erano in fondo a
            uno scorrimento, cioè fuori schermo finché non si scorreva
            fino in fondo alle pastiglie — e nulla diceva che ci fossero.
            L'`ml-auto` funziona solo quando la riga avanza spazio, che è
            esattamente il caso in cui il nastro NON scorre.

            La seconda: "Cancella" aveva lo stesso peso di "Genera di
            nuovo". Uno rifà una cosa che si può rifare; l'altro butta un
            artefatto che il modello ha prodotto e che non torna indietro.
            Allo stesso corpo, allo stesso colore, a quattro pixel di
            distanza.

            La terza: erano due, e insieme al comando di ricerca in fondo
            al pannello facevano tre bersagli testuali sottolineati sulla
            stessa striscia.

            Ora è un menù — il posto dove l'app mette già le azioni di
            manutenzione di una riga (`ui/menu.tsx`) — ancorato FUORI dal
            nastro, quindi sempre visibile, e la cancellazione chiede
            conferma prima di partire invece di essere un tocco solo. */}
        {(!spento || sintesi) && (
          <Menu>
            <MenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Azioni sui temi">
                  <IconaAltro />
                </Button>
              }
            />
            <MenuContenuto align="end">
              {!spento && (
                <MenuVoce disabled={genera.isPending} onClick={() => genera.mutate()}>
                  {genera.isPending ? t("attesa.cercoTemi") : "Genera di nuovo"}
                </MenuVoce>
              )}
              {sintesi && (
                <MenuVoce
                  disabled={cancella.isPending}
                  onClick={() => setConfermaCancella(true)}
                >
                  Cancella i temi
                </MenuVoce>
              )}
            </MenuContenuto>
          </Menu>
        )}
      </div>

      {/* La conferma, sul posto e non in una modale: §19, l'app non ne ha.
          Una riga che compare sotto la striscia, con il verbo per esteso
          su un lato e la via d'uscita sull'altro. */}
      {confermaCancella && sintesi && (
        <div className="pannello flex flex-wrap items-center gap-3 rounded-field border border-line bg-surface-2 p-3">
          <span className="t-body min-w-0 flex-1 text-sm">
            I temi sono un artefatto generato: cancellarli non cancella ciò che hai scritto.
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={cancella.isPending}
              onClick={() => cancella.mutate(sintesi.id)}
            >
              Cancella davvero
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfermaCancella(false)}>
              Annulla
            </Button>
          </div>
        </div>
      )}

      {temaAperto && sintesi && (
        <div className="pannello flex flex-col gap-3 border-t border-line pt-5">
          <h2 className="t-title text-[1.625rem]">{temaAperto.nome}</h2>
          <p
            className={
              temaAperto.sintesi.length > 200 ? "t-appunto max-w-prose" : "t-sentenza max-w-[46ch]"
            }
          >
            {temaAperto.sintesi}
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="t-meta">{sintesi.avviso}</span>
            {/* Il ponte che mancava fra le due regioni. Il risultato NON
                coincide con i riferimenti del tema, e va detto: la
                sintesi tiene i sostegni più forti, la ricerca prende
                tutto ciò che è vicino. Sono due lenti diverse, non due
                versioni della stessa. */}
            {/* Il chevron `›` era un glifo di testo in coda all'etichetta:
                un carattere che cambia disegno col carattere di sistema,
                per giunta attaccato a una frase di quaranta battute che
                su un telefono andava a capo lasciandolo orfano su una
                riga sua. Ora l'etichetta dice la cosa in tre parole e la
                freccia è disegnata (`IconaFreccia`, ruotata), come ogni
                altro segno dell'app. */}
            <Button
              variant="quiet"
              size="testo"
              data-icon="inline-end"
              onClick={() => onCercaTema(temaAperto)}
            >
              Cerca ciò che somiglia
              <IconaFreccia aria-hidden className="-rotate-90" />
            </Button>
          </div>
        </div>
      )}

      {messaggioVuoto && <p className="t-meta max-w-prose">{messaggioVuoto}</p>}
      <Messaggio>{errore}</Messaggio>
    </div>
  );
}
