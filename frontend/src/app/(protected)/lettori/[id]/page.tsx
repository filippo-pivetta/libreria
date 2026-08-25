import { getVoci } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scaffale } from "@/components/libreria/scaffale";
import { getTranslations } from "next-intl/server";

/**
 * Scheda "Libreria" del contesto di un collegato (design doc §15): la
 * barra contestuale e la verifica dell'accesso vivono nel layout
 * (`layout.tsx` in questa stessa cartella) — questa pagina fa solo il
 * proprio fetch (il layout non passa dati alle pagine figlie in Next.js)
 * e aggiunge il conteggio "libri in comune", che serve solo qui.
 */
export default async function LibreriaCollegatoPage(props: PageProps<"/lettori/[id]">) {
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
  const [propria, collegato] = await Promise.all([
    getVoci(session.access_token, lingua),
    getLibreriaCollegato(session.access_token, id, lingua),
  ]);

  if (collegato.status !== "ok") {
    // Il layout ha già verificato l'accesso prima di renderizzare questa
    // pagina: se arriva qui un esito diverso è una corsa fra le due
    // richieste (es. interruzione nel frattempo), non un errore di
    // logica — un messaggio generico basta, il layout la intercetterà
    // al prossimo caricamento.
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
      {inComune > 0 && <p className="t-meta">{inComune} {inComune === 1 ? "libro" : "libri"} in comune con te</p>}

      <Scaffale vociIniziali={collegato.voci} utenteCollegatoId={id} />
    </div>
  );
}
