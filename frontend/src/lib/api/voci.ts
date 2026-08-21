/**
 * Fetcher per `/voci` e `/voci/{id}` sul backend FastAPI (libreria
 * personale e ciclo di lettura, issue #2). Stesse convenzioni di
 * `lib/api/me.ts`: unioni discriminate per ogni esito, mai un'eccezione
 * per il flusso di controllo, mapping snake_case -> camelCase a carico
 * di questo modulo.
 */

export type StatoVoce = "da_leggere" | "in_lettura" | "in_pausa" | "abbandonato" | "letto";

export type Autore = {
  id: string;
  nomeCanonico: string;
};

export type StatoCopertina = "in_attesa" | "presente" | "assente" | "fallita";

export type Libro = {
  id: string;
  titoloCanonico: string;
  annoPrimaPubblicazione: number | null;
  linguaOriginale: string | null;
  /** URL firmato, non il percorso interno: il bucket delle copertine è
   * privato (PRD regola 6) e un percorso da solo non apre nulla. La firma
   * dura sette giorni ed è stabile tra le richieste, così il browser può
   * davvero metterla in cache. */
  copertinaMiniaturaUrl: string | null;
  copertinaGrandeUrl: string | null;
  /** Colore dominante estratto dalla copertina, per ombra e fondo del
   * volume sullo scaffale (design doc §7). Null finché la copertina non è
   * stata recuperata: in quel caso si ricade sul colore derivato dall'id
   * (`lib/spine-color.ts`). */
  copertinaColoreDominante: string | null;
  /** `in_attesa` mentre il lavoro in secondo piano sta recuperando la
   * copertina: è ciò che permette allo scaffale di sapere che vale la
   * pena ricontrollare, invece di aspettare per sempre un'immagine che
   * forse non arriverà. */
  copertinaStato: StatoCopertina;
  autori: Autore[];
};

export type Voce = {
  id: string;
  /** Proprietario della Voce: distingue "è mia" da "è di un collegato"
   * quando la stessa scheda (/libro/[id]) è raggiunta via un collegamento
   * attivo (issue #3). */
  utenteId: string;
  libroId: string;
  stato: StatoVoce;
  pagineAdottate: number | null;
  voto: number | null;
  notaIntenzione: string | null;
  creatoAt: string;
  aggiornatoAt: string;
  /** Pagina dell'ultimo avanzamento della Lettura aperta. Valorizzata solo
   * da GET /voci (filo di avanzamento sulla fascia "in corso", design doc
   * §7): altrove resta null per costruzione della query, non per assenza
   * di dato. */
  paginaCorrente: number | null;
};

export type VoceConLibro = Voce & { libro: Libro };

export type Avanzamento = {
  id: string;
  pagina: number;
  data: string;
  generatoAutomaticamente: boolean;
};

export type Lettura = {
  id: string;
  dataInizio: string;
  dataFine: string | null;
  esito: "conclusa" | "abbandonata" | null;
  avanzamenti: Avanzamento[];
};

export type VoceDettaglio = VoceConLibro & { letture: Lettura[] };

type AutoreBody = {
  id: string;
  nome_canonico: string;
};

type LibroBody = {
  id: string;
  titolo_canonico: string;
  anno_prima_pubblicazione: number | null;
  lingua_originale: string | null;
  copertina_miniatura_url: string | null;
  copertina_grande_url: string | null;
  copertina_colore_dominante: string | null;
  copertina_stato: StatoCopertina;
  autori: AutoreBody[];
};

type VoceBody = {
  id: string;
  utente_id: string;
  libro_id: string;
  stato: StatoVoce;
  pagine_adottate: number | null;
  voto: number | null;
  nota_intenzione: string | null;
  creato_at: string;
  aggiornato_at: string;
  pagina_corrente: number | null;
};

export type VoceConLibroBody = VoceBody & { libro: LibroBody };

type AvanzamentoBody = {
  id: string;
  pagina: number;
  data: string;
  generato_automaticamente: boolean;
};

type LetturaBody = {
  id: string;
  data_inizio: string;
  data_fine: string | null;
  esito: "conclusa" | "abbandonata" | null;
  avanzamenti: AvanzamentoBody[];
};

type VoceDettaglioBody = VoceConLibroBody & { letture: LetturaBody[] };

function toLibro(body: LibroBody): Libro {
  return {
    id: body.id,
    titoloCanonico: body.titolo_canonico,
    annoPrimaPubblicazione: body.anno_prima_pubblicazione,
    linguaOriginale: body.lingua_originale,
    copertinaMiniaturaUrl: body.copertina_miniatura_url,
    copertinaGrandeUrl: body.copertina_grande_url,
    copertinaColoreDominante: body.copertina_colore_dominante,
    copertinaStato: body.copertina_stato,
    autori: body.autori.map((autore) => ({ id: autore.id, nomeCanonico: autore.nome_canonico })),
  };
}

