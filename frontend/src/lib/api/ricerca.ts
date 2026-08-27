/**
 * Fetcher per `/ricerca/*` e `POST /libri` (ricerca e aggiunta di un
 * libro dai cataloghi). Stesse convenzioni di `lib/api/voci.ts`: unioni
 * discriminate per ogni esito, mai un'eccezione per il flusso di
 * controllo, mapping snake_case -> camelCase a carico di questo modulo.
 *
 * Due fetcher di ricerca e non uno perché hanno costi diversi di un
 * ordine di grandezza: la ricerca locale è una query sul database, quella
 * esterna una chiamata a Google. Il design doc §13 vuole le schede già
 * nel sistema "per prime perché non richiedono una chiamata esterna" —
 * prime nel tempo, non solo nell'ordine — e un fetcher solo sarebbe lento
 * quanto la sua fonte più lenta.
 */

import type { StatoVoce } from "./voci";
import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_LIMITE, ERRORE_RETE, erroreDaRisposta, regola } from "@/lib/api/errore";

export type VoceDelRisultato = {
  id: string;
  stato: StatoVoce;
  voto: number | null;
  paginaCorrente: number | null;
  annoUltimaLettura: number | null;
};

/** Una scheda già nel sistema. */
export type RisultatoLocale = {
  origine: "locale";
  chiave: string;
  libroId: string;
  titolo: string;
  autori: string[];
  annoPrimaPubblicazione: number | null;
  copertinaUrl: string | null;
  copertinaColoreDominante: string | null;
  /** Variante desaturata di `copertinaColoreDominante` per la stanza
   * scura (design doc §3). Null esattamente quando lo è la prima. */
  copertinaColoreDominanteScuro: string | null;
  copertinaStato: string;
  voce: VoceDelRisultato | null;
};

/** Un'opera trovata sui cataloghi esterni. */
export type RisultatoEsterno = {
  origine: "esterno";
  chiave: string;
  volumeId: string;
  volumiAlternativi: string[];
  titolo: string;
  autori: string[];
  /** Anno di questa *edizione*, non di prima pubblicazione dell'opera. */
  annoPubblicazione: number | null;
  copertinaUrl: string | null;
  /** Valorizzato quando gli identificativi di questo risultato sono già
   * nel catalogo locale: la riga si comporta allora come una locale. */
  libroId: string | null;
  voce: VoceDelRisultato | null;
};

export type Risultato = RisultatoLocale | RisultatoEsterno;

type VoceBody = {
  id: string;
  stato: StatoVoce;
  voto: number | null;
  pagina_corrente: number | null;
  anno_ultima_lettura: number | null;
};

type LocaleBody = {
  libro_id: string;
  titolo: string;
  autori: string[];
  anno_prima_pubblicazione: number | null;
  copertina_url: string | null;
  copertina_colore_dominante: string | null;
  copertina_colore_dominante_scuro: string | null;
  copertina_stato: string;
  voce: VoceBody | null;
};

type EsternoBody = {
  volume_id: string;
  volumi_alternativi: string[];
  titolo: string;
  autori: string[];
  anno_pubblicazione: number | null;
  copertina_url: string | null;
  libro_id: string | null;
  voce: VoceBody | null;
};

function toVoce(body: VoceBody | null): VoceDelRisultato | null {
  if (!body) return null;
  return {
    id: body.id,
    stato: body.stato,
    voto: body.voto,
    paginaCorrente: body.pagina_corrente,
    annoUltimaLettura: body.anno_ultima_lettura,
  };
}

function toLocale(body: LocaleBody): RisultatoLocale {
  return {
    origine: "locale",
    // La chiave identifica la riga nella lista fusa, per rattoppare il
    // risultato giusto dopo un'aggiunta senza rifare le query.
    chiave: `locale:${body.libro_id}`,
    libroId: body.libro_id,
    titolo: body.titolo,
    autori: body.autori,
    annoPrimaPubblicazione: body.anno_prima_pubblicazione,
    copertinaUrl: body.copertina_url,
    copertinaColoreDominante: body.copertina_colore_dominante,
    copertinaColoreDominanteScuro: body.copertina_colore_dominante_scuro,
    copertinaStato: body.copertina_stato,
    voce: toVoce(body.voce),
  };
}

function toEsterno(body: EsternoBody): RisultatoEsterno {
  return {
    origine: "esterno",
    chiave: `esterno:${body.volume_id}`,
    volumeId: body.volume_id,
    volumiAlternativi: body.volumi_alternativi,
    titolo: body.titolo,
    autori: body.autori,
    annoPubblicazione: body.anno_pubblicazione,
    copertinaUrl: body.copertina_url,
    libroId: body.libro_id,
    voce: toVoce(body.voce),
  };
}

