import { queryOptions } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

/**
 * Le letture delle pagine.
 *
 * Ogni modulo di `lib/dati` espone `queryOptions` che una rotta usa due volte:
 * il loader (`src/router.tsx`) le precarica senza aspettarle, così dati e
 * codice della pagina partono insieme, e il componente della rotta le legge con
 * `useQuery`. Restituiscono l'esito dei fetcher di `lib/api` così com'è
 * (`{ status: … }`), senza lanciare: la pagina decide quale `ErrorState`
 * mostrare, come prima facevano i Server Component.
 *
 * Le chiavi stanno tutte sotto `["rotta"]`, separate da quelle dei componenti
 * (`["voci"]`, `["metriche", anno]`…) che hanno forma diversa: il componente
 * riceve il primo dato come `initialData` e da lì tiene la propria chiave. Ogni
 * mutazione riuscita segna come vecchie le chiavi `["rotta"]`
 * (`lib/query-client.ts`).
 */

/** Chi sta guardando. Letto dalla sessione nel browser, nessuna rete: la
 * guardia dell'area protetta ha già verificato che la sessione c'è. */
export function contesto() {
  return queryOptions({
    queryKey: ["sessione"],
    queryFn: async (): Promise<{ utenteId: string }> => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      return { utenteId: session?.user.id ?? "" };
    },
    staleTime: Infinity,
  });
}

/**
 * Un fetcher di `lib/api` con un secondo tentativo, uno solo, dopo un guasto
 * del server.
 *
 * Il caso da cui viene: la prima lettura subito dopo l'accesso. PostgREST
 * confronta l'emissione del token con un orologio che aggiorna una volta al
 * secondo, e un token usato nello stesso secondo in cui è nato torna indietro
 * come "emesso nel futuro" (500 dal backend). Una SPA chiede la libreria nel
 * millisecondo dopo il login, quindi ci cade. Un secondo dopo passa.
 *
 * Solo `server`: una regola, un'assenza o una sessione scaduta danno lo stesso
 * esito anche al secondo tentativo (`riprovabile` in `lib/messaggi-errore.ts`
 * fa lo stesso ragionamento per il comando "Riprova").
 */
export async function conUnSecondoTentativo<R extends { status: string }>(
  leggi: () => Promise<R>,
): Promise<R> {
  const primo = await leggi();
  const guasto =
    primo.status === "error" &&
    (primo as unknown as { errore?: { genere?: string } }).errore?.genere === "server";
  if (!guasto) return primo;
  await new Promise((risolvi) => setTimeout(risolvi, 1000));
  return leggi();
}
