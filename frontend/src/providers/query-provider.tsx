"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Evita rifetch immediati non necessari; ogni query di dominio
        // futura potrà sovrascrivere questo default per singolo caso.
        staleTime: 60 * 1000,
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
