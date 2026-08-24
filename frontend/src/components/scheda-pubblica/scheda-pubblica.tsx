"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import {
  getScheda,
  type FonteScheda,
  type SchedaPubblica as Scheda,
} from "@/lib/api/schede";
import type { Risultato } from "@/lib/api/ricerca";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaLingua } from "@/lib/formato";
import { coloreDorso } from "@/lib/spine-color";
import { useAggiungiRisultato } from "@/lib/hooks/use-aggiungi-risultato";
import { Button, buttonVariants } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { ParereEffimero } from "@/components/scheda-pubblica/parere-effimero";
import { cn } from "@/lib/utils";

/**
 * La carta di un libro guardato PRIMA di averlo in libreria (§13).
 *
 * **Stessa carta per tutti i libri, contenuto più magro dove la fonte è
 * più magra.** Il PRD vuole i risultati di ricerca "presentati insieme,
 * senza distinzione": una carta che comparisse solo sulle righe già nel
 * sistema renderebbe visibile proprio la divisione interno/esterno che il
 * prodotto nasconde, e la renderebbe visibile nel modo peggiore —
 * apparentemente arbitraria ("perché di questo libro posso sapere di cosa
 * parla e di quest'altro no?"). Fuori dal sistema mancano lingua
 * originale e prosa di Wikipedia, e la carta semplicemente non le mostra:
 * l'assenza resta muta (§9).
 *
 * **Perché "di cosa parla" sta nella colonna principale e non di lato,
 * al contrario della scheda del libro (§9).** Là la colonna principale è
 * occupata dalla tua copia — segnalibro, giudizio, storia — e la
 * descrizione è il contesto per leggerla. Qui la tua copia non esiste: la
 * descrizione È il contenuto della pagina, ed è la ragione per cui la
 * pagina viene aperta. Lasciarla in 320px di colonna laterale
 * produrrebbe esattamente la "striscia lunga con il vuoto accanto" che
 * §9 rimprovera alla vecchia scheda.
 *
 * **Un solo comando in cima**, come nella riga di ricerca: aggiungere. Se
 * il libro è già in libreria il comando diventa il link alla sua scheda —
 * lì c'è tutto quello che questa carta non può avere.
 */
