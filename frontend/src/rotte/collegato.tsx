import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { vociMie } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScaffale } from "@/components/states/scheletri";
import { Scaffale } from "@/components/libreria/scaffale";

/**
 * Scheda "Libreria" del contesto di un collegato (design doc §15): la
 * barra contestuale e la verifica dell'accesso vivono nel layout
 * (`layout.tsx` in questa stessa cartella); questa pagina aggiunge il
 * conteggio "libri in comune", che serve solo qui.
 *
 * `libreriaCollegato` è la stessa funzione che chiama il layout: la
 * memoization di richiesta la risolve una volta sola, quindi il fetch
 * non è più duplicato come quando entrambi chiamavano il fetcher nudo.
 */
export default function LibreriaCollegatoPage(props: PageProps<"/lettori/[id]">) {
  return (
    <Suspense fallback={<ScheletroScaffale />}>
      <ScaffaleDelCollegato params={props.params} />
    </Suspense>
  );
}

async function ScaffaleDelCollegato({ params }: { params: PageProps<"/lettori/[id]">["params"] }) {
  const { id } = await params;
  const [propria, collegato] = await Promise.all([vociMie(), libreriaCollegato(id)]);

  if (collegato.status !== "ok") {
    // Il layout ha già verificato l'accesso prima di renderizzare questa
    // pagina: se arriva qui un esito diverso è una corsa fra le due
    // richieste (es. interruzione nel frattempo), non un errore di
    // logica — un messaggio generico basta, il layout la intercetterà
    // al prossimo caricamento.
    const t = await getTranslations();
    return <ErrorState message={t("assenze.libreriaIrraggiungibile")} />;
  }

  const libroIdPropri = new Set(propria.status === "ok" ? propria.data.map((v) => v.libroId) : []);
  const inComune = collegato.voci.filter((v) => libroIdPropri.has(v.libroId)).length;

  // Il conteggio dei volumi è salito nella testata (BarraContesto,
  // sottotitolo sotto il suo nome): chiede solo la SUA libreria, quindi ci
  // sta anche nel layout condiviso con Annali. "In comune" resta qui,
  // perché chiede anche la TUA — ripeterlo nella testata di entrambe le
  // schede l'avrebbe reso una spiegazione invece che un fatto.
  return (
    <div className="flex flex-col gap-6">
      {inComune > 0 && (
        <p className="t-meta">
          {inComune} {inComune === 1 ? "libro" : "libri"} in comune con te
        </p>
      )}

      <Scaffale vociIniziali={collegato.voci} utenteCollegatoId={id} />
    </div>
  );
}
