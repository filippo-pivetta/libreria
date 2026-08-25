/**
 * Fetcher per `/scritti`: il corpus dei Quaderni e le sue lenti
 * (design doc §22).
 *
 * ---------------------------------------------------------------------------
 * PERCHÉ ESISTE UN TIPO SOLO PER TUTTE E TRE LE LENTI.
 *
 * `Scritto` è la forma che esce da tutti e quattro gli endpoint di questa
 * pagina, ed è anche quella che `ricerca-semantica.ts` estende invece di
 * ridichiarare. Non è economia di righe: sfogliare, chiedere e aprire un
 * tema sono tre modi di guardare la STESSA materia, e la carta che li
 * mostra deve essere la stessa carta — piede compreso. Due tipi paralleli
 * si sarebbero separati alla prima aggiunta, e con loro i due componenti.
 *
 * ---------------------------------------------------------------------------
 * NESSUNO STATO `consenso_revocato` SU `getScritti`.
 *
 * A differenza di `cercaSemantica`, questi fetcher non hanno il ramo del
 * 409, perché il backend non lo restituisce: i propri scritti esistono
 * anche a consenso revocato, ed è solo il modo di interrogarli che si
 * spegne (design doc §5). Lo stato arriva dentro la risposta —
 * `indiciSpenti` — perché la pagina lo dichiari restando piena. L'unico
 * fetcher che può dire "sono spenta" è `getVicini`, e lì è vero: senza
 * indici non c'è niente da confrontare.
 */

export type TipoContenuto = "insight" | "recensione";
export type Visibilita = "condiviso" | "privato";

export type Scritto = {
  tipoContenuto: TipoContenuto;
  contenutoId: string;
  /** Sempre il testo pieno, spoiler compreso: ogni riga è già del
   * richiedente, mai di un collegato. */
  testo: string;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  voceId: string;
  libroId: string;
  titolo: string;
  autori: string[];
  copertinaColoreDominante: string | null;
  /** Quanti propri scritti stanno semanticamente vicino a questo.
   *
   * `null` — non `0` — quando gli indici non ci sono: a consenso revocato
   * vengono cancellati, e uno zero direbbe "questo pensiero non ha
   * compagnia", che in quel momento nessuno sa. Il piede della carta non
   * mostra nulla invece di mostrare un numero inventato. */
  vicini: number | null;
};

export type ScrittoBody = {
  tipo_contenuto: TipoContenuto;
  contenuto_id: string;
  testo: string;
  spoiler: boolean;
  visibilita: Visibilita;
  data: string;
  voce_id: string;
  libro_id: string;
  titolo: string;
  autori: string[];
  copertina_colore_dominante: string | null;
  vicini: number | null;
};

export function toScritto(body: ScrittoBody): Scritto {
  return {
    tipoContenuto: body.tipo_contenuto,
    contenutoId: body.contenuto_id,
    testo: body.testo,
    spoiler: body.spoiler,
    visibilita: body.visibilita,
    data: body.data,
    voceId: body.voce_id,
    libroId: body.libro_id,
    titolo: body.titolo,
    autori: body.autori,
    copertinaColoreDominante: body.copertina_colore_dominante,
    vicini: body.vicini,
  };
}

/** Le pastiglie della pagina, in una forma sola.
 *
 * Lo stesso oggetto va a `GET /scritti` e a `GET /ricerca/semantica`: una
 * pastiglia premuta non può restringere in un modo quando sfogli e in un
 * altro quando chiedi. */
export type FiltriScritti = {
  tipo?: TipoContenuto | null;
  soloSpoiler?: boolean;
  anno?: number | null;
  /** Elenchi e non valori singoli: `voceIds` regge il menù "ogni libro",
   * che ne passa uno, ma anche la lente di un tema quando deve ricadere
   * sui suoi libri; `contenutoIds` è la lente di un tema vera e propria,
   * cioè l'elenco degli scritti che il modello ha messo insieme. */
  voceIds?: string[] | null;
  contenutoIds?: string[] | null;
};

export function parametriFiltri(filtri: FiltriScritti): URLSearchParams {
  const params = new URLSearchParams();
  if (filtri.tipo) params.set("tipo", filtri.tipo);
  if (filtri.soloSpoiler) params.set("solo_spoiler", "true");
  if (filtri.anno != null) params.set("anno", String(filtri.anno));
  for (const voceId of filtri.voceIds ?? []) params.append("voce_id", voceId);
  for (const contenutoId of filtri.contenutoIds ?? []) params.append("contenuto_id", contenutoId);
  return params;
}

