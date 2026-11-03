import { queryOptions, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import { me, collegamenti } from "@/lib/dati/profilo";
import { saluto } from "@/lib/saluto";

/**
 * I tre valori che la barra dell'area protetta mostra.
 *
 * Li vogliono in due: il guscio dell'area protetta (`Chrome`) e il layout di
 * `/libro/:id`, che per un libro proprio rimette la barra globale.
 */
export type DatiBarra = {
  userName: string;
  /** Sull'orologio di Roma (`lib/saluto.ts`), come la luce (§3). */
  saluto: string;
  receivedRequestCount?: number;
};

function datiBarra() {
  return queryOptions({
    queryKey: ["rotta", "barra"],
    // Le due letture passano dalla cache: sono le stesse che la guardia
    // dell'area protetta ha già chiesto, quindi di fatto una volta sola.
    queryFn: async (): Promise<DatiBarra> => {
      const [profilo, relazioni] = await Promise.all([
        queryClient.fetchQuery(me()),
        queryClient.fetchQuery(collegamenti()),
      ]);

      // Un fallimento qui non toglie di mezzo la pagina: la barra resta
      // senza nome e senza contatore, e il contenuto si disegna lo stesso.
      const nomeUtente = profilo.status === "ok" ? profilo.data.nomeUtente : "";

      return {
        userName: nomeUtente,
        saluto: saluto(nomeUtente),
        receivedRequestCount:
          relazioni.status === "ok"
            ? relazioni.data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe).length
            : undefined,
      };
    },
  });
}

/**
 * La promessa dei dati della barra, stabile fra un render e l'altro.
 *
 * Promessa e non valori: la barra la consuma con `use()` dentro confini di
 * attesa propri (`components/layout/barra-dati.tsx`), così il contenuto della
 * pagina non aspetta mai un nome e un contatore.
 */
export function useDatiBarra(): Promise<DatiBarra> {
  return useQuery(datiBarra()).promise;
}
