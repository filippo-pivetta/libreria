import { cacheLife } from "next/cache";

import { getScheda, type FonteScheda, type SchedaResult } from "@/lib/api/schede";
import { contesto } from "@/lib/dati/sessione";
import { DURATA_DATI_PERSONALI } from "@/lib/dati/durata";

/**
 * La scheda di un libro che non si ha in libreria (design-frontend.md §13).
 *
 * È l'unico dato di questo strato che non appartiene a chi guarda: la
 * carta di un'opera è la stessa per tutti. Resta comunque in cache
 * **privata** e non condivisa: la risposta porta anche se quel libro è
 * già in libreria di chi guarda (`voce`), quindi non è il dato
 * anonimo che sembra. Il ramo `google` di questa rotta può inoltre
 * costare più di dieci secondi al primo colpo, e riaprirla dopo averla
 * appena chiusa è un gesto frequente.
 */
export async function scheda(fonte: FonteScheda, identificativo: string): Promise<SchedaResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getScheda(accessToken, fonte, identificativo, lingua);
}
