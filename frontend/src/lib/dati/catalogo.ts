import { queryOptions } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/access-token";
import { conUnSecondoTentativo } from "@/lib/dati/sessione";
import { getScheda, type FonteScheda } from "@/lib/api/schede";

/** La scheda di un libro che non si ha in libreria (`/book/:fonte/:id`).
 * Guardarla non fa nascere una scheda nel catalogo (AGENTS.md). */
export function scheda(fonte: FonteScheda, identificativo: string) {
  return queryOptions({
    queryKey: ["rotta", "scheda", fonte, identificativo],
    queryFn: () => conUnSecondoTentativo(async () => getScheda(await getAccessToken(), fonte, identificativo)),
  });
}
