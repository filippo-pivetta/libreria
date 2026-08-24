import { cookies } from "next/headers";

import { COOKIE_LUCE, preferenzaValida } from "@/lib/light";
import { getMe } from "@/lib/api/me";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { SezioneImpostazioni } from "@/components/profilo/sezione-impostazioni";
import { getTranslations } from "next-intl/server";

/**
 * Profilo (design doc §17): il proprio account e nient'altro — chi sei,
 * chi vede cosa, la luce della stanza, il consenso all'elaborazione
 * assistita, l'esportazione dei libri letti, la cancellazione
 * dell'account.
 *
 * Era "Torre" ed era la quarta voce della barra, con dentro anche i
 * collegamenti. I collegamenti sono passati a Lettori, dove stanno le
 * persone; ciò che restava è un'area che si apre una volta al mese, e
 * una voce di barra la metteva alla pari di tre che si aprono ogni
 * giorno. Ora ci si arriva dalle proprie iniziali (`PortaProfilo`).
 *
 * Il nome viene dal PRD, che chiama "profilo" questa superficie
 * ("Interruttore nel profilo dell'Utente") e riserva "impostazioni" alle
 * azioni sui dati — che sono infatti i titoli delle sezioni qui dentro.
 *
 * 44px / 56px, come il titolo di Lettori (`readers/page.tsx`) e come
 * quello degli Annali: un titolo di pagina ha una misura sola in tutta
 * l'app, non una a scelta di chi scrive la pagina.
 */
export default async function ProfiloPage() {
  const t = await getTranslations();
  const preferenzaLuce = preferenzaValida((await cookies()).get(COOKIE_LUCE)?.value);
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const me = await getMe(session.access_token);

  if (me.status !== "ok") {
    return (
      <ErrorState
        message={
          me.status === "not_provisioned" ? t("sessione.accountIncompleto") : me.message
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="t-display text-[44px] sm:text-[56px]">Profilo</h1>
      <SezioneImpostazioni
        preferenzaLuce={preferenzaLuce}
        nomeUtente={me.data.nomeUtente}
        consensoIniziale={me.data.consensoElaborazioneAssistita}
        indiciStatoIniziale={me.data.indiciStato}
      />
    </div>
  );
}
