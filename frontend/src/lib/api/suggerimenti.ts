/**
 * Fetcher dei suggerimenti di lettura (issue #27, riscritti il 22
 * agosto 2026 — vedi il docstring di
 * `app/services/suggerimenti_service.py`).
 *
 * `POST` con `nota` facoltativa: come preview e sintesi tematica, ogni
 * chiamata costa una chiamata al fornitore. Nessun campo di persistenza
 * nella risposta — sono effimeri per scelta di prodotto, non un
 * artefatto; la nota stessa non si salva mai, vive nel corpo di questa
 * singola richiesta.
 *
 * Ogni titolo che arriva qui è già verificato contro i cataloghi dal
 * backend (locale poi esterno, sovra-generazione e scarto dei titoli
 * inesistenti): non può più essere un fantasma come "Odio e amore" di
 * "amor di narrazione".
 */

import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_MODELLO, ERRORE_RETE, erroreDaRisposta, regola } from "@/lib/api/errore";

export const NOTA_LUNGHEZZA_MASSIMA = 200;

export type TipoSuggerimento = "affine" | "scoperta";

export type Suggerimento = {
  titolo: string;
  autori: string[];
  motivazione: string;
  tipo: TipoSuggerimento;
};

type Body = { suggerimenti: Suggerimento[] };

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };


export type SuggerimentiResult =
  | { status: "ok"; data: Suggerimento[] }
  | { status: "consenso_revocato" }
  | { status: "letture_insufficienti"; errore: ErroreApi }
  | { status: "error"; errore: ErroreApi };

export async function generaSuggerimenti(
  accessToken: string,
  nota?: string | null,
): Promise<SuggerimentiResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  const notaPulita = nota?.trim() || null;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/suggerimenti`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nota: notaPulita }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 409) return { status: "consenso_revocato" };
  if (response.status === 422) {
    // Solo quando è il backend a nominare la regola
    // (`app/routers/suggerimenti.py`). Lo stesso 422 lo produce la
    // validazione di FastAPI sul corpo — una nota oltre le 200 battute —
    // e leggerlo come "letture insufficienti" diceva a chi guarda che il
    // problema era la sua libreria invece della nota che aveva scritto.
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const detail = typeof body.detail === "object" ? body.detail : undefined;
    if (detail?.error_code === "letture_insufficienti") {
      return { status: "letture_insufficienti", errore: regola("letture_insufficienti") };
    }
    return { status: "error", errore: regola(detail?.error_code) };
  }
  if (response.status === 503) {
    return { status: "error", errore: ERRORE_MODELLO };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as Body;
  return { status: "ok", data: body.suggerimenti };
}
