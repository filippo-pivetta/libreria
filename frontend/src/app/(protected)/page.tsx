import { getVoci } from "@/lib/api/voci";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { Scaffale } from "@/components/libreria/scaffale";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Libreria (design doc §7): scaffale di dorsi, vista predefinita di
 * questa issue (l'alternativa a elenco resta fuori). Fetch iniziale lato
 * server con il token già validato dal layout dell'area protetta;
 * `Scaffale` lo idrata in TanStack Query per le mutazioni successive
 * senza refetch completo.
 */
export default async function ProtectedHomePage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Il layout ha già verificato la sessione prima di renderizzare
    // questa pagina: se manca qui è una scadenza fra i due controlli,
    // non un errore di logica.
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const result = await getVoci(session.access_token, await accettaLinguaInoltrata());

  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("libreriaNonCaricata", result.errore)} />;
  }

  return <Scaffale vociIniziali={result.data} />;
}
