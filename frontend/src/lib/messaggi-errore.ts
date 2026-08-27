import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { erroreDi, type ErroreApi } from "@/lib/api/errore";
import type messaggi from "../../messages/it.json";

/**
 * Da `ErroreApi` a una frase, in italiano o in inglese.
 *
 * **La forma è sempre due frasi**, come chiede §19: la prima dice cosa
 * non è successo e ha per soggetto la cosa; la seconda dice il passo
 * successivo. Le due metà le sanno due posti diversi, ed è per questo che
 * prima non funzionava: il chiamante sa *cosa* stava facendo (la prima),
 * `lib/api` sa *perché* è fallito (la seconda), e la vecchia stringa
 * unica dentro `lib/api` poteva scrivere solo la seconda. Il risultato
 * era "Il server non risponde. Controlla la connessione e riprova." su
 * ogni cosa: nessun soggetto, nessuna traduzione, e il rimedio al posto
 * del fatto.
 *
 *   errori.recensioneNonSalvata   "La recensione non è stata salvata."
 *   rassicurazioni.…              "Il testo è ancora qui."
 *   ------------------------------------------------------------------
 *   "La recensione non è stata salvata. Il testo è ancora qui."
 *
 *   errori.votoNonSalvato         "Il voto non è stato registrato."
 *   rimedi.rete                   "Controlla la connessione e riprova."
 *   ------------------------------------------------------------------
 *   "Il voto non è stato registrato. Controlla la connessione e riprova."
 *
 * **Dove c'è una rassicurazione, questa prende il posto del rimedio.** A
 * chi ha appena scritto trecento parole importa più sapere che il testo
 * non è andato perso che sentirsi dire di riprovare, e tre frasi in un
 * toast sono un paragrafo. È la sola eccezione, e sta nel catalogo (non
 * in un elenco qui dentro) perché è una scelta di scrittura, non di
 * codice.
 *
 * **Un'assenza e una regola saltano la composizione**: hanno una frase
 * propria e completa, perché nominano una causa precisa che il dominio
 * del chiamante non conosce ("Questa voce non esiste più", "Il nuovo
 * totale è inferiore a un avanzamento già registrato"). Dire "Lo stato
 * non è cambiato. Riprova fra poco." su un 409 manderebbe a riprovare
 * all'infinito una cosa che la regola vieta.
 */

/** Le chiavi di `errori.*`, prese dal catalogo stesso: una chiave nuova
 * qui non compila finché non esiste in entrambe le lingue. */
export type DominioErrore = keyof (typeof messaggi)["errori"];

type Traduttore = {
  (chiave: string): string;
  has(chiave: string): boolean;
};

/**
 * Un `error_code` arriva dal backend, quindi diventa un pezzo di chiave
 * costruita a runtime. La forma si controlla prima di usarla: `.` aprirebbe
 * un percorso in un'altra sezione del catalogo, e `__proto__` risolverebbe
 * su `Object.prototype` invece che su una frase, facendo comparire la chiave
 * nuda a schermo. Oggi i codici li scrivono i nostri router e sono tutti
 * `[a-z0-9_]+`, ma questa funzione non deve dipendere da chi la chiama.
 */
const CHIAVI_VELENOSE = new Set(["__proto__", "constructor", "prototype"]);

function codiceValido(codice: string | undefined): codice is string {
  if (codice === undefined || CHIAVI_VELENOSE.has(codice)) return false;
  // Lettere, cifre e underscore: copre sia gli `error_code` del backend
  // (`snake_case`) sia le chiavi di `assenze.*` (`camelCase`). Il punto
  // resta fuori — è il separatore di sezione, e lasciarlo passare vorrebbe
  // dire poter puntare a un'altra parte del catalogo.
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(codice);
}

export function componiMessaggio(
  t: Traduttore,
  dominio: DominioErrore,
  errore?: ErroreApi,
): string {
  // Un'assenza e una regola hanno una frase propria e intera. Solo loro:
  // `ERRORE_MODELLO` porta un `codice` ma è di genere `server`, e la sua
  // prima frase la scrive il chiamante come per ogni altro guasto.
  if (errore && (errore.genere === "assenza" || errore.genere === "regola") && codiceValido(errore.codice)) {
    const sezione = errore.genere === "assenza" ? "assenze" : "regole";
    const chiave = `${sezione}.${errore.codice}`;
    // Un codice che il catalogo non conosce (un `error_code` nuovo del
    // backend, o `regola(undefined)`) non è un vicolo cieco: si ricade
    // sulla composizione, che una frase sensata la produce comunque.
    if (t.has(chiave)) return t(chiave);
  }

  const fatto = t(`errori.${dominio}`);
  const rassicurazione = `rassicurazioni.${dominio}`;
  const seguito = t.has(rassicurazione)
    ? t(rassicurazione)
    : t(`rimedi.${errore?.genere ?? "server"}`);

  return `${fatto} ${seguito}`;
}

/**
 * La versione da componente client, che è dove sta quasi tutta la
 * scrittura dell'app.
 *
 * Sostituisce il modo in cui si faceva prima:
 *
 *     showError(error instanceof Error ? error.message : t("errori.votoNonSalvato"))
 *
 * dove il ramo `t(...)` non si raggiungeva mai — `mutationFn` lancia
 * sempre un `Error`, quindi il ternario sceglieva sempre l'altro. Le
 * diciassette frasi tradotte del catalogo erano codice morto, e a schermo
 * arrivava la stringa di trasporto. Ora la frase si compone al punto in
 * cui si lancia o si cattura, e il dominio è un argomento obbligatorio:
 * dimenticarlo non compila.
 */
export function useMessaggioErrore() {
  const t = useTranslations() as unknown as Traduttore;
  return useCallback(
    (dominio: DominioErrore, errore?: ErroreApi) => componiMessaggio(t, dominio, errore),
    [t],
  );
}

/**
 * Se riprovare può servire a qualcosa.
 *
 * Un guasto di trasporto passa: la rete torna, il server si riprende, il
 * limitatore scade. Una regola no — un 409 dirà no anche al secondo
 * tentativo — e nemmeno un'assenza o una sessione scaduta, che hanno
 * rimedi diversi e propri. Offrire "Riprova" lì sarebbe invitare a
 * ripetere un gesto che non può riuscire.
 */
export function riprovabile(errore?: ErroreApi): boolean {
  return (
    errore === undefined ||
    errore.genere === "rete" ||
    errore.genere === "server" ||
    errore.genere === "limite"
  );
}

/**
 * Il gesto completo: componi la frase, e offri il rimedio solo se può
 * funzionare.
 *
 * Sta qui e non nei componenti perché la scelta "questo si può
 * riprovare" è una regola sola, e ripetuta a mano in nove `onError`
 * sarebbe divergita al primo genere nuovo.
 */
export function useAvvisa() {
  const spiega = useMessaggioErrore();
  return useCallback(
    (
      showError: (messaggio: string, onRiprova?: () => void) => void,
      dominio: DominioErrore,
      lanciato: unknown,
      riprova: () => void,
    ) => {
      const errore = erroreDi(lanciato);
      showError(spiega(dominio, errore), riprovabile(errore) ? riprova : undefined);
    },
    [spiega],
  );
}
