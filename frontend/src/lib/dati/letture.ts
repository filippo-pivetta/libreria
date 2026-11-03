import { queryOptions } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/access-token";
import { conUnSecondoTentativo } from "@/lib/dati/sessione";
import { getVoci, getVoceDettaglio } from "@/lib/api/voci";

/** La propria libreria. */
export function vociMie() {
  return queryOptions({
    queryKey: ["rotta", "voci"],
    queryFn: () => conUnSecondoTentativo(async () => getVoci(await getAccessToken())),
  });
}

/** Una voce di libreria, propria o di un collegato. */
export function voceDettaglio(voceId: string) {
  return queryOptions({
    queryKey: ["rotta", "voce", voceId],
    queryFn: () => conUnSecondoTentativo(async () => getVoceDettaglio(await getAccessToken(), voceId)),
  });
}
