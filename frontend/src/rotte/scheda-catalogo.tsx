import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";

import { scheda } from "@/lib/dati/catalogo";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroScheda } from "@/components/states/scheletri";
import { SchedaPubblica } from "@/components/scheda-pubblica/scheda-pubblica";
import type { FonteScheda } from "@/lib/api/schede";

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
export default function BookPage() {
  const t = useTranslations();
  const { fonte = "", id = "" } = useParams();

  if (fonte !== "catalogo" && fonte !== "google") {
    return <ErrorState title={t("titoli.nonTrovata")} message={t("assenze.paginaInesistente")} />;
  }

  return <Carta fonte={fonte} id={id} />;
}

function Carta({ fonte, id }: { fonte: FonteScheda; id: string }) {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const [parametri] = useSearchParams();
  const alt = parametri.get("alt");
  const { data: result, isPending, refetch } = useQuery(scheda(fonte, id));

  if (isPending) return <ScheletroScheda />;
  if (!result) {
    return (
      <ErrorState
        message={spiega("schedaNonCaricata")}
        azione={<RiprovaRotta riprova={refetch} />}
      />
    );
  }

  if (result.status === "not_found") {
    return (
      <ErrorState title={t("titoli.nonTrovato")} message={t("assenze.libroFuoriCatalogo")} />
    );
  }
  if (result.status === "fonte_irraggiungibile") {
    // Stato distinto da "non esiste": chi guarda deve sapere che il libro
    // potrebbe esserci e che è il catalogo a non rispondere (§13).
    return <ErrorState message={t("avvisi.cataloghiMuti")} />;
  }
  if (result.status === "error") {
    return (
      <ErrorState
        message={spiega("schedaNonCaricata", result.errore)}
        azione={<RiprovaRotta riprova={refetch} />}
      />
    );
  }

  const volumiAlternativi =
    alt && alt.length > 0 ? alt.split(",").filter(Boolean) : [];

  return (
    <SchedaPubblica
      schedaIniziale={result.data}
      fonte={fonte}
      identificativo={id}
      volumiAlternativi={volumiAlternativi}
    />
  );
}
