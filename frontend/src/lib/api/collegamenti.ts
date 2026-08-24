/**
 * Fetcher per `/collegamenti` sul backend FastAPI (richieste,
 * accettazione, interruzione — issue #3). Stesse convenzioni di
 * `lib/api/voci.ts`: unioni discriminate per ogni esito, mapping
 * snake_case -> camelCase a carico di questo modulo.
 */

export type StatoCollegamento = "in_attesa" | "attiva";

export type Collegamento = {
  id: string;
  stato: StatoCollegamento;
  richiestoDaMe: boolean;
  altro: { id: string; nomeUtente: string };
  creatoAt: string;
  aggiornatoAt: string;
};

type CollegamentoBody = {
  id: string;
  stato: StatoCollegamento;
  richiesto_da_me: boolean;
  altro: { id: string; nome_utente: string };
  creato_at: string;
  aggiornato_at: string;
};

function toCollegamento(body: CollegamentoBody): Collegamento {
  return {
    id: body.id,
    stato: body.stato,
    richiestoDaMe: body.richiesto_da_me,
    altro: { id: body.altro.id, nomeUtente: body.altro.nome_utente },
    creatoAt: body.creato_at,
    aggiornatoAt: body.aggiornato_at,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }
  return { baseUrl };
}

export type CollegamentiResult =
  | { status: "ok"; data: Collegamento[] }
  | { status: "error"; message: string };

/** GET /collegamenti: richieste ricevute/inviate e collegamenti attivi
 * di chi chiama (design doc §16, sezione Lettori). */
export async function getCollegamenti(accessToken: string): Promise<CollegamentiResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/collegamenti`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as CollegamentoBody[];
  return { status: "ok", data: body.map(toCollegamento) };
}

export type InviaRichiestaResult =
  | { status: "ok"; data: Collegamento; alreadyExisted: boolean }
  | { status: "not_found" }
  | { status: "richiesta_a_se_stessi" }
  | { status: "error"; message: string };

/** POST /collegamenti: invia una richiesta di collegamento a `utenteId`.
 * Idempotente lato backend: una richiesta doppia o simultanea torna la
 * riga già esistente con `alreadyExisted: true`, mai un errore. */
export async function inviaRichiesta(
  accessToken: string,
  utenteId: string,
): Promise<InviaRichiestaResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/collegamenti`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ utente_id: utenteId }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 422) {
    return { status: "richiesta_a_se_stessi" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as { collegamento: CollegamentoBody; already_existed: boolean };
  return { status: "ok", data: toCollegamento(body.collegamento), alreadyExisted: body.already_existed };
}

export type ScritturaCollegamentoResult =
  | { status: "ok"; data: Collegamento }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** PATCH /collegamenti/{id}: accetta una richiesta ricevuta. */
export async function accettaCollegamento(
  accessToken: string,
  collegamentoId: string,
): Promise<ScritturaCollegamentoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/collegamenti/${collegamentoId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  return { status: "ok", data: toCollegamento((await response.json()) as CollegamentoBody) };
}

export type TerminaCollegamentoResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** DELETE /collegamenti/{id}: rifiuta una richiesta ricevuta, ritira una
 * richiesta inviata, o interrompe un collegamento attivo — stessa
 * operazione per tutti e tre i casi applicativi. */
export async function terminaCollegamento(
  accessToken: string,
  collegamentoId: string,
): Promise<TerminaCollegamentoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/collegamenti/${collegamentoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  return { status: "ok" };
}
