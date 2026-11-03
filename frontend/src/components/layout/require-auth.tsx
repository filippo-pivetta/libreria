import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { queryClient } from "@/lib/query-client";
import { me } from "@/lib/dati/profilo";
import { vociMie } from "@/lib/dati/letture";

/**
 * La guardia dell'area protetta.
 *
 * Governa solo l'interfaccia: chi non ha una sessione non vede il guscio e va
 * al login. Il confine vero sta più in basso, ed è lo stesso di prima: il
 * backend verifica la firma del JWT su ogni rotta (ADR 0012) e la RLS su ogni
 * riga.
 *
 * `onAuthStateChange` emette `INITIAL_SESSION` appena ci si iscrive, poi
 * l'uscita e il rinnovo del token fallito: una sessione scaduta atterra qui come
 * un'uscita, e la cache delle query si svuota, così nulla della persona di
 * prima resta in memoria per la prossima.
 *
 * **Precarica ciò che vuole quasi ogni pagina** appena la sessione c'è, senza
 * aspettare il codice della pagina: il profilo (nome in barra, account da
 * completare) e la libreria.
 */
export function RequireAuth() {
  // undefined = sessione non ancora letta, null = nessuna sessione.
  const [sessione, setSessione] = useState<Session | null | undefined>(undefined);
  const { pathname, search } = useLocation();

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_evento, nuova) => {
      setSessione(nuova);
      if (!nuova) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const autenticato = Boolean(sessione);

  useEffect(() => {
    if (autenticato) void queryClient.prefetchQuery(vociMie());
  }, [autenticato]);

  const profilo = useQuery({ ...me(), enabled: autenticato });

  // Prima che la sessione sia letta non c'è nulla da disegnare: è `localStorage`,
  // una frazione di millisecondo, e un guscio mostrato e poi tolto sarebbe peggio.
  if (sessione === undefined) return null;

  if (sessione === null) {
    // Torna dove si voleva andare, dopo l'accesso.
    const destinazione = pathname === "/" ? "" : `?da=${encodeURIComponent(pathname + search)}`;
    return <Navigate to={`/login${destinazione}`} replace />;
  }

  // Sessione valida ma account non ancora completato: capita a chi ha chiuso
  // la scheda a metà del completamento dell'invito (docs/adr/0013) e torna più
  // tardi. Non è un vicolo cieco: la via d'uscita è finire quel passaggio.
  if (profilo.data?.status === "not_provisioned") {
    return <Navigate to="/completa-account" replace />;
  }

  return <Outlet />;
}
