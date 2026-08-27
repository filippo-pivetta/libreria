/**
 * Fetcher per /me sul backend FastAPI: il back end è l'unico a leggere o
 * scrivere dati applicativi (docs/adr/0001), il frontend non interroga
 * mai `utente`/`utente_privato` direttamente su Supabase. `getMe` è
 * pensata per un Server Component (usa il token già validato dal
 * layout); `completeAccount` gira invece lato client, subito dopo che
 * l'atterraggio dal link di invito ha stabilito la sessione nel browser
 * (docs/adr/0013) — non esiste ancora un giro server-side a quel punto.
 */

import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_RETE, erroreDaRisposta, regola } from "@/lib/api/errore";
export type IndiciStato = "pronti" | "spenti" | "in_ricostruzione";

export type Me = {
  id: string;
  nomeUtente: string;
  consensoElaborazioneAssistita: boolean;
  consensoAggiornatoAt: string;
  informativaAccettataAt: string | null;
  /** Stato osservabile della ricerca semantica (issue #6): 'pronti'
   * completa, 'spenti' nessun indice esiste, 'in_ricostruzione' il
   * lavoro in secondo piano sta ricostruendo dopo una riattivazione. */
  indiciStato: IndiciStato;
};

export type MeResult =
  | { status: "ok"; data: Me }
  // L'utente è autenticato, ma il Manutentore non ha ancora creato la
  // riga in public.utente/public.utente_privato (ADR 0007).
  | { status: "not_provisioned" }
  | { status: "error"; errore: ErroreApi };

type MeResponseBody = {
  id: string;
  nome_utente: string;
  consenso_elaborazione_assistita: boolean;
  consenso_aggiornato_at: string;
  informativa_accettata_at: string | null;
  indici_stato: IndiciStato;
};

export async function getMe(accessToken: string): Promise<MeResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Dato per-sessione, mai cacheato tra richieste o utenti diversi.
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_provisioned" };
  }

  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as MeResponseBody;
  return { status: "ok", data: toMe(body) };
}

export type CompleteAccountResult =
  | { status: "ok"; data: Me }
  | { status: "nome_utente_in_uso" }
  // Doppio invio dello stesso completamento: non un errore per chi
  // guarda, va trattato come un successo silenzioso (l'account esiste
  // già esattamente come lo si voleva creare).
  | { status: "already_completed" }
  | { status: "validation_error"; errore: ErroreApi }
  | { status: "error"; errore: ErroreApi };

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

export async function completeAccount(
  accessToken: string,
  nomeUtente: string,
): Promise<CompleteAccountResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nome_utente: nomeUtente }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 201) {
    return { status: "ok", data: toMe((await response.json()) as MeResponseBody) };
  }

  if (response.status === 422) {
    return { status: "validation_error", errore: regola("nome_utente_non_valido") };
  }

  if (response.status === 409) {
    const body = (await response.json()) as ErrorBody;
    const errorCode = typeof body.detail === "object" ? body.detail.error_code : undefined;
    if (errorCode === "nome_utente_in_uso") {
      return { status: "nome_utente_in_uso" };
    }
    if (errorCode === "account_gia_completato") {
      return { status: "already_completed" };
    }
  }

  return { status: "error", errore: erroreDaRisposta(response) };
}

function toMe(body: MeResponseBody): Me {
  return {
    id: body.id,
    nomeUtente: body.nome_utente,
    consensoElaborazioneAssistita: body.consenso_elaborazione_assistita,
    consensoAggiornatoAt: body.consenso_aggiornato_at,
    informativaAccettataAt: body.informativa_accettata_at,
    indiciStato: body.indici_stato,
  };
}

export type AggiornaConsensoResult =
  | { status: "ok"; data: Me }
  | { status: "not_provisioned" }
  | { status: "error"; errore: ErroreApi };

/**
 * Accende o spegne l'elaborazione assistita (`PATCH /me/consenso`,
 * issue #6). Un booleano solo, non un consenso per funzione: ADR 0008 ha
 * scartato la granularità perché nella pratica la decisione è una sola,
 * se i propri testi escono o no.
 *
 * Spegnendolo il backend cancella gli indici semantici; riaccendendolo li
 * fa ricostruire in secondo piano. La chiamata torna appena il flag è
 * scritto: la ricostruzione non si aspetta, la ricerca semantica dichiara
 * da sé di essere incompleta finché non è finita.
 */
export async function aggiornaConsenso(
  accessToken: string,
  consenso: boolean,
): Promise<AggiornaConsensoResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me/consenso`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ consenso }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_provisioned" };
  }

  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  return { status: "ok", data: toMe((await response.json()) as MeResponseBody) };
}

export type EliminaAccountResult =
  | { status: "ok" }
  | { status: "conferma_non_corrispondente" }
  | { status: "not_provisioned" }
  | { status: "error"; errore: ErroreApi };

/**
 * Cancellazione self-service dell'account (`DELETE /me`, issue #8, PRD
 * regole 26-29). La conferma (il nome utente digitato) è verificata
 * server-side: questa funzione si limita a trasmetterla, non decide se è
 * corretta.
 */
export async function eliminaAccount(
  accessToken: string,
  confermaNomeUtente: string,
): Promise<EliminaAccountResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conferma_nome_utente: confermaNomeUtente }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 204) {
    return { status: "ok" };
  }

  if (response.status === 404) {
    return { status: "not_provisioned" };
  }

  if (response.status === 400) {
    const body = (await response.json()) as ErrorBody;
    const errorCode = typeof body.detail === "object" ? body.detail.error_code : undefined;
    if (errorCode === "conferma_non_corrispondente") {
      return { status: "conferma_non_corrispondente" };
    }
  }

  return { status: "error", errore: erroreDaRisposta(response) };
}

export type EsportaLibriLettiResult =
  | { status: "ok"; blob: Blob; filename: string }
  | { status: "error"; errore: ErroreApi };

const _NOME_FILE_RIPIEGO = "libri-letti.csv";

function _nomeFileDaHeader(header: string | null): string {
  if (!header) {
    return _NOME_FILE_RIPIEGO;
  }
  const match = /filename="?([^";]+)"?/.exec(header);
  return match ? match[1] : _NOME_FILE_RIPIEGO;
}

/**
 * Esportazione dei libri letti (`GET /me/export/libri-letti`, issue #8,
 * ADR 0011 rivisto): un CSV, nessuna conferma richiesta — non è
 * un'azione distruttiva. Il nome del file arriva da
 * `Content-Disposition` (esposto lato backend via CORS, app/main.py);
 * senza, si ripiega su un nome generico invece di far fallire il
 * download per un dettaglio cosmetico.
 */
export async function esportaLibriLetti(accessToken: string): Promise<EsportaLibriLettiResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me/export/libri-letti`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const blob = await response.blob();
  return { status: "ok", blob, filename: _nomeFileDaHeader(response.headers.get("content-disposition")) };
}
