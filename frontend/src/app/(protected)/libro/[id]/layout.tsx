import { getMe } from "@/lib/api/me";
import { getCollegamenti } from "@/lib/api/collegamenti";
import { getVoceDettaglio } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { ProtectedNav } from "@/components/layout/protected-nav";
import { BarraContestoLibro } from "@/components/libro/barra-contesto-libro";

function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl flex-1 p-6 text-ink">{children}</main>;
}

/**
 * Layout di `/libro/[id]` (design doc §9, §15): decide qui, con un
 * fetch, se il libro è tuo o di un collegato — cosa che `Chrome` non può
 * sapere dal solo pathname (issue #3) — e sceglie di conseguenza la
 * barra globale (con un fetch indipendente di nome/contatore, stesso
 * costo già accettato per `/lettori/[id]`) o quella contestuale del
 * libro. `Chrome` toglie comunque la barra globale in partenza per
 * questa rotta: qui, se il libro è tuo, viene semplicemente rimessa.
 */
export default async function LibroLayout(props: LayoutProps<"/libro/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <Pagina>
        <ErrorState message="La sessione è scaduta. Ricarica la pagina." />
      </Pagina>
    );
  }

  const voce = await getVoceDettaglio(session.access_token, id);

  if (voce.status === "not_found") {
    return (
      <Pagina>
        <ErrorState title="Non trovata" message="Questa voce non esiste, o non è tua." />
      </Pagina>
    );
  }
  if (voce.status === "error") {
    return (
      <Pagina>
        <ErrorState message={voce.message} />
      </Pagina>
    );
  }

  const isOwner = voce.data.utenteId === session.user.id;

  if (isOwner) {
    const me = await getMe(session.access_token);
    const collegamenti = await getCollegamenti(session.access_token);
    const receivedRequestCount =
      collegamenti.status === "ok"
        ? collegamenti.data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe).length
        : undefined;

    return (
      <>
        <ProtectedNav
          userName={me.status === "ok" ? me.data.nomeUtente : ""}
          receivedRequestCount={receivedRequestCount}
        />
        <Pagina>{props.children}</Pagina>
      </>
    );
  }

  const collegato = await getLibreriaCollegato(session.access_token, voce.data.utenteId);
  const nomeCollegato = collegato.status === "ok" ? collegato.utente.nomeUtente : "";

  return (
    <div data-guest className="flex flex-1 flex-col">
      <BarraContestoLibro
        utenteId={voce.data.utenteId}
        nomeUtente={nomeCollegato}
        titoloLibro={voce.data.libro.titoloCanonico}
      />
      <Pagina>{props.children}</Pagina>
    </div>
  );
}
