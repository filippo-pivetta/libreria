/**
 * Fetcher per `/voci` e `/voci/{id}` sul backend FastAPI (libreria
 * personale e ciclo di lettura, issue #2). Stesse convenzioni di
 * `lib/api/me.ts`: unioni discriminate per ogni esito, mai un'eccezione
 * per il flusso di controllo, mapping snake_case -> camelCase a carico
 * di questo modulo.
 */

import type { Recensione, RecensioneBody } from "@/lib/api/recensioni";
import { toRecensione } from "@/lib/api/recensioni";
import type { InsightEssenziale, InsightEssenzialeBody } from "@/lib/api/insight";
import { toInsightEssenziale } from "@/lib/api/insight";
import { intestazioniConLingua } from "@/lib/lingua";
import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_RETE, erroreDaRisposta, regola } from "@/lib/api/errore";

export type StatoVoce = "da_leggere" | "in_lettura" | "in_pausa" | "abbandonato" | "letto";

export type Autore = {
  id: string;
  nomeCanonico: string;
};

export type StatoCopertina = "in_attesa" | "presente" | "assente" | "fallita";

export type Genere = {
  id: string;
  etichetta: string;
};

export type Libro = {
  id: string;
  titoloCanonico: string;
  annoPrimaPubblicazione: number | null;
  /** Vero quando il valore viene dal modello e non dal catalogo/Wikidata.
   * L'etichetta "dedotto" prevista da design doc §9 è stata costruita e
   * poi tolta dall'interfaccia (emendamento 22 agosto 2026): il campo
   * resta esposto, non più mostrato in scheda. */
  annoDedotto: boolean;
  linguaOriginale: string | null;
  linguaDedotta: boolean;
  /** Fino a tre (PRD), mai correggibili da app: "nessun affordance di
   * modifica" è il messaggio, non solo l'assenza di un comando (design
   * doc §9). */
  generi: Genere[];
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
  /** Variante desaturata di `copertinaColoreDominante` per la stanza
   * scura (design doc §3). Null esattamente quando lo è la prima. */
  copertinaColoreDominanteScuro: string | null;
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
  /** Conteggi, non contenuto: per "Nella tua libreria" ("una recensione,
   * tre insight"). */
  haRecensione: boolean;
  numeroInsight: number;
};

/** Il Libro come arriva alla SCHEDA (`GET /voci/{id}`): quello dello
 * scaffale più la descrizione dell'opera.
 *
 * La separazione rispecchia quella del backend
 * (`app/schemas/voci.py`, `LibroDaScaffale` / `LibroEssenziale`): lo
 * scaffale non disegna la descrizione in nessun punto, e riceverne una
 * per ogni volume della libreria era il pezzo più pesante della
 * risposta della home. Il tipo lo rende un errore di compilazione
 * invece di un campo vuoto scoperto a schermo. */
export type LibroConDescrizione = Libro & {
  /** Solo nella lingua dell'interfaccia, mai un ripiego su un'altra
   * (design doc §9). */
  descrizione: string | null;
  /** Vero quando il testo è stato riformulato dal modello (espanso se
   * troppo corto, accorciato se troppo lungo) a partire dalla
   * descrizione sorgente (design doc §24, emendamento 21 agosto 2026).
   * L'etichetta di trasparenza in scheda è stata costruita e poi tolta
   * dall'interfaccia (emendamento 22 agosto 2026): il campo resta
   * esposto, non più distinto in scheda dalla citazione letterale della
   * fonte. */
  descrizioneRiformulata: boolean;
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
  /** Nulla per una lettura registrata a posteriori: chi segna oggi un
   * libro letto nel 2019 non sa quando l'ha cominciato, e l'app non lo
   * deduce (migrazione 20260827160000). */
  dataInizio: string | null;
  dataFine: string | null;
  /** L'annata di conclusione quando il giorno non si conosce. Si esclude
   * con `dataFine`: al più una delle due è valorizzata. Entrambe nulle
   * su una lettura conclusa significa che non se ne conosce la data —
   * il libro è letto, ma non appartiene ad alcun anno. */
  annoFine: number | null;
  esito: "conclusa" | "abbandonata" | null;
  avanzamenti: Avanzamento[];
  /** Raggruppati per Lettura (design doc §10), gating spoiler già
   * applicato — issue #5. */
  insight: InsightEssenziale[];
};

