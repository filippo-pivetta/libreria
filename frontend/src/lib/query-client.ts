import { MutationCache, QueryClient } from "@tanstack/react-query";

/**
 * Il client delle query, uno solo per tutta la vita della pagina.
 *
 * Modulo e non stato di un componente: lo vogliono anche i loader delle rotte
 * (`src/router.tsx`), che precaricano i dati della pagina mentre il suo codice
 * è ancora in viaggio, e la guardia dell'area protetta, che lo svuota
 * all'uscita.
 */
export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cinque minuti, non uno (28 agosto 2026). Quasi tutto ciò che si legge
      // lo ha scritto chi sta guardando, in questa stessa sessione, e le
      // mutazioni invalidano già le chiavi che toccano. Ciò che resta è il
      // rifetch di cortesia, cioè un giro di rete in più per riportare
      // indietro ciò che è già in pagina. Ogni query di dominio può
      // sovrascriverlo: i Quaderni lo portano a Infinity.
      //
      // Un esito d'errore restituito come dato (le letture di `lib/dati`
      // non lanciano, portano `{ status: "error" }`) non è mai fresco:
      // tornando sulla pagina si riprova, invece di rimostrare per cinque
      // minuti un guasto che nel frattempo è passato.
      staleTime: (query) =>
        (query.state.data as { status?: string } | undefined)?.status === "error" ? 0 : 5 * 60 * 1000,
      // Tornare sulla scheda del browser non è una richiesta di dati freschi.
      refetchOnWindowFocus: false,
      // Serve a `useQuery(...).promise`, che la barra consuma con `use()`
      // dentro confini di attesa propri (`components/layout/barra-dati.tsx`).
      experimental_prefetchInRender: true,
    },
  },
  mutationCache: new MutationCache({
    // Le letture delle pagine (`lib/dati/*`, chiavi sotto `["rotta"]`) danno
    // il primo dato ai componenti, che poi tengono le proprie chiavi e le
    // proprie invalidazioni. Una scrittura riuscita le segna tutte come
    // vecchie: solo quelle montate si rileggono subito, le altre al prossimo
    // ingresso nella loro pagina. Senza, tornare su una pagina dopo una
    // modifica fatta altrove poteva mostrare per un istante il dato di prima.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rotta"] }),
  }),
});
