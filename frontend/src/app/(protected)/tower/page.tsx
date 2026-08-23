import { cookies } from "next/headers";

import { COOKIE_LUCE, preferenzaValida } from "@/lib/light";
import { getCollegamenti } from "@/lib/api/collegamenti";
import { getMe } from "@/lib/api/me";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { SezioneCollegamenti } from "@/components/torre/sezione-collegamenti";
import { SezioneImpostazioni } from "@/components/torre/sezione-impostazioni";
import { getTranslations } from "next-intl/server";

/**
 * Torre (design doc §17): una superficie sola, due sezioni. Sopra i
 * collegamenti, sotto le impostazioni — avviso di visibilità, consenso
 * all'elaborazione assistita (issue #6), esportazione dei libri letti e
 * cancellazione dell'account (issue #8, ADR 0011 rivisto).
 */
export default async function TowerPage() {
  const t = await getTranslations();
  const preferenzaLuce = preferenzaValida((await cookies()).get(COOKIE_LUCE)?.value);
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
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
            ? t("sessione.accountIncompleto")
            : me.message
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Chi sei, e la via d’uscita.
          Sotto i 640px la barra in alto non c’è — la navigazione è passata in
          fondo (§5, sessione UI) — e con lei sparivano nome utente ed "Esci",
          che stavano solo lì. La Torre è la loro sede naturale: è la
          schermata del proprio account, e "Interrompi", "Esporta" e "Cancella
          l’account" sono già tutte qui. Visibile a ogni larghezza: su desktop
          resta anche in barra, e vederlo due volte nel posto giusto non è un
          difetto. */}
      <div className="flex items-center justify-between gap-4 border-b border-line pb-6">
        <p className="t-meta">
          Sei entrato come <span className="text-ink">{me.data.nomeUtente}</span>
        </p>
        <SignOutButton />
      </div>

      <SezioneCollegamenti collegamentiIniziali={collegamenti.data} />

      <div className="border-t border-line pt-8">
        <SezioneImpostazioni
          preferenzaLuce={preferenzaLuce}
          nomeUtente={me.data.nomeUtente}
          consensoIniziale={me.data.consensoElaborazioneAssistita}
          indiciStatoIniziale={me.data.indiciStato}
        />
      </div>
    </div>
  );
}
