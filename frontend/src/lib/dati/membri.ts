import { cacheLife } from "next/cache";

import {
  getUtenti,
  getLibreriaCollegato,
  type UtentiResult,
  type LibreriaCollegatoResult,
} from "@/lib/api/utenti";
import { contesto } from "@/lib/dati/sessione";
import { DURATA_DATI_PERSONALI } from "@/lib/dati/durata";

/** L'elenco dei membri, nei tre gruppi che il backend restituisce. */
export async function utenti(cerca?: string): Promise<UtentiResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken } = await contesto();
  return getUtenti(accessToken, cerca);
}

/** La libreria di un collegato. Chiamata dal layout di `/lettori/[id]`
 * per il sottotitolo e dalle pagine figlie per lo scaffale e per gli
 * Annali: una volta sola. */
export async function libreriaCollegato(utenteId: string): Promise<LibreriaCollegatoResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getLibreriaCollegato(accessToken, utenteId, lingua);
}
