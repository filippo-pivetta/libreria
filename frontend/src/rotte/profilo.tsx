import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { me } from "@/lib/dati/profilo";
import { preferenzaLuce } from "@/lib/luce-richiesta";
import { ErrorState } from "@/components/states/error-state";
import { RiprovaRotta } from "@/components/states/riprova-rotta";
import { ScheletroElenco } from "@/components/states/scheletri";
import { TestataPagina } from "@/components/layout/testata-pagina";
import { SezioneImpostazioni } from "@/components/profilo/sezione-impostazioni";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

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
export default function ProfiloPage() {
  return (
    <div className="flex flex-col gap-8">
      <TestataPagina titolo="Profilo" />
      <Suspense
        fallback={
          <>
            <ScheletroElenco righe={3} />
            <ScheletroElenco righe={4} />
          </>
        }
      >
        <Impostazioni />
      </Suspense>
    </div>
  );
}

async function Impostazioni() {
  const [profilo, luce] = await Promise.all([me(), preferenzaLuce()]);

  if (profilo.status !== "ok") {
    const t = await getTranslations();
    // Un account incompleto non è un guasto e non si riprova: ha una
    // frase propria e nessun comando. Tutto il resto sì.
    //
    // `profiloNonCaricato` e non `libreriaNonCaricata`: qui non è la
    // libreria a non essere arrivata, ed è la prima clausola — quella che
    // nomina la cosa (§19) — a doverlo dire. Dal Profilo si leggeva "La
    // libreria non è arrivata" su una pagina che di libri non ne mostra.
    const incompleto = profilo.status === "not_provisioned";
    return (
      <ErrorState
        regione
        message={
          incompleto
            ? t("assenze.accountIncompleto")
            : await messaggioErrore("profiloNonCaricato", profilo.errore)
        }
        azione={incompleto ? undefined : <RiprovaRotta />}
      />
    );
  }

  return (
    <SezioneImpostazioni
      preferenzaLuce={luce}
      nomeUtente={profilo.data.nomeUtente}
      consensoIniziale={profilo.data.consensoElaborazioneAssistita}
      indiciStatoIniziale={profilo.data.indiciStato}
    />
  );
}
