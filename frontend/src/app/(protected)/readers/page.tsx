import { getUtenti } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { ElencoLettori } from "@/components/lettori/elenco-lettori";
import { getTranslations } from "next-intl/server";

/**
 * Lettori (design doc §16): l'elenco membri, con lo stato della
 * relazione verso chi guarda. Fetch iniziale lato server, idratato in
 * TanStack Query da `ElencoLettori` per le mutazioni successive (invio
 * di una richiesta) — stesso pattern di `page.tsx` per la libreria.
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

  return <ElencoLettori membriIniziali={result.data} />;
}
