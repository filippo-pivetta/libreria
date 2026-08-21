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

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }
  return { baseUrl };
}

export type RicercaLocaleResult =
  | { status: "ok"; data: RisultatoLocale[] }
  | { status: "error"; message: string };

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
    return { status: "error", message: "Il backend non è raggiungibile." };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
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
  | { status: "error"; message: string };

/** GET /ricerca/cataloghi: i cataloghi esterni, una riga per opera. */
export async function cercaNeiCataloghi(
  accessToken: string,
  termine: string,
): Promise<RicercaEsternaResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/ricerca/cataloghi?q=${encodeURIComponent(termine)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 503) {
    return { status: "fonte_irraggiungibile" };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as EsternoBody[];
  return { status: "ok", data: body.map(toEsterno) };
}

export type AggiungiDaCatalogoResult =
  | { status: "ok"; libroId: string; voceId: string; giaInLibreria: boolean }
  /** La ricerca è rimasta aperta oltre la durata della cache del back
   * end: quel risultato non è più raggiungibile e va rifatta. */
  | { status: "risultato_scaduto"; message: string }
  | { status: "fonte_irraggiungibile" }
  | { status: "error"; message: string };

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
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 503) {
    return { status: "fonte_irraggiungibile" };
  }
  if (response.status === 409) {
    const errorBody = (await response.json()) as ErrorBody;
    const detail = typeof errorBody.detail === "object" ? errorBody.detail : undefined;
    return {
      status: "risultato_scaduto",
      message: detail?.message ?? "Questo risultato non è più valido. Rifai la ricerca.",
    };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as {
    libro_id: string;
    voce_id: string;
    gia_in_libreria: boolean;
  };
  return {
    status: "ok",
    libroId: body.libro_id,
    voceId: body.voce_id,
    giaInLibreria: body.gia_in_libreria,
  };
}
