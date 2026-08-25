"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancellaArtefatto } from "@/lib/api/preview";
import { generaSintesi, getSintesi, type Tema } from "@/lib/api/sintesi";
import type { FiltriScritti } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { Messaggio } from "@/components/ui/messaggio";
import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const [messaggioVuoto, setMessaggioVuoto] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const chiave = ["sintesi-tematica"];

  const { data: sintesi } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getSintesi(token);
      if (result.status === "ok") return result.data;
      if (result.status === "not_found") return null;
      throw new Error(t("errori.sintesiNonLetta"));
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
      if (result.status === "contenuto_insufficiente" || result.status === "nessun_tema_rilevante") {
        setMessaggioVuoto(result.message);
        return;
      }
      if (result.status !== "ok") {
        setErrore(result.status === "not_found" ? "La sintesi non è arrivata." : result.message);
        return;
      }
      onApriTema(null);
      void queryClient.invalidateQueries({ queryKey: chiave });
    },
    onError: () => setErrore("La sintesi non è arrivata. Riprova."),
  });

  const cancella = useMutation({
    mutationFn: async (artefattoId: string) => {
      const token = await getAccessToken();
      const result = await cancellaArtefatto(token, artefattoId);
      if (result.status === "error") throw new Error(result.message);
    },
    onSuccess: () => {
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="t-label">Temi</span>
          <button
            type="button"
            onClick={() => genera.mutate()}
            disabled={genera.isPending}
            className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink disabled:opacity-50"
          >
            {genera.isPending ? t("attesa.cercoTemi") : "Cerca i temi che attraversano i tuoi libri"}
          </button>
        </div>
        {messaggioVuoto && <p className="t-meta max-w-prose">{messaggioVuoto}</p>}
        <Messaggio>{errore}</Messaggio>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-ml-4 flex min-w-0 items-center gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:ml-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pl-0">
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
              className={`inline-flex shrink-0 items-baseline gap-2 rounded-full border px-3.5 py-1.5 font-display text-[0.9375rem] transition-colors duration-(--dur-micro) ${
                attivo
                  ? "border-ink bg-ink text-surface-1"
                  : "border-line bg-surface-1 text-ink hover:border-line-strong"
              }`}
            >
              {tema.nome}
              <span className={`font-ui text-[11px] ${attivo ? "opacity-70" : "text-ink-soft"}`}>
                {libri} {libri === 1 ? "libro" : "libri"}
              </span>
            </button>
          );
        })}

        <span className="ml-auto flex shrink-0 items-baseline gap-4 pl-2">
          {!spento && (
            <button
              type="button"
              onClick={() => genera.mutate()}
              disabled={genera.isPending}
              className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink disabled:opacity-50"
            >
              {genera.isPending ? t("attesa.cercoTemi") : "Genera di nuovo"}
            </button>
          )}
          {sintesi && (
            <button
              type="button"
              onClick={() => cancella.mutate(sintesi.id)}
              disabled={cancella.isPending}
              className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Cancella
            </button>
          )}
        </span>
      </div>

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
            <button
              type="button"
              onClick={() => onCercaTema(temaAperto)}
              className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Cerca tutto ciò che somiglia a questo tema ›
            </button>
          </div>
        </div>
      )}

      {messaggioVuoto && <p className="t-meta max-w-prose">{messaggioVuoto}</p>}
      <Messaggio>{errore}</Messaggio>
    </div>
  );
}
