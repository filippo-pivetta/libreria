import { getUtenti } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { ElencoLettori } from "@/components/lettori/elenco-lettori";
import { getTranslations } from "next-intl/server";

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
 * 44px / 56px (mobile / da 640px in su) e non `text-4xl` (36px, la prima
 * versione di questo titolo): è la stessa coppia di misure del titolo
 * degli Annali (`intestazione-annali.tsx`), l'unico altro titolo di
 * pagina vero nell'app, e il valore che `docs/design/sistema/Testo.dc.html`
 * propone per il ruolo "titolo di pagina" di `.t-display`.
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
    return <ErrorState message={result.message} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="t-display text-[44px] sm:text-[56px]">Lettori</h1>
      <ElencoLettori elencoIniziale={result.data} />
    </div>
  );
}
