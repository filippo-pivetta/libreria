/**
 * Fetcher per `/metriche` e `/utenti/{id}/metriche` sul backend FastAPI
 * (issue #7, PRD entità "Metrica di lettura"). Stesse convenzioni di
 * `lib/api/voci.ts`: unioni discriminate per ogni esito, mapping
 * snake_case -> camelCase a carico di questo modulo, mai un'eccezione
 * per il flusso di controllo.
 */

import { intestazioniConLingua } from "@/lib/lingua";

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
  /** Quante sono: `haLettureACavalloAnno` decide SE mostrare la
   * spiegazione, questo le permette di andare al plurale quando serve.
   * Prima la frase era al singolare fisso e con due letture mentiva. */
  lettureACavalloAnno: number;

  // --- Aggiunte dal ridisegno degli Annali (design-frontend.md §14) ------

  /** Dodici numeri, da gennaio a dicembre, sempre di lunghezza 12 anche
   * per un anno in corso. È `pagineLette` a una risoluzione più fine:
   * la somma delle caselle coincide col totale per costruzione. */
  paginePerMese: number[];
  /** Date distinte con almeno un avanzamento a incremento positivo:
   * misura l'abitudine, non il volume. */
  giorniConLettura: number;
  /** Giorni dell'anno già trascorsi: l'anno intero se è passato, il
   * giorno dell'anno se è quello in corso. Denominatore obbligato di
   * `giorniConLettura`, che da solo non si può leggere. */
  giorniTrascorsi: number;
  /** Media dei voti dei libri finiti nell'anno che un voto ce l'hanno.
   * `null` quando nessuno è votato, mai 0 (che sarebbe un voto pessimo
   * invece di un'assenza). */
  votoMedio: number | null;
  /** Il denominatore esplicito di `votoMedio`. */
  libriVotati: number;
  /** Cinque caselle, da una a cinque stelle. I mezzi voti si
   * arrotondano alla stella superiore. */
  votiPerStella: number[];
  /** Letture abbandonate chiuse nell'anno: fuori da `libriFiniti`
   * (regola 13), ma le loro pagine restano dentro `pagineLette`. */
  abbandoni: number;
  /** Estremi inclusi: una lettura aperta e chiusa in giornata dura un
   * giorno. `null` quando nell'anno non si è conclusa alcuna lettura. */
  durataMediaGiorni: number | null;
  durataMassimaGiorni: number | null;
  durataMassimaTitolo: string | null;
  /** Libri finiti senza pagine adottate: lo scarto che rende concreto
   * il limite su `pagineLette`. Zero significa somma completa, e allora
   * il limite non va nemmeno scritto. */
  libriSenzaPagine: number;
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
  letture_a_cavallo_anno: number;
  pagine_per_mese: number[];
  giorni_con_lettura: number;
  giorni_trascorsi: number;
  voto_medio: number | null;
  libri_votati: number;
  voti_per_stella: number[];
  abbandoni: number;
  durata_media_giorni: number | null;
  durata_massima_giorni: number | null;
  durata_massima_titolo: string | null;
  libri_senza_pagine: number;
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
    lettureACavalloAnno: body.letture_a_cavallo_anno,
    paginePerMese: body.pagine_per_mese,
    giorniConLettura: body.giorni_con_lettura,
    giorniTrascorsi: body.giorni_trascorsi,
    votoMedio: body.voto_medio,
    libriVotati: body.libri_votati,
    votiPerStella: body.voti_per_stella,
    abbandoni: body.abbandoni,
    durataMediaGiorni: body.durata_media_giorni,
    durataMassimaGiorni: body.durata_massima_giorni,
    durataMassimaTitolo: body.durata_massima_titolo,
    libriSenzaPagine: body.libri_senza_pagine,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; message: string } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", message: "L’app non è configurata come dovrebbe. Parla con chi mantiene l’istanza." };
  }
  return { baseUrl };
}

export type MetricheResult =
  | { status: "ok"; data: Metriche }
  // L'anno richiesto è oltre l'anno corrente (PRD: "gli anni futuri non
  // sono selezionabili").
  | { status: "anno_futuro" }
  | { status: "error"; message: string };

/**
 * GET /metriche: le proprie metriche di lettura. `anno` omesso ->
 * l'anno corrente in Europa centrale, deciso dal backend.
 *
 * `acceptLanguage`, opzionale (issue #34): inoltra la lingua dell'interfaccia
 * al backend, che sceglie con la stessa intestazione l'etichetta di genere
 * nella lingua giusta (`app/core/lingua.py`) — vedi il docstring di
 * `lib/api/voci.ts::getVoci`, stesso meccanismo.
 */
export async function getMetriche(
  accessToken: string,
  anno?: number,
  acceptLanguage?: string,
): Promise<MetricheResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  const query = anno !== undefined ? `?anno=${anno}` : "";

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/metriche${query}`, {
      headers: intestazioniConLingua(accessToken, acceptLanguage),
      cache: "no-store",
    });
  } catch {
    return { status: "error", message: "Il server non risponde. Controlla la connessione e riprova." };
  }

  if (response.status === 422) {
    return { status: "anno_futuro" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
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
 * payload delle proprie. `acceptLanguage`, opzionale: vedi `getMetriche`. */
export async function getMetricheCollegato(
  accessToken: string,
  utenteId: string,
  anno?: number,
  acceptLanguage?: string,
): Promise<MetricheCollegatoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  const query = anno !== undefined ? `?anno=${anno}` : "";

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/utenti/${utenteId}/metriche${query}`, {
      headers: intestazioniConLingua(accessToken, acceptLanguage),
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
  if (response.status === 422) {
    return { status: "anno_futuro" };
  }
  if (!response.ok) {
    return { status: "error", message: "Il server ha risposto male. Riprova fra poco." };
  }

  const body = (await response.json()) as MetricheBody;
  return { status: "ok", data: toMetriche(body) };
}
