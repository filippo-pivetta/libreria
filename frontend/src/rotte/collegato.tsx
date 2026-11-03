import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useTranslations } from "use-intl";

import { vociMie } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { Scaffale } from "@/components/libreria/scaffale";

/**
 * Scheda "Libreria" del contesto di un collegato (design doc §15): la testata
 * e la verifica dell'accesso vivono nel guscio (`rotte/collegato-guscio.tsx`);
 * questa pagina aggiunge il conteggio "libri in comune", che serve solo qui.
 */
export default function LibreriaCollegatoPage() {
  const t = useTranslations();
  const { id = "" } = useParams();
  const propria = useQuery(vociMie());
  const collegato = useQuery(libreriaCollegato(id));

  if (collegato.isPending) return <ScheletroScaffale />;

  if (collegato.data?.status !== "ok") {
    // Il guscio ha già verificato l'accesso: un esito diverso qui è una corsa
    // fra le richieste (es. interruzione nel frattempo), non un errore di
    // logica — un messaggio generico basta.
    return <ErrorState message={t("assenze.libreriaIrraggiungibile")} />;
  }

  const libroIdPropri = new Set(
    propria.data?.status === "ok" ? propria.data.data.map((v) => v.libroId) : [],
  );
  const inComune = collegato.data.voci.filter((v) => libroIdPropri.has(v.libroId)).length;

  // Il conteggio dei volumi sta nella testata (BarraContesto): chiede solo la
  // SUA libreria. "In comune" resta qui, perché chiede anche la TUA.
  return (
    <div className="flex flex-col gap-6">
      {inComune > 0 && (
        <p className="t-meta">
          {inComune} {inComune === 1 ? "libro" : "libri"} in comune con te
        </p>
      )}

      <Scaffale vociIniziali={collegato.data.voci} utenteCollegatoId={id} />
    </div>
  );
}
