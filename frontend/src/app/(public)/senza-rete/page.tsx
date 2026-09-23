import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * La pagina che si vede quando la rete non c'è.
 *
 * Non è raggiungibile navigando: la serve `public/sw.js` al posto di una
 * navigazione fallita. È lì che sta il perché — un'app aperta dalla schermata
 * home non ha barra degli indirizzi, quindi senza service worker mostrerebbe
 * la pagina d'errore del browser dentro una finestra da cui non si esce.
 *
 * Tre vincoli, tutti e tre non negoziabili per come viene consegnata:
 *
 * 1. **Niente dati.** Nessuna sessione, nessuna chiamata, nessun libro: la
 *    copia conservata nella cache del browser sopravvive alla disconnessione
 *    e alla cancellazione dell'account (docs/adr/0011), quindi non deve
 *    contenere niente di nessuno.
 * 2. **Deve funzionare senza JavaScript.** Viene servita proprio quando i
 *    moduli potrebbero non essere arrivati mai. Per questo "Riprova" è un
 *    collegamento vero a `/` e non un pulsante che ricarica: senza rete non
 *    fa nulla di visibile (il service worker riserve questa stessa pagina),
 *    quando la rete torna riapre Montaigne, e in nessuno dei due casi ha
 *    bisogno di essere idratato.
 * 3. **Sta fuori dalla guardia di autenticazione** (l'elenco di esclusioni in
 *    `src/proxy.ts`): dovendo comparire quando il server non si raggiunge,
 *    non può dipendere da una sessione che quel server dovrebbe validare.
 *
 * La luce (§3) è quella del momento in cui la pagina è stata messa in cache,
 * non quella dell'ora in cui si legge: è l'unico punto dell'app in cui la
 * stanza può risultare indietro di qualche ora, e non c'è modo di evitarlo
 * senza chiedere al server che ora è — cioè senza la rete che qui manca.
 */
export default async function SenzaRetePage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="flex flex-col gap-2 py-2 text-center">
            <p className="font-ui text-sm font-medium text-ink">{t("senzaRete.titolo")}</p>
            <p className="text-sm text-pretty text-ink-soft">{t("senzaRete.spiegazione")}</p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              /* eslint-disable-next-line @next/next/no-html-link-for-pages --
                 <Link> qui sarebbe il difetto, non la buona pratica: farebbe
                 una navigazione client (una richiesta RSC che il service
                 worker non intercetta e che senza rete fallisce da sola,
                 senza cambiare niente a schermo). Serve invece una richiesta
                 di documento vera, che è l'unica cosa che "riprova" può
                 voler dire qui — e che funziona anche se questa pagina non è
                 mai stata idratata. */
              render={<a href="/" />}
              className="mt-2 self-center"
            >
              {t("senzaRete.riprova")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
