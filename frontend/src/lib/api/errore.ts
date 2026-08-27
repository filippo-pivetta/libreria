/**
 * La forma di un errore che attraversa `lib/api`.
 *
 * Prima di questo modulo ogni fetcher restituiva `{ status: "error";
 * message: string }` con la frase già scritta, in italiano, dentro il
 * codice. Tre frasi coprivano quasi tutto — "Il server non risponde…"
 * (38 occorrenze), "Il server ha risposto male…" (35), "L'app non è
 * configurata come dovrebbe…" (20) — e finivano a schermo tali e quali,
 * con due conseguenze:
 *
 * 1. **Erano fuori dal catalogo bilingue.** Con `Accept-Language: en`,
 *    chi perdeva la rete mentre votava un libro leggeva italiano. Il
 *    catalogo `messages/{it,en}.json` copriva solo gli errori di dominio,
 *    cioè quelli che quasi non si vedono.
 * 2. **Avevano per soggetto il server**, che è vocabolario da idraulica e
 *    non è la cosa di cui parla l'utente. §19 chiede l'opposto: il
 *    soggetto è la cosa ("La recensione non è stata salvata"), e la
 *    seconda frase dice il passo successivo. Una stringa sola non può
 *    dire la prima metà, perché `lib/api` non sa cosa stava facendo il
 *    chiamante.
 *
 * Da qui la divisione: **questo livello classifica, non scrive**. Dice di
 * che *genere* è il guasto; la frase la compone `lib/errori.ts` unendo la
 * prima clausola (che sa il chiamante) alla seconda (che sa il genere),
 * pescandole entrambe dal catalogo.
 */

export type GenereErrore =
  /** `fetch` non è nemmeno partito: niente rete, DNS muto, server giù. */
  | "rete"
  /** Ha risposto, ma male: un 5xx, o un 4xx che nessuno ha previsto. */
  | "server"
  /** Manca `NEXT_PUBLIC_API_BASE_URL`: un guasto d'installazione, non
   * d'uso. L'utente non può farci nulla se non dirlo a qualcuno. */
  | "configurazione"
  /** 401: il token non vale più. Distinto da `server` perché il rimedio
   * esiste e funziona sempre — ricaricare la pagina. */
  | "sessione"
  /** 429: il limitatore di frequenza. Non è un guasto, è un'attesa. */
  | "limite"
  /** La cosa non c'è (404 su qualcosa che dovrebbe esserci). `codice` è
   * una chiave di `assenze.*`. */
  | "assenza"
  /** Una regola del dominio ha detto no (409/422, o una validazione fatta
   * qui). `codice` è l'`error_code` del backend, chiave di `regole.*`. */
  | "regola";

export type ErroreApi = {
  genere: GenereErrore;
  /**
   * Chiave, non frase: `error_code` del backend per `regola`, chiave di
   * `assenze.*` per `assenza`. Non arriva mai a schermo da sola — la
   * frase corrispondente sta nel catalogo, in entrambe le lingue.
   */
  codice?: string;
  /**
   * **Mai a schermo**: qui dentro finiscono stati HTTP e testi del
   * fornitore, cioè esattamente ciò che §19 vieta di mostrare.
   *
   * Oggi **nessuno lo legge**: è la presa per la telemetria, che questo
   * progetto non ha ancora (stessa constatazione in
   * `components/states/route-error.tsx`, che per ora si ferma a un
   * `console.error`). Si riempie lo stesso, perché il punto in cui lo
   * stato HTTP si conosce è questo e non ce n'è un altro più tardi.
   */
  dettaglio?: string;
};

export const ERRORE_RETE: ErroreApi = { genere: "rete" };
export const ERRORE_SERVER: ErroreApi = { genere: "server" };
export const ERRORE_CONFIGURAZIONE: ErroreApi = { genere: "configurazione" };
export const ERRORE_SESSIONE: ErroreApi = { genere: "sessione" };
export const ERRORE_LIMITE: ErroreApi = { genere: "limite" };

/**
 * Il modello non ha risposto (503 dalle rotte assistite).
 *
 * Genere `server` e non uno suo: il rimedio è lo stesso ("Riprova fra
 * poco"), e la prima frase — quella che dice *cosa* non è arrivato: il
 * parere, la sintesi, i suggerimenti — la scrive già il chiamante. Il
 * `codice` resta per distinguerlo nei log da un 5xx qualsiasi, che è
 * l'unico posto dove la differenza serve davvero.
 */
export const ERRORE_MODELLO: ErroreApi = { genere: "server", codice: "modello_non_disponibile" };

/** Un'assenza, con la chiave di `assenze.*` che la nomina. */
export function assenza(codice: string): ErroreApi {
  return { genere: "assenza", codice };
}

/** Una regola, con l'`error_code` che l'ha fatta scattare. */
export function regola(codice: string | undefined, dettaglio?: string): ErroreApi {
  return { genere: "regola", codice: codice ?? "sconosciuta", dettaglio };
}

/**
 * Classifica una risposta che non è `ok`.
 *
 * Sostituisce il `if (!response.ok) return …"Il server ha risposto
 * male"…` che stava, identico, in una quarantina di punti. Passando da
 * qui, 401 e 429 smettono di essere confusi con un guasto del server:
 * erano indistinguibili prima, e hanno rimedi diversi e certi
 * (ricaricare, aspettare) che ora l'utente si vede dire.
 */
export function erroreDaRisposta(response: Response): ErroreApi {
  if (response.status === 401) return ERRORE_SESSIONE;
  if (response.status === 429) return ERRORE_LIMITE;
  return { genere: "server", dettaglio: `HTTP ${response.status}` };
}

/**
 * L'eccezione che porta un `ErroreApi` attraverso una mutazione di
 * TanStack Query, che come canale ha solo `Error`.
 *
 * `message` esiste perché `Error` lo pretende, ma non è un testo da
 * mostrare: chi lo cattura chiama `messaggioDi(...)`, non `e.message`.
 * Era proprio quel `e.message` a portare a schermo le frasi sbagliate.
 */
export class ErroreApp extends Error {
  readonly errore: ErroreApi;

  constructor(errore: ErroreApi) {
    super(`${errore.genere}${errore.codice ? `:${errore.codice}` : ""}`);
    this.name = "ErroreApp";
    this.errore = errore;
  }
}

/** Estrae l'`ErroreApi` da ciò che una mutazione ha lanciato. */
export function erroreDi(lanciato: unknown): ErroreApi | undefined {
  return lanciato instanceof ErroreApp ? lanciato.errore : undefined;
}
