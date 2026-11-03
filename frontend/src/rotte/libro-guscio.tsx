import { useQuery } from "@tanstack/react-query";
import { Outlet, useParams } from "react-router";
import { useTranslations } from "use-intl";

import { useDatiBarra } from "@/lib/dati/barra";
import { voceDettaglio } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { contesto } from "@/lib/dati/sessione";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroScheda } from "@/components/states/scheletri";
import { ProtectedNav } from "@/components/layout/protected-nav";
import { BarraContestoLibro } from "@/components/libro/barra-contesto-libro";
import { BarraRitorno } from "@/components/libro/barra-ritorno";

function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">{children}</main>;
}

/**
 * Il guscio di `/libro/:id` (design doc §9, §15): decide, dalla voce, se il
 * libro è tuo o di un collegato — cosa che `Chrome` non può sapere dal solo
 * percorso (issue #3) — e sceglie di conseguenza la barra globale o quella
 * contestuale del libro. `Chrome` toglie comunque la barra globale in partenza
 * per questa rotta: qui, se il libro è tuo, viene semplicemente rimessa.
 *
 * La pagina figlia legge la stessa voce, già in cache: una richiesta sola.
 */
export default function LibroGuscio() {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const { id = "" } = useParams();
  const sessione = useQuery(contesto());
  const voce = useQuery(voceDettaglio(id));
  const datiBarra = useDatiBarra();

  const proprietario = voce.data?.status === "ok" ? voce.data.data.utenteId : undefined;
  // Solo quando entrambi sono noti: con la sessione ancora da leggere ogni
  // libro sembrerebbe di un altro, e partirebbe la lettura della libreria di
  // un "collegato" che sei tu (403).
  const ospite =
    proprietario !== undefined && sessione.data !== undefined && proprietario !== sessione.data.utenteId;
  const collegato = useQuery({ ...libreriaCollegato(proprietario ?? ""), enabled: ospite });

  if (voce.isPending || sessione.isPending) {
    return (
      <Pagina>
        <ScheletroScheda />
      </Pagina>
    );
  }

  if (voce.data?.status === "not_found") {
    return (
      <Pagina>
        <ErrorState title={t("titoli.nonTrovata")} message={t("assenze.voceNonTua")} />
      </Pagina>
    );
  }
  if (!voce.data || voce.data.status === "error") {
    return (
      <Pagina>
        <ErrorState
          message={spiega("libroNonCaricato", voce.data?.status === "error" ? voce.data.errore : undefined)}
          azione={<RiprovaRotta riprova={voce.refetch} />}
        />
      </Pagina>
    );
  }

  if (!ospite) {
    return (
      <>
        {/* La barra consuma i propri dati nei propri confini di attesa: il
            contenuto del libro non si ferma per un nome e un contatore. */}
        <ProtectedNav dati={datiBarra} />
        {/* Sotto i 640px `ProtectedNav` non monta niente in cima, quindi
            senza questa barra la scheda del proprio libro non ha nessun
            ritorno — mentre quella di un collegato ce l'ha. */}
        <BarraRitorno />
        <Pagina>
          <Outlet />
        </Pagina>
      </>
    );
  }

  const nomeCollegato = collegato.data?.status === "ok" ? collegato.data.utente.nomeUtente : "";

  return (
    <div data-guest className="flex flex-1 flex-col">
      <BarraContestoLibro
        utenteId={voce.data.data.utenteId}
        nomeUtente={nomeCollegato}
        titoloLibro={voce.data.data.libro.titoloCanonico}
      />
      <Pagina>
        <Outlet />
      </Pagina>
    </div>
  );
}
