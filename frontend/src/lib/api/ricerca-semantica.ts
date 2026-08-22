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
 */

export type TipoContenuto = "insight" | "recensione";

export type RisultatoSemantico = {
  tipoContenuto: TipoContenuto;
  contenutoId: string;
  /** Sempre il testo pieno, spoiler compreso: ogni risultato è già del
   * richiedente, mai di un collegato — la regola 10 protegge da uno
   * spoiler altrui, non da un proprio testo. */
  testo: string;
  /** Il contrassegno resta esposto come informazione, anche se il testo
   * non è nascosto. */
  spoiler: boolean;
  data: string;
  voceId: string;
  libroId: string;
  titolo: string;
  autori: string[];
  copertinaMiniaturaUrl: string | null;
  copertinaColoreDominante: string | null;
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

type RisultatoBody = {
  tipo_contenuto: TipoContenuto;
  contenuto_id: string;
  testo: string;
  spoiler: boolean;
  data: string;
  voce_id: string;
  libro_id: string;
  titolo: string;
  autori: string[];
  copertina_miniatura_url: string | null;
  copertina_colore_dominante: string | null;
};

type Body = { risultati: RisultatoBody[]; indici_incompleti: boolean };

export async function cercaSemantica(
  accessToken: string,
  domanda: string,
): Promise<RicercaSemanticaResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/ricerca/semantica?q=${encodeURIComponent(domanda)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
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
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as Body;
  return {
    status: "ok",
    data: {
      indiciIncompleti: body.indici_incompleti,
      risultati: body.risultati.map((r) => ({
        tipoContenuto: r.tipo_contenuto,
        contenutoId: r.contenuto_id,
        testo: r.testo,
        spoiler: r.spoiler,
        data: r.data,
        voceId: r.voce_id,
        libroId: r.libro_id,
        titolo: r.titolo,
        autori: r.autori,
        copertinaMiniaturaUrl: r.copertina_miniatura_url,
        copertinaColoreDominante: r.copertina_colore_dominante,
      })),
    },
  };
}
