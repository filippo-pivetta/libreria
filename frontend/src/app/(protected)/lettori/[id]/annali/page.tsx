import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { vociMie } from "@/lib/dati/letture";
import { libreriaCollegato } from "@/lib/dati/membri";
import { metricheMie, metricheCollegato as metricheDelCollegato } from "@/lib/dati/metriche";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { PaginaAnnaliCollegato } from "@/components/annali/pagina-annali-collegato";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Scheda "Annali" del contesto di un collegato (design doc §15, issue
 * #7): le sue metriche di lettura, calcolate sui suoi dati — la
 * visibilità è già garantita dalla RLS di collegamento (nessuna riga di
 * lettura è raggiungibile senza un collegamento attivo, issue #3), ma
 * `GET /utenti/{id}/metriche` resta comunque protetta esplicitamente
 * (403 `non_collegato` distinto da 404 utente inesistente), come
 * `GET /utenti/{id}/voci`.
 *
 * Il layout di questa cartella ha già verificato l'accesso prima di
 * renderizzare questa pagina: quattro fetch in parallelo, non in
 * cascata — le due librerie servono solo ai libri in comune, le due
 * metriche alla scheda e all'affiancamento. Una di quelle quattro,
 * `libreriaCollegato`, è la stessa che il layout ha già risolto: passando
 * da `lib/dati` non è più una seconda andata di rete.
 */
export default function AnnaliCollegatoPage(props: PageProps<"/lettori/[id]/annali">) {
  return (
    <Suspense fallback={<ScheletroAnnali />}>
      <AnnaliDelCollegato params={props.params} />
    </Suspense>
  );
}

async function AnnaliDelCollegato({
  params,
}: {
  params: PageProps<"/lettori/[id]/annali">["params"];
}) {
  const { id } = await params;
  const [propria, collegato, metrichePropria, metricheSue] = await Promise.all([
    vociMie(),
    libreriaCollegato(id),
    metricheMie(),
    metricheDelCollegato(id),
  ]);

  if (collegato.status !== "ok") {
    // Corsa fra le richieste, non un errore di logica: il layout ha già
    // verificato l'accesso (stesso trattamento di ../page.tsx).
    const t = await getTranslations();
    return <ErrorState message={t("assenze.libreriaIrraggiungibile")} />;
  }
  if (metricheSue.status !== "ok") {
    return (
      <ErrorState
        message={await messaggioErrore(
          "metricheSueNonCaricate",
          metricheSue.status === "error" ? metricheSue.errore : undefined,
        )}
      />
    );
  }

  return (
    <PaginaAnnaliCollegato
      utenteId={id}
      nomeUtente={collegato.utente.nomeUtente}
      metricheCollegatoIniziali={metricheSue.data}
      metrichePropriaIniziale={metrichePropria.status === "ok" ? metrichePropria.data : null}
      vociProprie={propria.status === "ok" ? propria.data : []}
      vociCollegato={collegato.voci}
    />
  );
}
