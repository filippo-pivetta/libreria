/**
 * Fetcher per `/utenti` sul backend FastAPI (elenco membri e libreria di
 * un collegato, issue #3). Stesse convenzioni di `lib/api/voci.ts`:
 * unioni discriminate per ogni esito, mapping snake_case -> camelCase a
 * carico di questo modulo, mai un'eccezione per il flusso di controllo.
 */

import { toVoceConLibro, type VoceConLibro, type VoceConLibroBody } from "@/lib/api/voci";

export type StatoRelazione = "assente" | "in_attesa" | "attiva";

export type Membro = {
  id: string;
  nomeUtente: string;
  statoRelazione: StatoRelazione;
  /** Significativo solo se statoRelazione === "in_attesa": true se la
   * richiesta l'ha inviata l'altro (accettabile/rifiutabile dalla
   * Torre), false se l'ha inviata chi guarda (solo ritirabile). */
  richiestaRicevuta: boolean;
};

type MembroBody = {
  id: string;
  nome_utente: string;
  stato_relazione: StatoRelazione;
  richiesta_ricevuta: boolean;
};

function toMembro(body: MembroBody): Membro {
  return {
    id: body.id,
    nomeUtente: body.nome_utente,
    statoRelazione: body.stato_relazione,
    richiestaRicevuta: body.richiesta_ricevuta,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }
  return { baseUrl };
}

export type UtentiResult =
  | { status: "ok"; data: Membro[] }
  | { status: "error"; message: string };

/** GET /utenti: l'elenco membri (design doc §16), con lo stato della
 * relazione verso chi chiama. */
export async function getUtenti(accessToken: string): Promise<UtentiResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/utenti`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as MembroBody[];
  return { status: "ok", data: body.map(toMembro) };
}

type LibreriaCollegatoBody = {
  utente: { id: string; nome_utente: string };
  voci: VoceConLibroBody[];
};

export type LibreriaCollegatoResult =
  | { status: "ok"; utente: { id: string; nomeUtente: string }; voci: VoceConLibro[] }
  // L'utente indicato non esiste (path diretto a un id inventato).
  | { status: "not_found" }
  // Nessun collegamento attivo con questo utente: la libreria non è
  // (più) accessibile (design doc §15), da non confondere con una
  // libreria vuota — quella torna "ok" con voci: [].
  | { status: "non_collegato" }
  | { status: "error"; message: string };

/** GET /utenti/{id}/voci: la libreria di un collegato (design doc §15). */
export async function getLibreriaCollegato(
  accessToken: string,
  utenteId: string,
): Promise<LibreriaCollegatoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/utenti/${utenteId}/voci`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 403) {
    return { status: "non_collegato" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as LibreriaCollegatoBody;
  return {
    status: "ok",
    utente: { id: body.utente.id, nomeUtente: body.utente.nome_utente },
    voci: body.voci.map(toVoceConLibro),
  };
}
