import { queryOptions } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/access-token";
import { conUnSecondoTentativo } from "@/lib/dati/sessione";
import { getMe } from "@/lib/api/me";
import { getCollegamenti } from "@/lib/api/collegamenti";

/** Il proprio profilo. Lo leggono la guardia dell'area protetta (account da
 * completare), la barra (nome) e il Profilo. */
export function me() {
  return queryOptions({
    queryKey: ["rotta", "me"],
    queryFn: () => conUnSecondoTentativo(async () => getMe(await getAccessToken())),
  });
}

/** I propri collegamenti, da cui il contatore delle richieste ricevute. */
export function collegamenti() {
  return queryOptions({
    queryKey: ["rotta", "collegamenti"],
    queryFn: () => conUnSecondoTentativo(async () => getCollegamenti(await getAccessToken())),
  });
}
