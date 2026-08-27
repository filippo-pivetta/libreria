/**
 * Fetcher per `/utenti` sul backend FastAPI (elenco membri e libreria di
 * un collegato, issue #3). Stesse convenzioni di `lib/api/voci.ts`:
 * unioni discriminate per ogni esito, mapping snake_case -> camelCase a
 * carico di questo modulo, mai un'eccezione per il flusso di controllo.
 */

import { toVoceConLibro, type VoceConLibro, type VoceConLibroBody } from "@/lib/api/voci";
import { intestazioniConLingua } from "@/lib/lingua";
import type { ErroreApi } from "@/lib/api/errore";
import { ERRORE_CONFIGURAZIONE, ERRORE_RETE, erroreDaRisposta } from "@/lib/api/errore";

export type StatoRelazione = "assente" | "in_attesa" | "attiva";

export type Membro = {
  id: string;
  nomeUtente: string;
  statoRelazione: StatoRelazione;
  /** Significativo solo se statoRelazione === "in_attesa": true se la
   * richiesta l'ha inviata l'altro (accettabile/rifiutabile), false se
   * l'ha inviata chi guarda (solo ritirabile). */
  richiestaRicevuta: boolean;
  /** L'id della riga `collegamento`, quando una relazione esiste. Le
   * rotte di `/collegamenti` lavorano sull'id della RELAZIONE, non su
   * quello della persona: senza questo campo l'elenco potrebbe mostrare
   * accetta/rifiuta/ritira/interrompi ma non eseguirli. È ciò che
   * permette a Lettori di reggere l'intero ciclo di vita di un
   * collegamento senza una seconda chiamata. */
  collegamentoId: string | null;
};

/** I tre gruppi di `GET /utenti` (design doc §16).
 *
 * `richiesteRicevute` e `collegati` sono sempre completi; `altri` ha un
 * tetto lato server e porta in cima le richieste inviate. Non esiste un
 * conteggio totale dei membri: su un'istanza pubblica quanti siano gli
 * iscritti non è un'informazione che l'elenco debba dare, e infatti il
 * backend non la calcola nemmeno. */
export type ElencoMembri = {
  richiesteRicevute: Membro[];
  collegati: Membro[];
  altri: Membro[];
};

type MembroBody = {
  id: string;
  nome_utente: string;
  stato_relazione: StatoRelazione;
  richiesta_ricevuta: boolean;
  collegamento_id: string | null;
};

type ElencoMembriBody = {
  richieste_ricevute: MembroBody[];
  collegati: MembroBody[];
  altri: MembroBody[];
};

function toMembro(body: MembroBody): Membro {
  return {
    id: body.id,
    nomeUtente: body.nome_utente,
    statoRelazione: body.stato_relazione,
    richiestaRicevuta: body.richiesta_ricevuta,
    collegamentoId: body.collegamento_id,
  };
}

function baseUrlOrError(): { baseUrl: string } | { status: "error"; errore: ErroreApi } {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return { status: "error", errore: ERRORE_CONFIGURAZIONE };
  }
  return { baseUrl };
}

export type UtentiResult =
  | { status: "ok"; data: ElencoMembri }
  | { status: "error"; errore: ErroreApi };

/** Sotto le due lettere non si cerca: il backend non interroga
 * l'anagrafica (`utenti_service.MIN_QUERY`) e questo modulo non lo
 * chiama nemmeno, così una battuta sola non parte come richiesta. */
export const MIN_RICERCA = 2;

/** GET /utenti: l'elenco membri (design doc §16) in tre gruppi, con lo
 * stato della relazione verso chi chiama.
 *
 * `cerca` filtra per nome utente: sottostringa e tolleranza agli errori
 * di battitura sugli sconosciuti, sola sottostringa sui propri collegati
 * (le due regole vivono lato server, vedi `utenti_service`). */
export async function getUtenti(
  accessToken: string,
  cerca?: string,
): Promise<UtentiResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  const url = new URL(`${config.baseUrl}/utenti`);
  const termine = cerca?.trim();
  if (termine) {
    url.searchParams.set("cerca", termine);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as ElencoMembriBody;
  return {
    status: "ok",
    data: {
      richiesteRicevute: body.richieste_ricevute.map(toMembro),
      collegati: body.collegati.map(toMembro),
      altri: body.altri.map(toMembro),
    },
  };
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
  | { status: "error"; errore: ErroreApi };

/** GET /utenti/{id}/voci: la libreria di un collegato (design doc §15).
 * `acceptLanguage`, opzionale: vedi il docstring di
 * `lib/api/voci.ts::getVoci`, stesso meccanismo. */
export async function getLibreriaCollegato(
  accessToken: string,
  utenteId: string,
  acceptLanguage?: string,
): Promise<LibreriaCollegatoResult> {
  const config = baseUrlOrError();
  if ("status" in config) return config;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/utenti/${utenteId}/voci`, {
      headers: intestazioniConLingua(accessToken, acceptLanguage),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errore: ERRORE_RETE };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (response.status === 403) {
    return { status: "non_collegato" };
  }
  if (!response.ok) {
    return { status: "error", errore: erroreDaRisposta(response) };
  }

  const body = (await response.json()) as LibreriaCollegatoBody;
  return {
    status: "ok",
    utente: { id: body.utente.id, nomeUtente: body.utente.nome_utente },
    voci: body.voci.map(toVoceConLibro),
  };
}
