import { datiBarra } from "@/lib/dati/barra";
import { voceDettaglio } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { contesto } from "@/lib/dati/sessione";
import { ErrorState } from "@/components/states/error-state";
import { ProtectedNav } from "@/components/layout/protected-nav";
import { BarraContestoLibro } from "@/components/libro/barra-contesto-libro";
import { BarraRitorno } from "@/components/libro/barra-ritorno";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">{children}</main>;
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
  const t = await getTranslations();

  const { utenteId } = await contesto();
  const voce = await voceDettaglio(id);

  if (voce.status === "not_found") {
    return (
      <Pagina>
        <ErrorState title={t("titoli.nonTrovata")} message={t("assenze.voceNonTua")} />
      </Pagina>
    );
  }
  if (voce.status === "error") {
    return (
      <Pagina>
        <ErrorState message={await messaggioErrore("libroNonCaricato", voce.errore)} />
      </Pagina>
    );
  }

  const isOwner = voce.data.utenteId === utenteId;

  if (isOwner) {
    return (
      <>
        {/* La promessa non si attende qui: la barra la consuma nei propri
            confini di attesa, e il contenuto del libro non deve fermarsi
            per un nome e un contatore. Sono comunque gli stessi dati che
            il layout dell'area protetta ha già chiesto, quindi di fatto
            già pronti. */}
        <ProtectedNav dati={datiBarra()} />
        {/* Sotto i 640px `ProtectedNav` non monta niente in cima, quindi
            senza questa barra la scheda del proprio libro non ha nessun
            ritorno — mentre quella di un collegato ce l'ha. */}
        <BarraRitorno />
        <Pagina>{props.children}</Pagina>
      </>
    );
  }

  const collegato = await libreriaCollegato(voce.data.utenteId);
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