/** Una riga di «I titoli che tornano» (design doc §13): mai un tuo
 * libro, mai con una Voce — da qui si va alla scheda, non si aggiunge. */
export type TitoloPopolare = {
  libroId: string;
  titolo: string;
  autori: string[];
  annoPrimaPubblicazione: number | null;
  copertinaUrl: string | null;
  copertinaColoreDominante: string | null;
  copertinaColoreDominanteScuro: string | null;
  copertinaStato: string;
  /** Mediana di catalogo: dà alla costa sulla mensola uno spessore vero
   * invece che uniforme, per un libro senza Voce da cui prenderlo. */
  pagineMedianeCatalogo: number | null;
};

type PopolareBody = {
  libro_id: string;
  titolo: string;
  autori: string[];
  anno_prima_pubblicazione: number | null;
  copertina_url: string | null;
  copertina_colore_dominante: string | null;
  copertina_colore_dominante_scuro: string | null;
  copertina_stato: string;
  pagine_mediane_catalogo: number | null;
};

function toPopolare(body: PopolareBody): TitoloPopolare {
  return {
    libroId: body.libro_id,
    titolo: body.titolo,
    autori: body.autori,
    annoPrimaPubblicazione: body.anno_prima_pubblicazione,
    copertinaUrl: body.copertina_url,
    copertinaColoreDominante: body.copertina_colore_dominante,
    copertinaColoreDominanteScuro: body.copertina_colore_dominante_scuro,
    copertinaStato: body.copertina_stato,
    pagineMedianeCatalogo: body.pagine_mediane_catalogo,
  };
}

/** 429 non è "il server ha risposto male": è il limitatore di frequenza
 * che protegge la quota dei cataloghi (`LIMITE_CATALOGHI_ESTERNI`), e
 * l'unica cosa da fare è aspettare. Detto con le parole di un guasto,
 * mandava a cercare un problema che non c'è. */

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; errore: ErroreApi } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }
  return { baseUrl };
}

export type RicercaLocaleResult =
  | { status: "ok"; data: RisultatoLocale[] }
  | { status: "error"; errore: ErroreApi };

/** GET /ricerca/catalogo: le schede già nel sistema. Nessuna rete
 * esterna, nessuna quota: è la parte che risponde subito. */
export async function cercaNelCatalogo(
  accessToken: string,
  termine: string,
): Promise<RicercaLocaleResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/ricerca/catalogo?q=${encodeURIComponent(termine)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as LocaleBody[];
  return { status: "ok", data: body.map(toLocale) };
}

export type RicercaEsternaResult =
  | { status: "ok"; data: RisultatoEsterno[] }
  /** La fonte non ha risposto. Stato **distinto** da "nessun risultato":
   * senza questa distinzione chi cerca conclude che il libro non esista
   * mentre è solo il catalogo che non risponde (design doc §13). */
  | { status: "fonte_irraggiungibile" }
  | { status: "error"; errore: ErroreApi };

function attesa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ATTESE_RETRY_ESTERNI_MS = [1000, 2000, 4000];
/** Il backend ritenta già i 5xx transitori di Google (quattro tentativi
 * con attesa crescente, ~2,3 secondi in tutto — vedi
 * `app/cataloghi/google_books.py`): se nonostante quello la rotta torna
 * ancora 503, il disservizio è più serio del solito momento di
 * instabilità. Si ritenta ancora qui, con un'attesa che cresce, prima di
 * dichiarare la fonte irraggiungibile — chi cerca nel frattempo vede
 * "cerco nei cataloghi…" (resta invariato, `isFetching` di React Query
 * copre l'intera funzione) e non un errore su un intoppo che il giro
 * successivo avrebbe risolto. In tutto pochi secondi, non un tentativo
 * infinito: un vero down di Google resta un down, e va dichiarato.*/

/** Ripete `tentativo` finché dichiara di voler riprovare, con le attese
 * di `ATTESE_RETRY_ESTERNI_MS`.
 *
 * Estratta da `cercaNeiCataloghi` per darla anche all'aggiunta, che ne
 * era priva: la ricerca ritentava un 503 quattro volte e l'aggiunta si
 * arrendeva alla prima: la stessa raffica di Google, sulla stessa
 * schermata, a un secondo di distanza, produceva "cerco…" nel primo caso
 * e "i cataloghi non rispondono" nel secondo. Ed è l'aggiunta ad avere
 * più bisogno del retry, non meno: la ricerca fa una chiamata a Google,
 * l'aggiunta ne fa una per volume quando la cache del back end è fredda,
 * quindi ha più occasioni di incontrare la raffica.
 *
 * Ripetere `POST /libri` è sicuro: un 503 nasce dalla lettura dei volumi,
 * prima di qualunque scrittura, e la rotta è comunque idempotente — la
 * scheda si riconosce dai suoi identificativi e la Voce già esistente
 * torna come `gia_in_libreria`, non come una seconda Voce.
 */
