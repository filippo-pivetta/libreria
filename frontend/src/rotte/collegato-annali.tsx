import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useTranslations } from "use-intl";

import { vociMie } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { metricheMie, metricheCollegato } from "@/lib/dati/metriche";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { PaginaAnnaliCollegato } from "@/components/annali/pagina-annali-collegato";

/**
 * Scheda "Annali" del contesto di un collegato (design doc §15, issue #7): le
 * sue metriche di lettura, calcolate sui suoi dati. `GET /utenti/{id}/metriche`
 * resta protetta esplicitamente (403 `non_collegato` distinto da 404 utente
 * inesistente), come `GET /utenti/{id}/voci`.
 *
 * Quattro letture in parallelo, non in cascata — le due librerie servono solo
 * ai libri in comune, le due metriche alla scheda e all'affiancamento — e il
 * loader della rotta le ha già fatte partire tutte e quattro.
 */
export default function AnnaliCollegatoPage() {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const { id = "" } = useParams();
  const propria = useQuery(vociMie());
  const collegato = useQuery(libreriaCollegato(id));
  const metrichePropria = useQuery(metricheMie());
  const metricheSue = useQuery(metricheCollegato(id));

  if (collegato.isPending || metricheSue.isPending || metrichePropria.isPending || propria.isPending) {
    return <ScheletroAnnali />;
  }

  if (collegato.data?.status !== "ok") {
    // Corsa fra le richieste, non un errore di logica: il guscio ha già
    // verificato l'accesso (stesso trattamento di `rotte/collegato.tsx`).
    return <ErrorState message={t("assenze.libreriaIrraggiungibile")} />;
  }
  if (metricheSue.data?.status !== "ok") {
    return (
      <ErrorState
        message={spiega(
          "metricheSueNonCaricate",
          metricheSue.data?.status === "error" ? metricheSue.data.errore : undefined,
        )}
        azione={<RiprovaRotta riprova={metricheSue.refetch} />}
      />
    );
  }

  return (
    <PaginaAnnaliCollegato
      utenteId={id}
      nomeUtente={collegato.data.utente.nomeUtente}
      metricheCollegatoIniziali={metricheSue.data.data}
      metrichePropriaIniziale={metrichePropria.data?.status === "ok" ? metrichePropria.data.data : null}
      vociProprie={propria.data?.status === "ok" ? propria.data.data : []}
      vociCollegato={collegato.data.voci}
    />
  );
}