export function SchedaPubblica({
  schedaIniziale,
  fonte,
  identificativo,
  volumiAlternativi,
}: {
  schedaIniziale: Scheda;
  fonte: FonteScheda;
  identificativo: string;
  /** Le altre edizioni della stessa opera, quando si arriva da una riga di
   * ricerca che le conosceva: servono solo ad aggiungere. */
  volumiAlternativi: string[];
}) {
  const lingua = useLocale();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [errore, setErrore] = useState<string | null>(null);

  const chiave = ["scheda", fonte, identificativo];

  const { data: scheda } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const result = await getScheda(await getAccessToken(), fonte, identificativo);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "error" ? result.message : "Questo libro non è più raggiungibile.",
        );
      }
      return result.data;
    },
    initialData: schedaIniziale,
  });

  const aggiunta = useAggiungiRisultato({
    onSuccess: ({ libroId, voce }) => {
      setErrore(null);
      // Sul posto, come nella ricerca: chi aggiunge non deve perdere la
      // pagina che stava leggendo. Il comando diventa "Vai al libro".
      queryClient.setQueryData<Scheda>(chiave, (precedente) =>
        precedente ? { ...precedente, libroId, voce } : precedente,
      );
    },
    onError: (err) => setErrore(err.message),
  });

  const risultato = comeRisultato(scheda, volumiAlternativi);
  const colore = coloreDorso(scheda.libroId ?? scheda.volumeId ?? scheda.titolo);
  const autori = scheda.autori.join(", ");

  return (
    <div className="flex flex-col py-4">
      <Link href="/aggiungi" className="t-meta mb-4 self-start hover:text-ink">
        Torna alla ricerca
      </Link>

      <header className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-start gap-4 border-b border-line pb-6 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-7 sm:pb-8">
        <div className="cover aspect-[2/3] w-full" style={{ backgroundColor: colore }}>
          {scheda.copertinaUrl && (
            /* <img> piano, non next/image: la miniatura di un libro non
               ancora aggiunto è un'immagine remota di Google, e quella di
               una scheda nostra è un indirizzo firmato — nessuno dei due
               dominio configurabile in anticipo per l'ottimizzatore. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={(elemento) => {
                if (elemento?.complete) elemento.setAttribute("data-loaded", "");
              }}
              src={scheda.copertinaUrl}
              alt=""
              decoding="async"
              onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <p className="cover__placeholder flex items-center justify-center p-3 text-center font-display text-sm leading-snug text-on-accent sm:text-base">
            {scheda.titolo}
          </p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3.5 sm:pt-1">
          <h1 className="t-display text-[1.75rem] sm:text-[2.5rem] lg:text-[2.875rem]">
            {scheda.titolo}
          </h1>
          {autori && <p className="t-body text-ink-soft sm:text-[1.0625rem]">{autori}</p>}

          <div className="mt-1 flex flex-col items-start gap-1.5">
            {scheda.voce ? (
              <Link
                href={`/libro/${scheda.voce.id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Vai al libro
              </Link>
            ) : (
              <Button
                variant="outline"
                disabled={aggiunta.isPending}
                onClick={() => aggiunta.mutate(risultato)}
              >
                {aggiunta.isPending ? t("attesa.aggiungo") : "Aggiungi alla libreria"}
              </Button>
            )}
            <Messaggio>{errore}</Messaggio>
          </div>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-5 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <div className="flex flex-col gap-5">
          <DiCosaParla descrizione={scheda.descrizione} />
          {/* L'identificativo giusto è quello della fonte che ha SERVITO
              la carta, non quello da cui si è arrivati: un volume di
              Google già noto al catalogo torna con `fonte: "catalogo"` e
              il suo `libroId`, e il parere va chiesto su quello. */}
          <ParereEffimero
            fonte={scheda.fonte}
            identificativo={
              (scheda.fonte === "catalogo" ? scheda.libroId : scheda.volumeId) ?? identificativo
            }
            inLibreria={scheda.voce !== null}
          />
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <IlLibro scheda={scheda} lingua={lingua} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Da una scheda pubblica alla riga di risultato che `useAggiungiRisultato`
 * sa aggiungere.
 *
 * Nessuna seconda logica di aggiunta: quale endpoint chiamare — `POST
 * /voci` con un `libroId`, `POST /libri` con un `volumeId` — è una
 * decisione non banale che vive già in un posto solo (l'hook, estratto
 * proprio per questo con l'issue #27). Qui si traduce la forma, non si
 * decide niente.
 */
function comeRisultato(scheda: Scheda, volumiAlternativi: string[]): Risultato {
  if (scheda.libroId) {
    return {
      origine: "locale",
      chiave: `locale:${scheda.libroId}`,
      libroId: scheda.libroId,
      titolo: scheda.titolo,
      autori: scheda.autori,
      annoPrimaPubblicazione: scheda.annoDiEdizione ? null : scheda.anno,
      copertinaUrl: scheda.copertinaUrl,
      copertinaColoreDominante: scheda.copertinaColoreDominante,
      copertinaColoreDominanteScuro: scheda.copertinaColoreDominanteScuro,
      copertinaStato: "assente",
      voce: scheda.voce,
    };
  }
  return {
    origine: "esterno",
    chiave: `esterno:${scheda.volumeId}`,
    volumeId: scheda.volumeId ?? "",
    volumiAlternativi,
    titolo: scheda.titolo,
    autori: scheda.autori,
    annoPubblicazione: scheda.anno,
    copertinaUrl: scheda.copertinaUrl,
    libroId: null,
    voce: null,
  };
}

/**
 * "Di cosa parla": la prosa, a piena misura di lettura.
 *
 * **Il taglio è tarato su questa colonna, non su quella di §9.** Là sei
 * righe stanno in ~230 battute perché la colonna è 320px; qui la misura è
 * ~68ch, dieci righe sono ~700 battute, ed è lì che sta la soglia.
 * Ereditare il numero della colonna laterale significherebbe tagliare
 * dopo due righe e mezzo il testo per cui la pagina è stata aperta.
 *
 * Serve un taglio comunque: fuori dal sistema questa è la quarta di
 * copertina di Google, che per certi libri sono duemila battute di
 * citazioni di giornale. La prosa di Wikipedia, quando c'è, sta quasi
 * sempre sotto la soglia e non viene toccata.
 *
 * L'assenza resta muta: senza descrizione non c'è né titolo né carta.
 */
const SOGLIA_TAGLIO = 700;

function DiCosaParla({ descrizione }: { descrizione: string | null }) {
  const [aperta, setAperta] = useState(false);
  if (!descrizione) return null;

  const lunga = descrizione.length > SOGLIA_TAGLIO;

  return (
    <section className="plane-1 grain p-5 sm:p-6">
      <h2 className="t-section">Di cosa parla</h2>
      <p
        className="t-appunto mt-3 max-w-[68ch]"
        style={
          lunga && !aperta
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 10,
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

/**
 * I fatti dell'opera. Le stesse coppie etichetta/valore della scheda del
 * libro (§9, zona 4), meno quelle che non esistono prima dell'aggiunta.
 *
 * **L'anno cambia etichetta, non numero.** Quello che i cataloghi esterni
 * danno è l'anno di QUESTA edizione: chiamarlo "prima pubblicazione"
 * sarebbe plausibile e sbagliato per ogni classico ristampato, e l'errore
 * passerebbe inosservato — il PRD lo vieta esplicitamente. Le pagine
 * hanno la stessa natura (sono quelle di un'edizione), e per questo la
 * riga dice "pagine, questa edizione" invece di prometterne l'esattezza.
 */
function IlLibro({ scheda, lingua }: { scheda: Scheda; lingua: string }) {
  return (
    <section className="plane-1 grain p-5">
      <h2 className="t-section">Il libro</h2>

      <dl className="mt-3.5 flex flex-col">
        {scheda.anno !== null && (
          <Riga etichetta={scheda.annoDiEdizione ? "Questa edizione" : "Prima pubblicazione"}>
            {scheda.anno}
          </Riga>
        )}
        {scheda.linguaOriginale && (
          <Riga etichetta="Lingua originale">
            {formattaLingua(scheda.linguaOriginale, lingua)}
          </Riga>
        )}
        {scheda.pagine !== null && (
          <Riga etichetta={scheda.annoDiEdizione ? "Pagine, questa edizione" : "Pagine"}>
            {scheda.pagine}
          </Riga>
        )}
      </dl>

      {scheda.generi.length > 0 && (
        // Pastiglie senza affordance di modifica, come in §9: il PRD vieta
        // la correzione dei generi a chiunque.
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
          {scheda.generi.map((genere) => (
            <span key={genere.id} className="t-meta rounded-full border border-line px-3 py-1">
              {genere.etichetta}
            </span>
          ))}
        </div>
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
