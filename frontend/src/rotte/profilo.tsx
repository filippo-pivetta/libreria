import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { me } from "@/lib/dati/profilo";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroElenco } from "@/components/states/scheletri";
import { TestataPagina } from "@/components/layout/testata-pagina";
import { SezioneImpostazioni } from "@/components/profilo/sezione-impostazioni";

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
 * 44px / 56px, come il titolo di Lettori (`rotte/lettori.tsx`) e come
 * quello degli Annali: un titolo di pagina ha una misura sola in tutta
 * l'app, non una a scelta di chi scrive la pagina.
 */
export default function ProfiloPage() {
  return (
    <div className="flex flex-col gap-8">
      <TestataPagina titolo="Profilo" />
      <Impostazioni />
    </div>
  );
}

function Impostazioni() {
  const t = useTranslations();
  const spiega = useMessaggioErrore();
  const { data: profilo, isPending, refetch } = useQuery(me());

  if (isPending) {
    return (
      <>
        <ScheletroElenco righe={3} />
        <ScheletroElenco righe={4} />
      </>
    );
  }

  if (!profilo || profilo.status !== "ok") {
    // Un account incompleto non è un guasto e non si riprova: ha una
    // frase propria e nessun comando. Tutto il resto sì.
    //
    // `profiloNonCaricato` e non `libreriaNonCaricata`: qui non è la
    // libreria a non essere arrivata, ed è la prima clausola — quella che
    // nomina la cosa (§19) — a doverlo dire. Dal Profilo si leggeva "La
    // libreria non è arrivata" su una pagina che di libri non ne mostra.
    const incompleto = profilo?.status === "not_provisioned";
    return (
      <ErrorState
        regione
        message={
          incompleto
            ? t("assenze.accountIncompleto")
            : spiega("profiloNonCaricato", profilo?.status === "error" ? profilo.errore : undefined)
        }
        azione={incompleto ? undefined : <RiprovaRotta riprova={refetch} />}
      />
    );
  }

  return (
    <SezioneImpostazioni
      nomeUtente={profilo.data.nomeUtente}
      consensoIniziale={profilo.data.consensoElaborazioneAssistita}
      indiciStatoIniziale={profilo.data.indiciStato}
    />
  );
}
