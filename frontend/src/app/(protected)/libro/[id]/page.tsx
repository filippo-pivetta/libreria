import { getVoceDettaglio } from "@/lib/api/voci";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scheda } from "@/components/libro/scheda";

/**
 * Scheda del libro (design doc §9). `params` è una Promise in Next 16
 * come nelle versioni precedenti (frontend/AGENTS.md impone di
 * verificarlo, non di fidarsi del training: confermato in
 * node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md).
 */
export default async function LibroPage(props: PageProps<"/libro/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message="La sessione è scaduta. Ricarica la pagina." />;
  }

  const result = await getVoceDettaglio(session.access_token, id);

  if (result.status === "not_found") {
    // Nessuna corsa verso un componente not-found dedicato: un rifiuto
    // indistinguibile da un contenuto inesistente resta testo semplice
    // (PRD, casi limite), non un vicolo cieco di framework.
    return <ErrorState title="Non trovata" message="Questa voce non esiste, o non è tua." />;
  }
  if (result.status === "error") {
    return <ErrorState message={result.message} />;
  }

  return <Scheda voceIniziale={result.data} />;
}
