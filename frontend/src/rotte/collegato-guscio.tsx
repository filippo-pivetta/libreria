import { useQuery } from "@tanstack/react-query";
import { Outlet, useParams } from "react-router";
import { useTranslations } from "use-intl";

import { libreriaCollegato } from "@/lib/dati/membri";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { BarraContesto } from "@/components/lettori/barra-contesto";

function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">{children}</main>;
}

/**
 * Il guscio del contesto di un collegato (design doc §15): la testata
 * `BarraContesto` sopra le due schede, e l'unico punto in cui si verifica
 * l'accesso — sia la Libreria sia gli Annali lo ereditano, non lo ripetono.
 *
 * La stanza si apre solo dopo la risposta, deliberatamente: questa lettura non
 * serve solo alla testata, decide se la stanza è ancora aperta (§15). Mostrare
 * prima lo scaffale lo farebbe comparire per un istante anche a chi il
 * collegamento non ce l'ha più. Le due schede leggono la stessa libreria, già
 * in cache: una richiesta sola.
 */
export default function CollegatoGuscio() {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const { id = "" } = useParams();
  const { data: result, isPending, refetch } = useQuery(libreriaCollegato(id));

  if (isPending) {
    return (
      <Pagina>
        <div role="status" aria-busy>
          <span className="sr-only">Un momento…</span>
          <ScheletroScaffale />
        </div>
      </Pagina>
    );
  }

  if (result?.status === "not_found") {
    return (
      <Pagina>
        <ErrorState title={t("titoli.nonTrovato")} message={t("assenze.utenteInesistente")} />
      </Pagina>
    );
  }
  if (result?.status === "non_collegato") {
    return (
      <Pagina>
        <div className="flex flex-col items-start gap-3">
          {/* Non "sei stato rimosso", non "errore": una stanza chiusa
              (design doc §15). */}
          <ErrorState
            title={t("titoli.nonPiuAccessibile")}
            message={t("assenze.libreriaChiusa")}
          />
          {/* In una pagina che è un vicolo cieco, l'unica via d'uscita non
              può avere il peso più leggero della scala. */}
          <Button render={<Link href="/readers" />} nativeButton={false} variant="outline">
            Torna ai lettori
          </Button>
        </div>
      </Pagina>
    );
  }
  if (!result || result.status === "error") {
    return (
      <Pagina>
        <ErrorState
          message={spiega("metricheSueNonCaricate", result?.errore)}
          azione={<RiprovaRotta riprova={refetch} />}
        />
      </Pagina>
    );
  }

  const n = result.voci.length;
  const sottotitolo = `${n} ${n === 1 ? "volume" : "volumi"}`;

  return (
    <div data-guest className="flex flex-1 flex-col">
      <BarraContesto utenteId={id} nomeUtente={result.utente.nomeUtente} sottotitolo={sottotitolo} />
      <Pagina>
        <Outlet />
      </Pagina>
    </div>
  );
}
