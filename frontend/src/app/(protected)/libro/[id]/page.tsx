import { getVoceDettaglio, getVoci } from "@/lib/api/voci";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scheda } from "@/components/libro/scheda";
import { NellaTuaLibreria } from "@/components/libro/nella-tua-libreria";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

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
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const lingua = await accettaLinguaInoltrata();
  const result = await getVoceDettaglio(session.access_token, id, lingua);

  if (result.status === "not_found") {
    // Nessuna corsa verso un componente not-found dedicato: un rifiuto
    // indistinguibile da un contenuto inesistente resta testo semplice
    // (PRD, casi limite), non un vicolo cieco di framework.
    return <ErrorState title={t("titoli.nonTrovata")} message={t("assenze.voceNonTua")} />;
  }
  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("libroNonCaricato", result.errore)} />;
  }

  const isOwner = result.data.utenteId === session.user.id;

  if (isOwner) {
    return <Scheda voceIniziale={result.data} currentUserId={session.user.id} />;
  }

  const mie = await getVoci(session.access_token, lingua);
  const propriaVoce =
    mie.status === "ok" ? (mie.data.find((v) => v.libroId === result.data.libroId) ?? null) : null;

  // "Nella tua libreria" entra nella colonna laterale della scheda invece
  // di stare sotto come una fascia a sé: è l'unico comando della pagina, e
  // in fondo a uno scorrimento lungo non lo trovava nessuno.
  return (
    <Scheda
      voceIniziale={result.data}
      currentUserId={session.user.id}
      nellaTuaLibreria={
        <NellaTuaLibreria libroId={result.data.libroId} propriaVoce={propriaVoce} />
      }
    />
  );
}