export type ElencoScritti = {
  scritti: Scritto[];
  /** Quanti ne passano i filtri correnti, prima del taglio di pagina: è
   * ciò che le pastiglie decidono (§7). */
  totale: number;
  libriDistinti: number;
  indiciSpenti: boolean;
  indiciIncompleti: boolean;
};

export type Sfaccettatura = {
  tipo: "anno" | "libro";
  chiave: string;
  etichetta: string;
  n: number;
  /** Solo sulle righe "libro": il menù "ogni libro" filtra anche per
   * autore, non solo per titolo. `null`/assente sulle righe "anno". */
  autori?: string[] | null;
};
export type Sfaccettature = { anni: Sfaccettatura[]; libri: Sfaccettatura[] };

export type PensieroCheTorna = { scritto: Scritto | null; giorniFa: number | null };

export type Vicini = { vicini: Scritto[]; indiciIncompleti: boolean };

type Esito<T> = { status: "ok"; data: T } | { status: "error"; message: string };

const NON_CONFIGURATA =
  "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza.";
const NON_RISPONDE = "Il server non risponde. Controlla la connessione e riprova.";
const RISPOSTA_MALE = "Il server ha risposto male. Riprova fra poco.";

/** Il giro comune ai quattro fetcher: la stessa costruzione dell'indirizzo,
 * gli stessi tre messaggi d'errore, la stessa forma di ritorno. Estratto
 * perché quattro copie della stessa `fetch` divergono, e un messaggio
 * d'errore diverso per lo stesso guasto è già un bug di scrittura. */
async function leggi<B, T>(
  accessToken: string,
  percorso: string,
  trasforma: (body: B) => T,
): Promise<Esito<T> | { status: "consenso_revocato" }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return { status: "error", message: NON_CONFIGURATA };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${percorso}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: NON_RISPONDE };
  }

  if (response.status === 409) return { status: "consenso_revocato" };
  if (!response.ok) return { status: "error", message: RISPOSTA_MALE };

  return { status: "ok", data: trasforma((await response.json()) as B) };
}

type ElencoBody = {
  scritti: ScrittoBody[];
  totale: number;
  libri_distinti: number;
  indici_spenti: boolean;
  indici_incompleti: boolean;
};

export async function getScritti(
  accessToken: string,
  filtri: FiltriScritti = {},
  pagina: { limite?: number; scarto?: number } = {},
): Promise<Esito<ElencoScritti>> {
  const params = parametriFiltri(filtri);
  if (pagina.limite != null) params.set("limite", String(pagina.limite));
  if (pagina.scarto) params.set("scarto", String(pagina.scarto));
  const query = params.toString();

  const esito = await leggi<ElencoBody, ElencoScritti>(
    accessToken,
    `/scritti${query ? `?${query}` : ""}`,
    (body) => ({
      scritti: body.scritti.map(toScritto),
      totale: body.totale,
      libriDistinti: body.libri_distinti,
      indiciSpenti: body.indici_spenti,
      indiciIncompleti: body.indici_incompleti,
    }),
  );
  // La rotta non risponde mai 409; il ramo esiste solo nel tipo di
  // `leggi`, che è condiviso con `getVicini`.
  return esito.status === "consenso_revocato"
    ? { status: "error", message: RISPOSTA_MALE }
    : esito;
}

export async function getSfaccettature(accessToken: string): Promise<Esito<Sfaccettature>> {
  const esito = await leggi<Sfaccettature, Sfaccettature>(
    accessToken,
    "/scritti/sfaccettature",
    (body) => body,
  );
  return esito.status === "consenso_revocato"
    ? { status: "error", message: RISPOSTA_MALE }
    : esito;
}

type PensieroBody = { scritto: ScrittoBody | null; giorni_fa: number | null };

export async function getPensieroCheTorna(
  accessToken: string,
  scarto = 0,
): Promise<Esito<PensieroCheTorna>> {
  const esito = await leggi<PensieroBody, PensieroCheTorna>(
    accessToken,
    `/scritti/che-torna${scarto ? `?scarto=${scarto}` : ""}`,
    (body) => ({
      scritto: body.scritto ? toScritto(body.scritto) : null,
      giorniFa: body.giorni_fa,
    }),
  );
  return esito.status === "consenso_revocato"
    ? { status: "error", message: RISPOSTA_MALE }
    : esito;
}

type ViciniBody = { vicini: ScrittoBody[]; indici_incompleti: boolean };

export async function getVicini(
  accessToken: string,
  contenutoId: string,
): Promise<Esito<Vicini> | { status: "consenso_revocato" }> {
  return leggi<ViciniBody, Vicini>(
    accessToken,
    `/scritti/${contenutoId}/vicini`,
    (body) => ({
      vicini: body.vicini.map(toScritto),
      indiciIncompleti: body.indici_incompleti,
    }),
  );
}
