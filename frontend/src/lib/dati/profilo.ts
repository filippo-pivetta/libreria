import { cacheLife } from "next/cache";

import { getMe, type MeResult } from "@/lib/api/me";
import { getCollegamenti, type CollegamentiResult } from "@/lib/api/collegamenti";
import { contesto } from "@/lib/dati/sessione";
import { DURATA_DATI_PERSONALI } from "@/lib/dati/durata";

/** Il proprio profilo. Letto dal layout dell'area protetta per il nome
 * nella barra, e di nuovo dal Profilo: una volta sola di fatto. */
export async function me(): Promise<MeResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken } = await contesto();
  return getMe(accessToken);
}

/** I propri collegamenti, da cui il contatore delle richieste ricevute. */
export async function collegamenti(): Promise<CollegamentiResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken } = await contesto();
  return getCollegamenti(accessToken);
}
