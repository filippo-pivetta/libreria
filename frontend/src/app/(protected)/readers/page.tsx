import { getUtenti } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { TestataPagina } from "@/components/layout/testata-pagina";
import { ElencoLettori } from "@/components/lettori/elenco-lettori";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Lettori (design doc §16): le persone e l'intero ciclo di vita del
 * rapporto con loro — richieste ricevute, collegamenti, altri lettori —
 * in una pagina sola. Accettare, rifiutare, ritirare e interrompere si
 * facevano nel profilo: qui la richiesta sta dove sta la persona.
 *
 * Fetch iniziale lato server, idratato in TanStack Query da
 * `ElencoLettori` per la ricerca e le mutazioni successive — stesso
 * pattern di `page.tsx` per la libreria.
 *
 * Il titolo di pagina sta qui e non nel componente client: prima non
 * c'era affatto, e una pagina senza `<h1>` non ha un punto d'ingresso
 * per chi naviga a salti con un lettore di schermo.
 *
 * Il corpo non è più scritto qui: `.t-page` (tokens.css) porta la scala
 * 44/56 insieme al proprio asse ottico, e `TestataPagina` aggiunge la
 * barra che raccoglie la parola quando il titolo esce dallo schermo su
 * mobile. Erano sei chiamate a ripetere `text-[44px] sm:text-[56px]`.
 */
export default async function ReadersPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const result = await getUtenti(session.access_token);

  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("lettoriNonCaricati", result.errore)} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <TestataPagina titolo="Lettori" />
      <ElencoLettori elencoIniziale={result.data} />
    </div>
  );
}
