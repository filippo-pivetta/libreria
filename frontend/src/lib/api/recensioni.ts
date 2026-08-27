/**
 * Fetcher per `/voci/{id}/recensione` sul backend FastAPI (issue #5).
 * Stesse convenzioni di `lib/api/voci.ts`: unioni discriminate per ogni
 * esito, mapping snake_case -> camelCase a carico di questo modulo.
 */

import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_RETE, erroreDaRisposta } from "@/lib/api/errore";

export type Visibilita = "condiviso" | "privato";

export type Recensione = {
  id: string;
  voceId: string;
  testo: string;
  visibilita: Visibilita;
  creatoAt: string;
  aggiornatoAt: string;
};

export type RecensioneBody = {
  id: string;
  voce_id: string;
  testo: string;
  visibilita: Visibilita;
  creato_at: string;
  aggiornato_at: string;
};

export function toRecensione(body: RecensioneBody): Recensione {
  return {
    id: body.id,
    voceId: body.voce_id,
    testo: body.testo,
    visibilita: body.visibilita,
    creatoAt: body.creato_at,
    aggiornatoAt: body.aggiornato_at,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; errore: ErroreApi } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }
  return { baseUrl };
}

export type ScriviRecensioneResult =
  | { status: "ok"; data: Recensione }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

/** PUT /voci/{id}/recensione: crea se assente, sostituisce se già presente
 * (una recensione per Voce — PRD: "una rilettura non la cancella... la
 * precedente non viene conservata"). */
export async function scriviRecensione(
  accessToken: string,
  voceId: string,
  testo: string,
  visibilita: Visibilita,
): Promise<ScriviRecensioneResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}/recensione`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ testo, visibilita }),
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

  return { status: "ok", data: toRecensione((await response.json()) as RecensioneBody) };
}

export type CancellaRecensioneResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

/** DELETE /voci/{id}/recensione. */
export async function cancellaRecensione(
  accessToken: string,
  voceId: string,
): Promise<CancellaRecensioneResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}/recensione`, {
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
