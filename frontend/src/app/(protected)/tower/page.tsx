import { getCollegamenti } from "@/lib/api/collegamenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { SezioneCollegamenti } from "@/components/torre/sezione-collegamenti";

const NOTA_IMPOSTAZIONI =
  "Avviso di visibilità, consenso all'elaborazione assistita e cancellazione dell'account " +
  "arrivano con le prossime issue.";

/**
 * Torre (design doc §17): una superficie sola, due sezioni. Questa
 * issue costruisce solo "collegamenti" (richieste ricevute/inviate,
 * collegamenti attivi con interruzione). "Impostazioni" (avviso di
 * visibilità, consenso all'elaborazione assistita, cancellazione
 * account) dipende dalle issue #6/#8, non ancora costruite: resta una
 * nota, non un'implementazione.
 */
export default async function TowerPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message="La sessione è scaduta. Ricarica la pagina." />;
  }

  const result = await getCollegamenti(session.access_token);

  if (result.status === "error") {
    return <ErrorState message={result.message} />;
  }

  return (
    <div className="flex flex-col gap-10">
      <SezioneCollegamenti collegamentiIniziali={result.data} />

      <section className="flex flex-col gap-2 border-t border-line pt-8">
        <p className="t-label">Impostazioni</p>
        <p className="t-meta max-w-md">{NOTA_IMPOSTAZIONI}</p>
      </section>
    </div>
  );
}