async function conRetry<T>(tentativo: () => Promise<{ riprova: boolean; esito: T }>): Promise<T> {
  for (let numero = 0; ; numero++) {
    const { riprova, esito } = await tentativo();
    if (!riprova || numero >= ATTESE_RETRY_ESTERNI_MS.length) return esito;
    await attesa(ATTESE_RETRY_ESTERNI_MS[numero]);
  }
}

/** GET /ricerca/cataloghi: i cataloghi esterni, una riga per opera. */
export async function cercaNeiCataloghi(
  accessToken: string,
  termine: string,
): Promise<RicercaEsternaResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  return conRetry<RicercaEsternaResult>(async () => {
    let response: Response;
    try {
      response = await fetch(
        `${config.baseUrl}/ricerca/cataloghi?q=${encodeURIComponent(termine)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
      );
    } catch {
      return { riprova: false, esito: { status: "error", errore: ERRORE_RETE } };
    }

    if (response.status === 503) {
      return { riprova: true, esito: { status: "fonte_irraggiungibile" } };
    }
    if (response.status === 429) {
      return { riprova: false, esito: { status: "error", errore: ERRORE_LIMITE } };
    }
    if (!response.ok) {
      return { riprova: false, esito: { status: "error", errore: erroreDaRisposta(response) } };
    }

    const body = (await response.json()) as EsternoBody[];
    return { riprova: false, esito: { status: "ok", data: body.map(toEsterno) } };
  });
}

export type RicercaPopolariResult =
  | { status: "ok"; data: TitoloPopolare[] }
  | { status: "error"; errore: ErroreApi };

/** GET /ricerca/popolari: «I titoli che tornano». Nessun termine, nessuna
 * quota esterna — una sola query aggregata sul nostro database. */
export async function cercaPopolari(
  accessToken: string,
  limite = 12,
): Promise<RicercaPopolariResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/ricerca/popolari?limite=${limite}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as PopolareBody[];
  return { status: "ok", data: body.map(toPopolare) };
}

export type AggiungiDaCatalogoResult =
  | { status: "ok"; libroId: string; voceId: string; giaInLibreria: boolean }
  /** La ricerca è rimasta aperta oltre la durata della cache del back
   * end: quel risultato non è più raggiungibile e va rifatta. */
  | { status: "risultato_scaduto"; errore: ErroreApi }
  | { status: "fonte_irraggiungibile" }
  | { status: "error"; errore: ErroreApi };

/** POST /libri: fa nascere la scheda (se non esiste) e la Voce.
 *
 * Solo per i risultati esterni. Un risultato già nel catalogo locale usa
 * il normale `aggiungiVoce` di `lib/api/voci.ts` con il suo `libroId`,
 * senza passare di qui. */
export async function aggiungiDaCatalogo(
  accessToken: string,
  volumeId: string,
  volumiAlternativi: string[],
): Promise<AggiungiDaCatalogoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  return conRetry<AggiungiDaCatalogoResult>(async () => {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/libri`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ volume_id: volumeId, volumi_alternativi: volumiAlternativi }),
        cache: "no-store",
      });
    } catch {
      return { riprova: false, esito: { status: "error", errore: ERRORE_RETE } };
    }

    if (response.status === 503) {
      return { riprova: true, esito: { status: "fonte_irraggiungibile" } };
    }
    if (response.status === 409) {
      const errorBody = (await response.json()) as ErrorBody;
      const detail = typeof errorBody.detail === "object" ? errorBody.detail : undefined;
      return {
        riprova: false,
        esito: { status: "risultato_scaduto", errore: regola(detail?.error_code ?? "risultato_scaduto") },
      };
    }
    if (response.status === 429) {
      return { riprova: false, esito: { status: "error", errore: ERRORE_LIMITE } };
    }
    if (!response.ok) {
      return { riprova: false, esito: { status: "error", errore: erroreDaRisposta(response) } };
    }

    const body = (await response.json()) as {
      libro_id: string;
      voce_id: string;
      gia_in_libreria: boolean;
    };
    return {
      riprova: false,
      esito: {
        status: "ok",
        libroId: body.libro_id,
        voceId: body.voce_id,
        giaInLibreria: body.gia_in_libreria,
      },
    };
  });
}
