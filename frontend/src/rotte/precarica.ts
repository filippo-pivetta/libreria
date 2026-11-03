import { matchPath } from "react-router";

import { queryClient } from "@/lib/query-client";
import { scheda } from "@/lib/dati/catalogo";
import { vociMie, voceDettaglio } from "@/lib/dati/letture";
import { libreriaCollegato, utenti } from "@/lib/dati/membri";
import { metricheCollegato, metricheMie } from "@/lib/dati/metriche";
import { me } from "@/lib/dati/profilo";
import type { FonteScheda } from "@/lib/api/schede";

/**
 * Cosa serve a ciascuna pagina, in un posto solo.
 *
 * Per ogni rotta: il suo codice (`codice`, un `import()` che il build separa in
 * un file proprio) e i suoi dati (`dati`, le query di `lib/dati`). Lo usano in
 * due:
 *
 *   - `src/router.tsx`, come `lazy` e `loader` della rotta: alla navigazione il
 *     codice e i dati partono insieme invece che uno dopo l'altro;
 *   - `components/ui/link.tsx`, all'intenzione (passaggio del puntatore, tocco,
 *     focus): quando arriva il clic, spesso è già tutto in memoria.
 *
 * `dati` non aspetta mai: `prefetchQuery` non lancia e la navigazione non si
 * ferma sulla rete. La pagina mostra il proprio scheletro finché la query non
 * risponde, e se la risposta è già in cache non lo mostra affatto.
 */
type Parametri = Record<string, string | undefined>;

type Rotta = {
  percorso: string;
  codice: () => Promise<unknown>;
  dati?: (p: Parametri) => void;
};

export const ROTTE = {
  libreria: {
    percorso: "/",
    codice: () => import("@/rotte/libreria"),
    dati: () => void queryClient.prefetchQuery(vociMie()),
  },
  aggiungi: { percorso: "/aggiungi", codice: () => import("@/rotte/aggiungi") },
  annali: {
    percorso: "/annals",
    codice: () => import("@/rotte/annali"),
    dati: () => void queryClient.prefetchQuery(metricheMie()),
  },
  lettori: {
    percorso: "/readers",
    codice: () => import("@/rotte/lettori"),
    dati: () => void queryClient.prefetchQuery(utenti()),
  },
  profilo: {
    percorso: "/profilo",
    codice: () => import("@/rotte/profilo"),
    dati: () => void queryClient.prefetchQuery(me()),
  },
  quaderni: { percorso: "/quaderni", codice: () => import("@/rotte/quaderni") },
  scheda: {
    percorso: "/book/:fonte/:id",
    codice: () => import("@/rotte/scheda-catalogo"),
    dati: ({ fonte, id }) => {
      if ((fonte === "catalogo" || fonte === "google") && id) {
        void queryClient.prefetchQuery(scheda(fonte as FonteScheda, id));
      }
    },
  },
  libro: {
    percorso: "/libro/:id",
    codice: () => Promise.all([import("@/rotte/libro-guscio"), import("@/rotte/libro")]),
    dati: ({ id }) => {
      if (id) void queryClient.prefetchQuery(voceDettaglio(id));
    },
  },
  collegato: {
    percorso: "/lettori/:id",
    codice: () => Promise.all([import("@/rotte/collegato-guscio"), import("@/rotte/collegato")]),
    dati: ({ id }) => {
      if (!id) return;
      void queryClient.prefetchQuery(libreriaCollegato(id));
      void queryClient.prefetchQuery(vociMie());
    },
  },
  collegatoAnnali: {
    percorso: "/lettori/:id/annali",
    codice: () => Promise.all([import("@/rotte/collegato-guscio"), import("@/rotte/collegato-annali")]),
    dati: ({ id }) => {
      if (!id) return;
      void queryClient.prefetchQuery(libreriaCollegato(id));
      void queryClient.prefetchQuery(vociMie());
      void queryClient.prefetchQuery(metricheMie());
      void queryClient.prefetchQuery(metricheCollegato(id));
    },
  },
} satisfies Record<string, Rotta>;

const ELENCO: Rotta[] = Object.values(ROTTE);

/** Precarica codice e dati della pagina a cui porta `href`. Un percorso che
 * non corrisponde a nessuna rotta dell'area protetta non fa nulla. */
export function precaricaPercorso(href: string): void {
  const percorso = href.split(/[?#]/)[0];
  for (const rotta of ELENCO) {
    const corrispondenza = matchPath(rotta.percorso, percorso);
    if (corrispondenza) {
      void rotta.codice();
      rotta.dati?.(corrispondenza.params);
      return;
    }
  }
}
