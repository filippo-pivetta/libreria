/**
 * Fetcher di `/schede/{fonte}/{id}`: la scheda di un libro che non si ha
 * in libreria, e il parere che ci si può chiedere sopra (design doc §13).
 *
 * Stesse convenzioni di `lib/api/ricerca.ts`: unioni discriminate per ogni
 * esito, mai un'eccezione per il flusso di controllo, mapping snake_case
 * -> camelCase a carico di questo modulo.
 *
 * Un modulo suo e non due funzioni in più in `ricerca.ts` perché la carta
 * non è un risultato di ricerca: la ricerca restituisce righe, questa
 * restituisce un libro. Che poi si arrivi qui da lì è un fatto di
 * navigazione, non del contratto.
 */

import type { VoceDelRisultato } from "./ricerca";
import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_MODELLO, ERRORE_RETE, erroreDaRisposta } from "@/lib/api/errore";

export type FonteScheda = "catalogo" | "google";

export type GenereScheda = { id: string; etichetta: string };

export type SchedaPubblica = {
  /** Da dove arrivano i dati — non da dove si è cliccato. Un volume di
   * Google i cui identificativi sono già noti torna con `"catalogo"`: è
   * servito dalla scheda vera, che ha dati migliori, e si aggiunge con il
   * `libroId` invece che con il `volumeId`. */
  fonte: FonteScheda;
  libroId: string | null;
  volumeId: string | null;
  titolo: string;
  autori: string[];
  anno: number | null;
  /** Vero quando `anno` è l'anno di questa *edizione* e non della prima
   * pubblicazione dell'opera: cambia l'etichetta della riga, mai il
   * numero. Confondere i due è l'errore che il PRD vieta. */
  annoDiEdizione: boolean;
  linguaOriginale: string | null;
  pagine: number | null;
  generi: GenereScheda[];
  descrizione: string | null;
  /** `wikipedia` o `google_books`. Fuori dal sistema è sempre la seconda:
   * la prosa di Wikipedia arriva con un lavoro in secondo piano che parte
   * alla nascita della scheda (§21). */
  descrizioneFonte: string | null;
  copertinaUrl: string | null;
  copertinaColoreDominante: string | null;
  copertinaColoreDominanteScuro: string | null;
  voce: VoceDelRisultato | null;
};

type Body = {
  fonte: FonteScheda;
  libro_id: string | null;
  volume_id: string | null;
  titolo: string;
  autori: string[];
  anno: number | null;
  anno_di_edizione: boolean;
  lingua_originale: string | null;
  pagine: number | null;
  generi: GenereScheda[];
  descrizione: string | null;
  descrizione_fonte: string | null;
  copertina_url: string | null;
  copertina_colore_dominante: string | null;
  copertina_colore_dominante_scuro: string | null;
  voce: {
    id: string;
    stato: VoceDelRisultato["stato"];
    voto: number | null;
    pagina_corrente: number | null;
    anno_ultima_lettura: number | null;
  } | null;
};

function toScheda(body: Body): SchedaPubblica {
  return {
    fonte: body.fonte,
    libroId: body.libro_id,
    volumeId: body.volume_id,
    titolo: body.titolo,
    autori: body.autori,
    anno: body.anno,
    annoDiEdizione: body.anno_di_edizione,
    linguaOriginale: body.lingua_originale,
    pagine: body.pagine,
    generi: body.generi,
    descrizione: body.descrizione,
    descrizioneFonte: body.descrizione_fonte,
    copertinaUrl: body.copertina_url,
    copertinaColoreDominante: body.copertina_colore_dominante,
    copertinaColoreDominanteScuro: body.copertina_colore_dominante_scuro,
    voce: body.voce
      ? {
          id: body.voce.id,
          stato: body.voce.stato,
          voto: body.voce.voto,
          paginaCorrente: body.voce.pagina_corrente,
          annoUltimaLettura: body.voce.anno_ultima_lettura,
        }
      : null,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; errore: ErroreApi } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }
  return { baseUrl };
}

export type SchedaResult =
  | { status: "ok"; data: SchedaPubblica }
  | { status: "not_found" }
  /** La fonte non ha risposto. Stato **distinto** da "non esiste", come
   * nella ricerca: senza la distinzione chi guarda conclude che il libro
   * non ci sia mentre è solo il catalogo che non risponde (§13). */
  | { status: "fonte_irraggiungibile" }
  | { status: "error"; errore: ErroreApi };

export async function getScheda(
  accessToken: string,
  fonte: FonteScheda,
  identificativo: string,
  lingua?: string,
): Promise<SchedaResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/schede/${fonte}/${encodeURIComponent(identificativo)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(lingua ? { "Accept-Language": lingua } : {}),
        },
        cache: "no-store",
      },
    );
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) return { status: "not_found" };
  if (response.status === 503) return { status: "fonte_irraggiungibile" };
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }
  return { status: "ok", data: toScheda((await response.json()) as Body) };
}

export type ParereResult =
  | { status: "ok"; testo: string }
  | { status: "not_found" }
  | { status: "consenso_revocato" }
  | { status: "error"; errore: ErroreApi };

/**
 * POST /schede/{fonte}/{id}/parere: "me lo consigli?" su un libro che non
 * si ha in libreria.
 *
 * **Il testo non viene salvato da nessuna parte**, quindi non esiste una
 * `getParere` da chiamare al ritorno sulla pagina: senza una Voce non c'è
 * artefatto a cui legarlo (regola 23 del PRD). Chi ricarica lo chiede di
 * nuovo — e lo sa, perché è lo stesso gesto della prima volta.
 */
export async function chiediParere(
  accessToken: string,
  fonte: FonteScheda,
  identificativo: string,
): Promise<ParereResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/schede/${fonte}/${encodeURIComponent(identificativo)}/parere`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) return { status: "not_found" };
  if (response.status === 409) return { status: "consenso_revocato" };
  if (response.status === 503) {
    return { status: "error", errore: ERRORE_MODELLO };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as { testo: string };
  return { status: "ok", testo: body.testo };
}
