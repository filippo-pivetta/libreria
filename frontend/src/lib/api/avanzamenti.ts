/**
 * Fetcher per `/letture/{id}/avanzamenti` sul backend FastAPI
 * (registrazione di un Avanzamento — issue #2). Il 409 porta un
 * `errorCode` stabile (`avanzamento_data_futura`,
 * `avanzamento_pagina_regressiva`, ecc. — docs/adr/0015), non un
 * messaggio da fare il parsing.
 */

export type Avanzamento = {
  id: string;
  letturaId: string;
  pagina: number;
  data: string;
  generatoAutomaticamente: boolean;
};

type AvanzamentoBody = {
  id: string;
  lettura_id: string;
  pagina: number;
  data: string;
  generato_automaticamente: boolean;
};

function toAvanzamento(body: AvanzamentoBody): Avanzamento {
  return {
    id: body.id,
    letturaId: body.lettura_id,
    pagina: body.pagina,
    data: body.data,
    generatoAutomaticamente: body.generato_automaticamente,
  };
}

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

export type AvanzamentoResult =
  | { status: "ok"; data: Avanzamento }
  | { status: "not_found" }
  | { status: "non_valido"; errorCode: string; message: string }
  | { status: "error"; message: string };

async function inviaAvanzamento(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<AvanzamentoResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 409) {
    const errorBody = (await response.json()) as ErrorBody;
    const detail = typeof errorBody.detail === "object" ? errorBody.detail : undefined;
    return {
      status: "non_valido",
      errorCode: detail?.error_code ?? "sconosciuto",
      message: detail?.message ?? "Avanzamento non valido.",
    };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  return { status: "ok", data: toAvanzamento((await response.json()) as AvanzamentoBody) };
}

/** POST /letture/{id}/avanzamenti: registra la pagina raggiunta. */
export function registraAvanzamento(
  accessToken: string,
  letturaId: string,
  pagina: number,
  data?: string,
): Promise<AvanzamentoResult> {
  return inviaAvanzamento(accessToken, `/letture/${letturaId}/avanzamenti`, {
    pagina,
    ...(data ? { data } : {}),
  });
}

