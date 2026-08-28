"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cinque minuti, non uno (28 agosto 2026). Il default di un
        // minuto era tarato su dati che possono cambiare sotto i piedi
        // di chi guarda; qui quasi tutto ciò che si legge lo ha scritto
        // chi sta guardando, in questa stessa sessione, e le mutazioni
        // invalidano già le chiavi che toccano. Ciò che resta è il
        // rifetch di cortesia — e su un'istanza a cerchia ristretta è
        // solo un giro di rete in più (Vercel -> Fly -> Supabase) per
        // riportare indietro esattamente ciò che è già in pagina.
        //
        // Ogni query di dominio può sovrascriverlo: i Quaderni lo
        // portano già a Infinity (components/quaderni/quaderni.tsx).
        staleTime: 5 * 60 * 1000,
        // Tornare sulla scheda del browser non è una richiesta di dati
        // freschi: è la stessa persona che riprende in mano la stessa
        // pagina. Con il default (true) ogni cambio di finestra faceva
        // ripartire tutte le query montate.
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Sul server serve sempre un client nuovo (mai condiviso tra richieste
// diverse, altrimenti i dati di un utente potrebbero finire nella cache
// letta da un altro). Nel browser invece un client solo per l'intera
// sessione, riusato tra i render: è il pattern raccomandato da TanStack
// Query per l'App Router di Next.js.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
