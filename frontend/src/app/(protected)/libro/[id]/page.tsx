import { getVoceDettaglio, getVoci } from "@/lib/api/voci";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scheda } from "@/components/libro/scheda";
import { NellaTuaLibreria } from "@/components/libro/nella-tua-libreria";
import { ASSENZE, SESSIONE } from "@/messaggi/it";

/**
 * Scheda del libro (design doc §9). `params` è una Promise in Next 16
 * come nelle versioni precedenti (frontend/AGENTS.md impone di
 * verificarlo, non di fidarsi del training: confermato in
 * node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md).
 *
 * La barra e la verifica di base dell'accesso vivono nel layout di
 * questa cartella: qui si rifà solo il fetch della voce (i layout non
 * passano dati alle pagine figlie in Next.js) e, solo per il libro di un
 * collegato, si aggiunge la fascia "Nella tua libreria".
 */
export default async function LibroPage(props: PageProps<"/libro/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={SESSIONE.scaduta} />;
  }

  const result = await getVoceDettaglio(session.access_token, id);

  if (result.status === "not_found") {
    // Nessuna corsa verso un componente not-found dedicato: un rifiuto
    // indistinguibile da un contenuto inesistente resta testo semplice
    // (PRD, casi limite), non un vicolo cieco di framework.
    return <ErrorState title="Non trovata" message={ASSENZE.voceNonTua} />;
  }
  if (result.status === "error") {
    return <ErrorState message={result.message} />;
  }

  const isOwner = result.data.utenteId === session.user.id;

  if (isOwner) {
    return <Scheda voceIniziale={result.data} currentUserId={session.user.id} />;
  }

  const mie = await getVoci(session.access_token);
  const propriaVoce =
    mie.status === "ok" ? (mie.data.find((v) => v.libroId === result.data.libroId) ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <Scheda voceIniziale={result.data} currentUserId={session.user.id} />
      <NellaTuaLibreria libroId={result.data.libroId} propriaVoce={propriaVoce} />
    </div>
  );
}
