import { getScheda } from "@/lib/api/schede";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { SchedaPubblica } from "@/components/scheda-pubblica/scheda-pubblica";
import { getTranslations } from "next-intl/server";

/**
 * La scheda di un libro che NON si ha in libreria (design doc §13).
 *
 * Rotta a sé e non un parametro di `/libro/[id]`: quella prende un
 * `voce_id`, cioè per costruzione un libro che qualcuno ha già. È la
 * lacuna che il design doc dichiarava — "il parere prima dell'aggiunta ha
 * senso su una scheda di libro non ancora in libreria, non in un elenco,
 * ma oggi manca sia la scheda sia la rotta".
 *
 * Due segmenti e non uno (`/book/catalogo/{libroId}`,
 * `/book/google/{volumeId}`) perché i due identificativi vengono da due
 * spazi di nomi diversi e non sono distinguibili a occhio: un solo
 * segmento avrebbe richiesto di indovinare quale dei due si sta leggendo.
 *
 * URL in inglese ([#41](docs/lavoro-rimandato.md)): le rotte nuove
 * nascono già dalla parte giusta, invece di aggiungere un'altra riga
 * italiana da tradurre poi.
 *
 * `alt` porta gli identificativi delle altre edizioni della stessa opera,
 * quando si arriva da una riga di ricerca che li conosceva: servono solo
 * ad aggiungere (più ISBN in mano, più probabilità che l'identità
 * dell'opera si chiuda — `app/services/risoluzione.py`). Senza, la carta
 * funziona lo stesso e l'aggiunta parte con un ISBN solo: è un
 * miglioramento della risoluzione, non un dato di cui la pagina ha
 * bisogno.
 */
export default async function BookPage(props: PageProps<"/book/[fonte]/[id]">) {
  const { fonte, id } = await props.params;
  const { alt } = await props.searchParams;
  const t = await getTranslations();

  if (fonte !== "catalogo" && fonte !== "google") {
    return <ErrorState title="Non trovata" message="Questa pagina non esiste." />;
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <ErrorState message={t("sessione.scaduta")} />;
  }

  const lingua = await accettaLinguaInoltrata();
  const result = await getScheda(session.access_token, fonte, id, lingua);

  if (result.status === "not_found") {
    return (
      <ErrorState title="Non trovato" message="Questo libro non è nei cataloghi. Rifai la ricerca." />
    );
  }
  if (result.status === "fonte_irraggiungibile") {
    // Stato distinto da "non esiste": chi guarda deve sapere che il libro
    // potrebbe esserci e che è il catalogo a non rispondere (§13).
    return <ErrorState message="I cataloghi non rispondono. Riprova fra poco." />;
  }
  if (result.status === "error") {
    return <ErrorState message={result.message} />;
  }

  const volumiAlternativi =
    typeof alt === "string" && alt.length > 0 ? alt.split(",").filter(Boolean) : [];

  return (
    <SchedaPubblica
      schedaIniziale={result.data}
      fonte={fonte}
      identificativo={id}
      volumiAlternativi={volumiAlternativi}
    />
  );
}
