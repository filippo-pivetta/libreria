import { useEffect } from "react";
import { useRouteError } from "react-router";

/**
 * L'ultima rete (issue #11): un errore che è sfuggito a tutto il resto. Prende
 * il posto dell'intera app.
 *
 * Le due frasi sono **scritte qui e solo in italiano**, invece di venire da
 * `generici.imprevisto`: se a rompersi è stato il provider della lingua,
 * chiamare `t()` qui non produce una traduzione, produce un secondo crash sopra
 * il primo. È l'unica deroga al catalogo in tutta l'app, e va lasciata dov'è.
 */
export default function ErroreRadice() {
  const errore = useRouteError();

  useEffect(() => {
    console.error(errore);
  }, [errore]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-lg font-medium text-ink">L’app non si è aperta</p>
      <p className="max-w-sm text-sm text-ink-soft">Riprova, o torna indietro.</p>
      {/* Scritto a mano di proposito: qui meno dipendenze si tirano dentro,
          meglio è. Alla misura dell'unica azione di una zona (44px). */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-[0.9375rem] font-medium text-on-accent"
      >
        Riprova
      </button>
    </div>
  );
}
