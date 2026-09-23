import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { me } from "@/lib/dati/profilo";
import { preferenzaLuce } from "@/lib/luce-richiesta";
import { ErrorState } from "@/components/states/error-state";
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
    return (
      <ErrorState
        message={
          profilo.status === "not_provisioned"
            ? t("assenze.accountIncompleto")
            : await messaggioErrore("libreriaNonCaricata", profilo.errore)
        }
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
