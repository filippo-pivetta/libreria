/**
 * Fetcher per `/metriche` e `/utenti/{id}/metriche` sul backend FastAPI
 * (issue #7, PRD entità "Metrica di lettura"). Stesse convenzioni di
 * `lib/api/voci.ts`: unioni discriminate per ogni esito, mapping
 * snake_case -> camelCase a carico di questo modulo, mai un'eccezione
 * per il flusso di controllo.
 */

export type VoceClassifica = {
  id: string;
  nome: string;
  /** Frazionario quando il Libro ha più di un autore/genere (PRD regola
   * 18): 1,5 per un autore su un libro a due autori, non arrotondato a
   * un intero (design-frontend.md §14). */
  peso: number;
};

export type Metriche = {
  anno: number;
  /** Intervallo selezionabile (PRD, comportamento #12): dal primo anno
   * con dati all'anno corrente. Nessun dato -> i due coincidono
   * sull'anno corrente. */
  annoMinimo: number;
  annoMassimo: number;
  libriFiniti: number;
  /** Quante Letture concluse nell'anno sono una rilettura dello stesso
   * Libro: "di cui N riletture" (design-frontend.md §14). */
  riletture: number;
  /** Somma degli incrementi datati nell'anno, mai delle pagine
   * raggiunte (PRD): include anche le Letture non concluse o
   * abbandonate. */
  pagineLette: number;
  autoriPiuLetti: VoceClassifica[];
  generiPrincipali: VoceClassifica[];
  /** Libri finiti nell'anno senza alcun genere assegnato: lo scarto da
   * dichiarare accanto a `generiPrincipali` (design-frontend.md §14). */
  libriSenzaGenere: number;
  /** Governa la spiegazione della divergenza a cavallo d'anno, mostrata
   * solo quando serve (design-frontend.md §14). */
  haLettureACavalloAnno: boolean;
};

type VoceClassificaBody = { id: string; nome: string; peso: number };

type MetricheBody = {
  anno: number;
  anno_minimo: number;
  anno_massimo: number;
  libri_finiti: number;
  riletture: number;
  pagine_lette: number;
  autori_piu_letti: VoceClassificaBody[];
  generi_principali: VoceClassificaBody[];
  libri_senza_genere: number;
  ha_letture_a_cavallo_anno: boolean;
};

function toMetriche(body: MetricheBody): Metriche {
  return {
    anno: body.anno,
    annoMinimo: body.anno_minimo,
    annoMassimo: body.anno_massimo,
    libriFiniti: body.libri_finiti,
    riletture: body.riletture,
    pagineLette: body.pagine_lette,
    autoriPiuLetti: body.autori_piu_letti,
    generiPrincipali: body.generi_principali,
    libriSenzaGenere: body.libri_senza_genere,
    haLettureACavalloAnno: body.ha_letture_a_cavallo_anno,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "NEXT_PUBLIC_API_BASE_URL non è configurato." };
  }
  return { baseUrl };
}

export type MetricheResult =
  | { status: "ok"; data: Metriche }
  // L'anno richiesto è oltre l'anno corrente (PRD: "gli anni futuri non
  // sono selezionabili").
  | { status: "anno_futuro" }
  | { status: "error"; message: string };

/** GET /metriche: le proprie metriche di lettura. `anno` omesso ->
 * l'anno corrente in Europa centrale, deciso dal backend. */
export async function getMetriche(accessToken: string, anno?: number): Promise<MetricheResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  const query = anno !== undefined ? `?anno=${anno}` : "";

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/metriche${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 422) {
    return { status: "anno_futuro" };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as MetricheBody;
  return { status: "ok", data: toMetriche(body) };
}

export type MetricheCollegatoResult =
  | { status: "ok"; data: Metriche }
  | { status: "anno_futuro" }
  // L'utente indicato non esiste.
  | { status: "not_found" }
  // Nessun collegamento attivo: le sue metriche non sono (più)
  // accessibili — stesso trattamento di `getLibreriaCollegato`.
  | { status: "non_collegato" }
  | { status: "error"; message: string };

/** GET /utenti/{id}/metriche: le metriche di un collegato, stesso
 * payload delle proprie. */
export async function getMetricheCollegato(
  accessToken: string,
  utenteId: string,
  anno?: number,
): Promise<MetricheCollegatoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  const query = anno !== undefined ? `?anno=${anno}` : "";

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/utenti/${utenteId}/metriche${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il backend non è raggiungibile." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 403) {
    return { status: "non_collegato" };
  }
  if (response.status === 422) {
    return { status: "anno_futuro" };
  }
  if (!response.ok) {
    return { status: "error", message: `Il backend ha risposto con stato ${response.status}.` };
  }

  const body = (await response.json()) as MetricheBody;
  return { status: "ok", data: toMetriche(body) };
}