function toVoce(body: VoceBody): Voce {
  return {
    id: body.id,
    utenteId: body.utente_id,
    libroId: body.libro_id,
    stato: body.stato,
    pagineAdottate: body.pagine_adottate,
    voto: body.voto,
    notaIntenzione: body.nota_intenzione,
    creatoAt: body.creato_at,
    aggiornatoAt: body.aggiornato_at,
    paginaCorrente: body.pagina_corrente,
  };
}

export function toVoceConLibro(body: VoceConLibroBody): VoceConLibro {
  return { ...toVoce(body), libro: toLibro(body.libro) };
}

function toAvanzamento(body: AvanzamentoBody): Avanzamento {
  return {
    id: body.id,
    pagina: body.pagina,
    data: body.data,
    generatoAutomaticamente: body.generato_automaticamente,
  };
}

function toLettura(body: LetturaBody): Lettura {
  return {
    id: body.id,
    dataInizio: body.data_inizio,
    dataFine: body.data_fine,
    esito: body.esito,
    avanzamenti: body.avanzamenti.map(toAvanzamento),
  };
}

function toVoceDettaglio(body: VoceDettaglioBody): VoceDettaglio {
  return { ...toVoceConLibro(body), letture: body.letture.map(toLettura) };
}

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }
  return { baseUrl };
}

export type VociResult =
  | { status: "ok"; data: VoceConLibro[] }
  | { status: "error"; message: string };

/** GET /voci: lo scaffale, la propria libreria. */
export async function getVoci(accessToken: string): Promise<VociResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Dato per-utente, mai cacheato tra richieste o utenti diversi.
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as VoceConLibroBody[];
  return { status: "ok", data: body.map(toVoceConLibro) };
}

export type AggiungiVoceResult =
  | { status: "ok"; data: Voce; alreadyExisted: boolean }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** POST /voci: aggiunge un Libro già presente nel catalogo alla propria
 * libreria. Usata dalla fascia "Nella tua libreria" sul libro di un
 * collegato (design doc §15) — non da una ricerca, che è l'issue #4. */
export async function aggiungiVoce(accessToken: string, libroId: string): Promise<AggiungiVoceResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ libro_id: libroId }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as { voce: VoceBody; already_existed: boolean };
  return { status: "ok", data: toVoce(body.voce), alreadyExisted: body.already_existed };
}

export type VoceDettaglioResult =
  | { status: "ok"; data: VoceDettaglio }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** GET /voci/{id}: la scheda del libro, con Libro e storico delle Letture. */
export async function getVoceDettaglio(
  accessToken: string,
  voceId: string,
): Promise<VoceDettaglioResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as VoceDettaglioBody;
  return { status: "ok", data: toVoceDettaglio(body) };
}

export type ScritturaVoceResult =
  | { status: "ok"; data: Voce }
  | { status: "not_found" }
  // "conflitto" copre sia la transizione non ammessa sia il tetto delle
  // pagine adottate: `errorCode` distingue il caso esatto (vedi
  // docs/adr/0015), il chiamante decide come mostrarlo.
  | { status: "conflitto"; errorCode: string; message: string }
  | { status: "error"; message: string };

async function patchVoce(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<ScritturaVoceResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 409) {
    const errorBody = (await response.json()) as ErrorBody;
    const detail = typeof errorBody.detail === "object" ? errorBody.detail : undefined;
    return {
      status: "conflitto",
      errorCode: detail?.error_code ?? "sconosciuto",
      message: detail?.message ?? "La scrittura non è ammessa.",
    };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  return { status: "ok", data: toVoce((await response.json()) as VoceBody) };
}

/** PATCH /voci/{id}/stato: l'unica transizione ammessa dallo stato
 * corrente (design doc §9: "l'interfaccia non offre mai una transizione
 * vietata"), ma il 409 resta gestito qui per difesa in profondità. */
export function cambiaStato(
  accessToken: string,
  voceId: string,
  stato: StatoVoce,
  data?: string,
): Promise<ScritturaVoceResult> {
  return patchVoce(accessToken, `/voci/${voceId}/stato`, data ? { stato, data } : { stato });
}

/** PATCH /voci/{id}/pagine-adottate: correzione del totale (design doc
 * §12, "Correggi il totale"). `pagineAdottate: null` rimuove il totale. */
export function correggiPagine(
  accessToken: string,
  voceId: string,
  pagineAdottate: number | null,
): Promise<ScritturaVoceResult> {
  return patchVoce(accessToken, `/voci/${voceId}/pagine-adottate`, {
    pagine_adottate: pagineAdottate,
  });
}

/** PATCH /voci/{id}/voto: `voto: null` cancella il voto. */
export function correggiVoto(
  accessToken: string,
  voceId: string,
  voto: number | null,
): Promise<ScritturaVoceResult> {
  return patchVoce(accessToken, `/voci/${voceId}/voto`, { voto });
}

/** PATCH /voci/{id}/nota-intenzione: `notaIntenzione: null` la cancella. */
export function correggiNotaIntenzione(
  accessToken: string,
  voceId: string,
  notaIntenzione: string | null,
): Promise<ScritturaVoceResult> {
  return patchVoce(accessToken, `/voci/${voceId}/nota-intenzione`, {
    nota_intenzione: notaIntenzione,
  });
}