export type VoceDettaglio = Omit<VoceConLibro, "libro"> & {
  /** Con la descrizione, a differenza della voce di scaffale: è questa
   * pagina a disegnarla (`components/libro/scheda.tsx`). */
  libro: LibroConDescrizione;
  letture: Lettura[];
  /** `null` se non scritta, o se privata e chi guarda non è il
   * proprietario (RLS, non un campo booleano applicativo) — issue #5. */
  recensione: Recensione | null;
  /** Insight non legati a nessuna Lettura: scritti prima di iniziare il
   * libro, o orfani di una Lettura poi cancellata — issue #5. */
  insightSenzaLettura: InsightEssenziale[];
};

type AutoreBody = {
  id: string;
  nome_canonico: string;
};

type GenereBody = {
  id: string;
  etichetta: string;
};

type LibroBody = {
  id: string;
  titolo_canonico: string;
  anno_prima_pubblicazione: number | null;
  anno_dedotto: boolean;
  lingua_originale: string | null;
  lingua_dedotta: boolean;
  generi: GenereBody[];
  copertina_miniatura_url: string | null;
  copertina_grande_url: string | null;
  copertina_colore_dominante: string | null;
  copertina_colore_dominante_scuro: string | null;
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
  ha_recensione: boolean;
  numero_insight: number;
};

type LibroConDescrizioneBody = LibroBody & {
  descrizione: string | null;
  descrizione_riformulata: boolean;
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
  data_inizio: string | null;
  data_fine: string | null;
  anno_fine: number | null;
  esito: "conclusa" | "abbandonata" | null;
  avanzamenti: AvanzamentoBody[];
  insight: InsightEssenzialeBody[];
};

type VoceDettaglioBody = VoceBody & {
  libro: LibroConDescrizioneBody;
  letture: LetturaBody[];
  recensione: RecensioneBody | null;
  insight_senza_lettura: InsightEssenzialeBody[];
};

function toLibro(body: LibroBody): Libro {
  return {
    id: body.id,
    titoloCanonico: body.titolo_canonico,
    annoPrimaPubblicazione: body.anno_prima_pubblicazione,
    annoDedotto: body.anno_dedotto,
    linguaOriginale: body.lingua_originale,
    linguaDedotta: body.lingua_dedotta,
    generi: body.generi.map((genere) => ({ id: genere.id, etichetta: genere.etichetta })),
    copertinaMiniaturaUrl: body.copertina_miniatura_url,
    copertinaGrandeUrl: body.copertina_grande_url,
    copertinaColoreDominante: body.copertina_colore_dominante,
    copertinaColoreDominanteScuro: body.copertina_colore_dominante_scuro,
    copertinaStato: body.copertina_stato,
    autori: body.autori.map((autore) => ({ id: autore.id, nomeCanonico: autore.nome_canonico })),
  };
}

function toLibroConDescrizione(body: LibroConDescrizioneBody): LibroConDescrizione {
  return {
    ...toLibro(body),
    descrizione: body.descrizione,
    descrizioneRiformulata: body.descrizione_riformulata,
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
    haRecensione: body.ha_recensione,
    numeroInsight: body.numero_insight,
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
    annoFine: body.anno_fine,
    esito: body.esito,
    avanzamenti: body.avanzamenti.map(toAvanzamento),
    insight: body.insight.map(toInsightEssenziale),
  };
}

function toVoceDettaglio(body: VoceDettaglioBody): VoceDettaglio {
  return {
    ...toVoce(body),
    libro: toLibroConDescrizione(body.libro),
    letture: body.letture.map(toLettura),
    recensione: body.recensione ? toRecensione(body.recensione) : null,
    insightSenzaLettura: body.insight_senza_lettura.map(toInsightEssenziale),
  };
}

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; errore: ErroreApi } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }
  return { baseUrl };
}

