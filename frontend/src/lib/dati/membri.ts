import { queryOptions } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/access-token";
import { conUnSecondoTentativo } from "@/lib/dati/sessione";
import { getUtenti, getLibreriaCollegato } from "@/lib/api/utenti";

/** L'elenco dei membri, nei tre gruppi che il backend restituisce. */
export function utenti() {
  return queryOptions({
    queryKey: ["rotta", "utenti"],
    queryFn: () => conUnSecondoTentativo(async () => getUtenti(await getAccessToken())),
  });
}

/** La libreria di un collegato. La chiede il layout di `/lettori/:id`, che ne
 * ricava anche se la stanza è ancora aperta, e la riusano le due pagine figlie. */
export function libreriaCollegato(utenteId: string) {
  return queryOptions({
    queryKey: ["rotta", "libreria-collegato", utenteId],
    queryFn: () => conUnSecondoTentativo(async () => getLibreriaCollegato(await getAccessToken(), utenteId)),
  });
}
