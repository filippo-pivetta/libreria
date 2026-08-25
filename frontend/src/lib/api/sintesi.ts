/**
 * Fetcher della sintesi tematica trasversale (issue #27, riscritta il 22
 * agosto 2026 da un unico paragrafo a un elenco di temi con le prove
 * attaccate — vedi `app/services/sintesi_service.py`).
 *
 * `POST` e non `GET` per generarla: sostituisce l'eventuale sintesi
 * precedente e costa una chiamata al fornitore. `avviso` è un campo della
 * risposta, non una frase dentro un testo — stesso trattamento della
 * preview, stessa ragione: un'indicazione che dipende dall'obbedienza del
 * modello prima o poi manca.
 *
 * Due esiti "non c'è niente da mostrare", distinti perché dicono cose
 * diverse: `contenuto_insufficiente` (non hai ancora scritto nulla) e
 * `nessun_tema_rilevante` (hai scritto, ma nessun tema attraversa libri
 * diversi — o perché il materiale è di un solo libro, o perché il
 * modello non ne ha trovati). Appiattirli su un errore generico
 * toglierebbe alla pagina la possibilità di dirlo per bene.
 */

export type TipoRiferimento = "insight" | "recensione";

export type RiferimentoTema = {
  /** L'id dell'insight o della recensione, per collegare un tema ai
   * propri scritti veri invece che ai soli libri: è ciò che permette a
   * Quaderni di usare un tema come lente sul corpus (design doc §22).
   *
   * `null` sulle sintesi generate prima del ridisegno del 25 agosto 2026
   * — una sintesi è una fotografia conservata, non un collegamento vivo.
   * In quel caso la lente ricade sui libri del tema, e la prima
   * rigenerazione riempie il campo (§22, "sostituisce, non si
   * accumula"). */
  contenutoId: string | null;
  voceId: string;
  titolo: string;
  tipo: TipoRiferimento;
  testo: string;
  data: string;
};

export type Tema = {
  nome: string;
  sintesi: string;
  riferimenti: RiferimentoTema[];
};

export type Sintesi = {
  id: string;
  creatoAt: string;
  avviso: string;
  temi: Tema[];
};

type RiferimentoBody = {
  contenuto_id: string | null;
  voce_id: string;
  titolo: string;
  tipo: TipoRiferimento;
  testo: string;
  data: string;
};

type TemaBody = {
  nome: string;
  sintesi: string;
  riferimenti: RiferimentoBody[];
};

type Body = {
  id: string;
  creato_at: string;
  avviso: string;
  temi: TemaBody[];
};

export type SintesiResult =
  | { status: "ok"; data: Sintesi }
  | { status: "not_found" }
  | { status: "consenso_revocato" }
  | { status: "contenuto_insufficiente"; message: string }
  | { status: "nessun_tema_rilevante"; message: string }
  | { status: "error"; message: string };

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }
  return { baseUrl };
}

function toSintesi(body: Body): Sintesi {
  return {
    id: body.id,
    creatoAt: body.creato_at,
    avviso: body.avviso,
    temi: body.temi.map((t) => ({
      nome: t.nome,
      sintesi: t.sintesi,
      riferimenti: t.riferimenti.map((r) => ({
        contenutoId: r.contenuto_id ?? null,
        voceId: r.voce_id,
        titolo: r.titolo,
        tipo: r.tipo,
        testo: r.testo,
        data: r.data,
      })),
    })),
  };
}

type ErrorBody = { detail?: string | { error_code?: string; message?: string } };

async function esito(response: Response): Promise<SintesiResult> {
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 409) return { status: "consenso_revocato" };
  if (response.status === 422) {
    const body = (await response.json()) as ErrorBody;
    const detail = typeof body.detail === "object" ? body.detail : undefined;
    if (detail?.error_code === "nessun_tema_rilevante") {
      return {
        status: "nessun_tema_rilevante",
        message:
          detail.message ??
          "Non emerge ancora un tema che attraversi libri diversi. Continua a scrivere e a leggere, poi riprova.",
      };
    }
    return {
      status: "contenuto_insufficiente",
      message: detail?.message ?? "Scrivi qualche insight o recensione prima di chiedere una sintesi.",
    };
  }
  if (response.status === 503) {
    return { status: "error", message: "La sintesi non è arrivata. Riprova fra poco." };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }
  return { status: "ok", data: toSintesi((await response.json()) as Body) };
}

export async function getSintesi(accessToken: string): Promise<SintesiResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  try {
    return await esito(
      await fetch(`${config.baseUrl}/sintesi-tematica`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }
}

export async function generaSintesi(accessToken: string): Promise<SintesiResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  try {
    return await esito(
      await fetch(`${config.baseUrl}/sintesi-tematica`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }
}
