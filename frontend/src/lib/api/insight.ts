/**
 * Fetcher per `/voci/{id}/insight` e `/insight/{id}` sul backend FastAPI
 * (issue #5). Stesse convenzioni di `lib/api/voci.ts`: unioni discriminate
 * per ogni esito, mapping snake_case -> camelCase a carico di questo
 * modulo.
 */

import type { Visibilita } from "@/lib/api/recensioni";

export type { Visibilita };

/** Forma annidata in `GET /voci/{id}` (`letture[].insight` e
 * `insightSenzaLettura`): `testo` è `null` se e solo se `spoiler` è vero
 * **e chi guarda non è il proprietario** — un collegato in visione
 * reciproca lo vede tagliato, il proprietario vede sempre il testo pieno
 * (design doc §11, rivisto nell'issue #6: la regola 10 protegge da uno
 * spoiler altrui, non da un proprio testo). Per il collegato, il testo
 * pieno si ottiene solo con `rivelaInsightTesto`, dietro un gesto
 * esplicito. */
export type InsightEssenziale = {
  id: string;
  testo: string | null;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  creatoAt: string;
};

export type InsightEssenzialeBody = {
  id: string;
  testo: string | null;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  creato_at: string;
};

export function toInsightEssenziale(body: InsightEssenzialeBody): InsightEssenziale {
  return {
    id: body.id,
    testo: body.testo,
    spoiler: body.spoiler,
    visibilita: body.visibilita,
    data: body.data,
    creatoAt: body.creato_at,
  };
}

/** Eco di una propria scrittura (POST/PATCH): `testo` è sempre valorizzato,
 * non è un elenco o un'anteprima ai fini della regola 10. */
export type Insight = {
  id: string;
  voceId: string;
  letturaId: string | null;
  testo: string;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  creatoAt: string;
};

type InsightBody = {
  id: string;
  voce_id: string;
  lettura_id: string | null;
  testo: string;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  creato_at: string;
};

function toInsight(body: InsightBody): Insight {
  return {
    id: body.id,
    voceId: body.voce_id,
    letturaId: body.lettura_id,
    testo: body.testo,
    spoiler: body.spoiler,
    visibilita: body.visibilita,
    data: body.data,
    creatoAt: body.creato_at,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }
  return { baseUrl };
}

export type InsightResult =
  | { status: "ok"; data: Insight }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** POST /voci/{id}/insight: nessun `letturaId` da passare, il server lo
 * deduce dalla Lettura aperta corrente. */
export async function creaInsight(
  accessToken: string,
  voceId: string,
  testo: string,
  spoiler: boolean,
  visibilita: Visibilita,
): Promise<InsightResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/voci/${voceId}/insight`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ testo, spoiler, visibilita }),
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

  return { status: "ok", data: toInsight((await response.json()) as InsightBody) };
}

/** PATCH /insight/{id}: tutti i campi opzionali, `undefined` vuol dire "non
 * toccare questo campo". */
export async function correggiInsight(
  accessToken: string,
  insightId: string,
  campi: { testo?: string; spoiler?: boolean; visibilita?: Visibilita },
): Promise<InsightResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/insight/${insightId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(campi),
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

  return { status: "ok", data: toInsight((await response.json()) as InsightBody) };
}

export type CancellaInsightResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** DELETE /insight/{id}. */
export async function cancellaInsight(
  accessToken: string,
  insightId: string,
): Promise<CancellaInsightResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/insight/${insightId}`, {
      method: "DELETE",
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

  return { status: "ok" };
}

export type RivelaInsightTestoResult =
  | { status: "ok"; testo: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** GET /insight/{id}/testo: il gesto esplicito di scoprire un insight
 * contrassegnato spoiler (design doc §11, "Taglia per leggere"). */
export async function rivelaInsightTesto(
  accessToken: string,
  insightId: string,
): Promise<RivelaInsightTestoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/insight/${insightId}/testo`, {
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

  const body = (await response.json()) as { testo: string };
  return { status: "ok", testo: body.testo };
}
