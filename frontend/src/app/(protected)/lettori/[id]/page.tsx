import { getVoci } from "@/lib/api/voci";
import { getLibreriaCollegato } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scaffale } from "@/components/libreria/scaffale";
import { ASSENZE, SESSIONE } from "@/messaggi/it";

/**
 * Scheda "Libreria" del contesto di un collegato (design doc §15): la
 * barra contestuale e la verifica dell'accesso vivono nel layout
 * (`layout.tsx` in questa stessa cartella) — questa pagina fa solo il
 * proprio fetch (il layout non passa dati alle pagine figlie in Next.js)
 * e aggiunge il conteggio "libri in comune", che serve solo qui.
 */
export default async function LibreriaCollegatoPage(props: PageProps<"/lettori/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={SESSIONE.scaduta} />;
  }

  const [propria, collegato] = await Promise.all([
    getVoci(session.access_token),
    getLibreriaCollegato(session.access_token, id),
  ]);

  if (collegato.status !== "ok") {
    // Il layout ha già verificato l'accesso prima di renderizzare questa
    // pagina: se arriva qui un esito diverso è una corsa fra le due
    // richieste (es. interruzione nel frattempo), non un errore di
    // logica — un messaggio generico basta, il layout la intercetterà
    // al prossimo caricamento.
    return <ErrorState message={ASSENZE.libreriaIrraggiungibile} />;
  }

  const libroIdPropri = new Set(propria.status === "ok" ? propria.data.map((v) => v.libroId) : []);
  const inComune = collegato.voci.filter((v) => libroIdPropri.has(v.libroId)).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="t-label">
          La sua libreria
          <span className="ml-1.5 normal-case font-normal tracking-normal text-ink-soft">
            · {collegato.voci.length} {collegato.voci.length === 1 ? "volume" : "volumi"}
            {inComune > 0 ? ` · ${inComune} in comune con te` : ""}
          </span>
        </p>
      </div>

      <Scaffale vociIniziali={collegato.voci} utenteCollegatoId={id} />
    </div>
  );
}
