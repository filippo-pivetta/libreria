import { getTranslations } from "next-intl/server";

import type { ErroreApi } from "@/lib/api/errore";
import { componiMessaggio, type DominioErrore } from "@/lib/messaggi-errore";

/**
 * `componiMessaggio` per i Server Component asincroni (le pagine sotto
 * `app/`, che fanno il primo fetch lato server e mostrano `ErrorState`
 * se va storto).
 *
 * File separato da `messaggi-errore.ts` e non un export in più là dentro:
 * `next-intl/server` non può entrare nel bundle client, e quel modulo lo
 * importano i componenti client.
 */
export async function messaggioErrore(
  dominio: DominioErrore,
  errore?: ErroreApi,
): Promise<string> {
  const t = await getTranslations();
  return componiMessaggio(t as unknown as Parameters<typeof componiMessaggio>[0], dominio, errore);
}
