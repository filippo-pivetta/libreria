/**
 * Fetcher per /me sul backend FastAPI: il back end è l'unico a leggere o
 * scrivere dati applicativi (docs/adr/0001), il frontend non interroga
 * mai `utente`/`utente_privato` direttamente su Supabase. `getMe` è
 * pensata per un Server Component (usa il token già validato dal
 * layout); `completeAccount` gira invece lato client, subito dopo che
 * l'atterraggio dal link di invito ha stabilito la sessione nel browser
 * (docs/adr/0013) — non esiste ancora un giro server-side a quel punto.
 */
export type Me = {
  id: string;
  nomeUtente: string;
  consensoElaborazioneAssistita: boolean;
  consensoAggiornatoAt: string;
  informativaAccettataAt: string | null;
};

export type MeResult =
  | { status: "ok"; data: Me }
  // L'utente è autenticato, ma il Manutentore non ha ancora creato la
  // riga in public.utente/public.utente_privato (ADR 0007).
  | { status: "not_provisioned" }
  | { status: "error"; message: string };

type MeResponseBody = {
  id: string;
  nome_utente: string;
  consenso_elaborazione_assistita: boolean;
  consenso_aggiornato_at: string;
  informativa_accettata_at: string | null;
};

export async function getMe(accessToken: string): Promise<MeResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Dato per-sessione, mai cacheato tra richieste o utenti diversi.
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) {
    return { status: "not_provisioned" };
  }

  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
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
  | { status: "validation_error"; message: string }
  | { status: "error"; message: string };

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

export async function completeAccount(
  accessToken: string,
  nomeUtente: string,
): Promise<CompleteAccountResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
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
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 201) {
    return { status: "ok", data: toMe((await response.json()) as MeResponseBody) };
  }

  if (response.status === 422) {
    return { status: "validation_error", message: "Il nome utente non è valido." };
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

  return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
}

function toMe(body: MeResponseBody): Me {
  return {
    id: body.id,
    nomeUtente: body.nome_utente,
    consensoElaborazioneAssistita: body.consenso_elaborazione_assistita,
    consensoAggiornatoAt: body.consenso_aggiornato_at,
    informativaAccettataAt: body.informativa_accettata_at,
  };
}