export type VociResult =
  | { status: "ok"; data: VoceConLibro[] }
  | { status: "error"; errore: ErroreApi };

/**
 * GET /voci: lo scaffale, la propria libreria.
 *
 * `acceptLanguage`, opzionale (issue #34): la scelta fra le varianti di
 * titolo/descrizione/etichetta di genere nella lingua dell'interfaccia
 * avviene lato backend (`app/core/lingua.py`) sulla stessa intestazione
 * `Accept-Language`. Dal browser il fetch la manda già da solo — nulla da
 * passare qui; da un Server Component (fetch iniziale della pagina) va
 * inoltrata esplicitamente, perché il fetch del server Next.js non eredita
 * gli header della richiesta in arrivo. Vedi `app/(protected)/page.tsx`.
 */
export async function getVoci(accessToken: string, acceptLanguage?: string): Promise<VociResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci`, {
      headers: intestazioniConLingua(accessToken, acceptLanguage),
      // Dato per-utente, mai cacheato tra richieste o utenti diversi.
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as VoceConLibroBody[];
  return { status: "ok", data: body.map(toVoceConLibro) };
}

export type AggiungiVoceResult =
  | { status: "ok"; data: Voce; alreadyExisted: boolean }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

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
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as { voce: VoceBody; already_existed: boolean };
  return { status: "ok", data: toVoce(body.voce), alreadyExisted: body.already_existed };
}

export type VoceDettaglioResult =
  | { status: "ok"; data: VoceDettaglio }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

/** GET /voci/{id}: la scheda del libro, con Libro e storico delle Letture.
 * `acceptLanguage`, opzionale: vedi il docstring di `getVoci` sopra. */
export async function getVoceDettaglio(
  accessToken: string,
  voceId: string,
  acceptLanguage?: string,
): Promise<VoceDettaglioResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}`, {
      headers: intestazioniConLingua(accessToken, acceptLanguage),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
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
  | { status: "conflitto"; errore: ErroreApi }
  | { status: "error"; errore: ErroreApi };

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
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 409) {
    const errorBody = (await response.json()) as ErrorBody;
    const detail = typeof errorBody.detail === "object" ? errorBody.detail : undefined;
    return { status: "conflitto", errore: regola(detail?.error_code) };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  return { status: "ok", data: toVoce((await response.json()) as VoceBody) };
}

/** Quanto si sa della data in cui il libro è stato finito. Serve solo a
 * «l'ho già letto», la lettura registrata a posteriori: chi segna oggi un
 * libro letto anni fa sa il giorno, o solo l'anno, o niente, e l'app non
 * riempie i buchi al posto suo. `giorno` è il comportamento di sempre per
 * ogni altra transizione. */
export type PrecisioneChiusura = "giorno" | "anno" | "ignota";

/** PATCH /voci/{id}/stato: l'unica transizione ammessa dallo stato
 * corrente (design doc §9: "l'interfaccia non offre mai una transizione
 * vietata"), ma il 409 resta gestito qui per difesa in profondità. */
export function cambiaStato(
  accessToken: string,
  voceId: string,
  stato: StatoVoce,
  data?: string,
  precisione: PrecisioneChiusura = "giorno",
  annoFine?: number,
): Promise<ScritturaVoceResult> {
  return patchVoce(accessToken, `/voci/${voceId}/stato`, {
    stato,
    ...(data ? { data } : {}),
    // Si manda solo quando non è il default: un corpo che non la nomina
    // si comporta come prima, ed è quello che fanno tutte le altre
    // transizioni.
    ...(precisione === "giorno" ? {} : { precisione }),
    ...(annoFine !== undefined ? { anno_fine: annoFine } : {}),
  });
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

export type CancellaVoceResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

/** DELETE /voci/{id}: cancella l'intera Voce — letture, avanzamenti,
 * voto, recensione, insight, nota di intenzione, preview personalizzata e
 * indici semantici derivati (issue #33). Stesso schema di risposta di
 * `cancellaLettura` (lib/api/letture.ts). */
export async function cancellaVoce(
  accessToken: string,
  voceId: string,
): Promise<CancellaVoceResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }
  return { status: "ok" };
}
