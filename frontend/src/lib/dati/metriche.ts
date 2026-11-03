import { queryOptions } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/access-token";
import { conUnSecondoTentativo } from "@/lib/dati/sessione";
import { getMetriche, getMetricheCollegato } from "@/lib/api/metriche";

/** Le proprie metriche dell'anno corrente, che sceglie il backend (fuso
 * Europa centrale). Il cambio d'anno lo gestisce `PaginaAnnali`. */
export function metricheMie() {
  return queryOptions({
    queryKey: ["rotta", "metriche"],
    queryFn: () => conUnSecondoTentativo(async () => getMetriche(await getAccessToken())),
  });
}

export function metricheCollegato(utenteId: string) {
  return queryOptions({
    queryKey: ["rotta", "metriche-collegato", utenteId],
    queryFn: () => conUnSecondoTentativo(async () => getMetricheCollegato(await getAccessToken(), utenteId)),
  });
}
