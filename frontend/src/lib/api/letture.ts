/**
 * Fetcher per `/letture/{id}` sul backend FastAPI: la sola cancellazione
 * (qualunque Lettura, aperta o chiusa — vedi `backend/app/services/letture_service.py`).
 * Apertura e chiusura passano da `cambiaStato` (`lib/api/voci.ts`).
 */

import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_RETE, erroreDaRisposta } from "@/lib/api/errore";

export type CancellaLetturaResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; errore: ErroreApi };

export async function cancellaLettura(
  accessToken: string,
  letturaId: string,
): Promise<CancellaLetturaResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/letture/${letturaId}`, {
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
