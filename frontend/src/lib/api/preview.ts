/**
 * Fetcher della preview personalizzata "me lo consigli?" (issue #6).
 *
 * `POST` e non `GET` per generarla: crea un artefatto nella libreria e
 * costa una chiamata al fornitore. `avviso` è un campo della risposta e
 * non una frase dentro il testo — la regola 20 impone che una preview
 * "riporti l'indicazione di essere una sintesi generata", e un campo
 * obbligatorio è l'unico modo perché quell'indicazione non possa mancare.
 */

export type Preview = {
  id: string;
  voceId: string;
  testo: string;
  creatoAt: string;
  avviso: string;
};

type Body = {
  id: string;
  voce_id: string;
  testo: string;
  creato_at: string;
  avviso: string;
};

export type PreviewResult =
  | { status: "ok"; data: Preview }
  | { status: "not_found" }
  | { status: "consenso_revocato" }
  | { status: "error"; message: string };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }
  return { baseUrl };
}

function toPreview(body: Body): Preview {
  return {
    id: body.id,
    voceId: body.voce_id,
    testo: body.testo,
    creatoAt: body.creato_at,
    avviso: body.avviso,
  };
}

async function esito(response: Response): Promise<PreviewResult> {
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 409) return { status: "consenso_revocato" };
  if (response.status === 503) {
    return { status: "error", message: "Il parere non è arrivato. Riprova fra poco." };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }
  return { status: "ok", data: toPreview((await response.json()) as Body) };
}

export async function getPreview(
  accessToken: string,
  voceId: string,
): Promise<PreviewResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  try {
    return await esito(
      await fetch(`${config.baseUrl}/voci/${voceId}/preview`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }
}

export async function generaPreview(
  accessToken: string,
  voceId: string,
): Promise<PreviewResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  try {
    return await esito(
      await fetch(`${config.baseUrl}/voci/${voceId}/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }
}

export type CancellaPreviewResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function cancellaArtefatto(
  accessToken: string,
  artefattoId: string,
): Promise<CancellaPreviewResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/artefatti/${artefattoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) return { status: "not_found" };
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }
  return { status: "ok" };
}
