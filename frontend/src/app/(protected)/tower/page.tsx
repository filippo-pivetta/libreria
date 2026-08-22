import { getCollegamenti } from "@/lib/api/collegamenti";
import { getMe } from "@/lib/api/me";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { SezioneCollegamenti } from "@/components/torre/sezione-collegamenti";
import { SezioneImpostazioni } from "@/components/torre/sezione-impostazioni";

/**
 * Torre (design doc §17): una superficie sola, due sezioni. Sopra i
 * collegamenti, sotto le impostazioni — avviso di visibilità, consenso
 * all'elaborazione assistita (issue #6), esportazione dei libri letti e
 * cancellazione dell'account (issue #8, ADR 0011 rivisto).
 */
export default async function TowerPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message="La sessione è scaduta. Ricarica la pagina." />;
  }

  const [collegamenti, me] = await Promise.all([
    getCollegamenti(session.access_token),
    getMe(session.access_token),
  ]);

  if (collegamenti.status === "error") {
    return <ErrorState message={collegamenti.message} />;
  }
  if (me.status !== "ok") {
    return (
      <ErrorState
        message={
          me.status === "not_provisioned"
            ? "Il tuo account non risulta completato."
            : me.message
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <SezioneCollegamenti collegamentiIniziali={collegamenti.data} />

      <div className="border-t border-line pt-8">
        <SezioneImpostazioni
          nomeUtente={me.data.nomeUtente}
          consensoIniziale={me.data.consensoElaborazioneAssistita}
          indiciStatoIniziale={me.data.indiciStato}
        />
      </div>
    </div>
  );
}
