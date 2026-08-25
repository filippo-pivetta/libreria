/**
 * Fetcher per `GET /ricerca/semantica` (issue #6): la ricerca dentro i
 * propri insight e le proprie recensioni.
 *
 * Un `status` in più rispetto agli altri fetcher — `consenso_revocato` —
 * e non è un dettaglio implementativo: il PRD impone che l'interfaccia
 * dichiari la funzione disattivata "invece di restituire zero risultati
 * come se non ci fosse nulla da trovare". Se questo modulo appiattisse il
 * 409 su un errore generico, la pagina non potrebbe più distinguere "non
 * hai scritto nulla al riguardo" da "l'hai spenta tu".
 *
 * **Il risultato è uno `Scritto`**, lo stesso tipo che esce da `/scritti`
 * (`lib/api/scritti.ts`), con in più la miniatura della copertina che
 * questo endpoint firma già. Non è un tipo parallelo che gli somiglia:
 * chiedere e sfogliare sono due lenti sulla stessa materia, e la carta
 * che le mostra è la stessa carta (design doc §22). Due tipi gemelli si
 * sarebbero separati alla prima aggiunta a uno dei due.
 *
 * **I filtri passano di qui**, e sono gli stessi di `/scritti`: una
 * pastiglia premuta non può restringere in un modo quando sfogli e in un
 * altro quando chiedi. Il backend li applica dentro `cerca_semantico`,
 * prima del taglio ai venti più vicini — a valle darebbero elenchi vuoti
 * che si leggono come "non hai scritto nulla al riguardo".
 */

import {
  parametriFiltri,
  toScritto,
  type FiltriScritti,
  type Scritto,
  type ScrittoBody,
  type TipoContenuto,
} from "@/lib/api/scritti";

export type { TipoContenuto };

export type RisultatoSemantico = Scritto & {
  copertinaMiniaturaUrl: string | null;
};

export type RicercaSemantica = {
  risultati: RisultatoSemantico[];
  /** Vero mentre gli indici si stanno ricostruendo dopo una
   * riattivazione del consenso: la pagina deve dirlo. */
  indiciIncompleti: boolean;
};

export type RicercaSemanticaResult =
  | { status: "ok"; data: RicercaSemantica }
  | { status: "consenso_revocato" }
  | { status: "error"; message: string };

type RisultatoBody = ScrittoBody & { copertina_miniatura_url: string | null };

type Body = { risultati: RisultatoBody[]; indici_incompleti: boolean };

export async function cercaSemantica(
  accessToken: string,
  domanda: string,
  filtri: FiltriScritti = {},
): Promise<RicercaSemanticaResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return {
      status: "error",
      message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza.",
    };
  }

  const params = parametriFiltri(filtri);
  params.set("q", domanda);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/ricerca/semantica?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 409) {
    return { status: "consenso_revocato" };
  }

  if (response.status === 503) {
    return {
      status: "error",
      message: "La ricerca semantica non è disponibile in questo momento.",
    };
  }

  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as Body;
  return {
    status: "ok",
    data: {
      indiciIncompleti: body.indici_incompleti,
      risultati: body.risultati.map((r) => ({
        ...toScritto(r),
        copertinaMiniaturaUrl: r.copertina_miniatura_url,
      })),
    },
  };
}
