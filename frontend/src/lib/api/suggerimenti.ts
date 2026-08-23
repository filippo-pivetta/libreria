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
  | { status: "contenuto_insufficiente"; message: string }
  | { status: "error"; message: string };

export async function generaSuggerimenti(
  accessToken: string,
  nota?: string | null,
): Promise<SuggerimentiResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
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
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 409) return { status: "consenso_revocato" };
  if (response.status === 422) {
    const body = (await response.json()) as ErrorBody;
    const detail = typeof body.detail === "object" ? body.detail : undefined;
    return {
      status: "contenuto_insufficiente",
      message:
        detail?.message ?? "Aggiungi qualche libro letto o scrivi un insight prima di chiedere suggerimenti.",
    };
  }
  if (response.status === 503) {
    return { status: "error", message: "I suggerimenti non sono arrivati. Riprova fra poco." };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as Body;
  return { status: "ok", data: body.suggerimenti };
}
