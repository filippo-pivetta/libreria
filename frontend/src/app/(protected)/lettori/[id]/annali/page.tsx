import { getVoci } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { getMetriche, getMetricheCollegato } from "@/lib/api/metriche";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { PaginaAnnaliCollegato } from "@/components/annali/pagina-annali-collegato";
import { getTranslations } from "next-intl/server";

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
 * renderizzare questa pagina (stesso schema di `../page.tsx`): quattro
 * fetch in parallelo, non in cascata — le due librerie servono solo ai
 * libri in comune, le due metriche alla scheda e all'affiancamento.
 */
export default async function AnnaliCollegatoPage(props: PageProps<"/lettori/[id]/annali">) {
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
  const [propria, collegato, metrichePropria, metricheCollegato] = await Promise.all([
    getVoci(session.access_token, lingua),
    getLibreriaCollegato(session.access_token, id, lingua),
    getMetriche(session.access_token, undefined, lingua),
    getMetricheCollegato(session.access_token, id, undefined, lingua),
  ]);

  if (collegato.status !== "ok") {
    // Corsa fra le richieste, non un errore di logica: il layout ha già
    // verificato l'accesso (stesso trattamento di ../page.tsx).
    return <ErrorState message={t("assenze.libreriaIrraggiungibile")} />;
  }
  if (metricheCollegato.status !== "ok") {
    return (
      <ErrorState
        message={
          metricheCollegato.status === "error"
            ? metricheCollegato.message
            : t("errori.metricheSueNonCaricate")
        }
      />
    );
  }

  return (
    <PaginaAnnaliCollegato
      utenteId={id}
      metricheCollegatoIniziali={metricheCollegato.data}
      metrichePropriaIniziale={metrichePropria.status === "ok" ? metrichePropria.data : null}
      vociProprie={propria.status === "ok" ? propria.data : []}
      vociCollegato={collegato.voci}
    />
  );
}
