import { useEffect } from "react";

/**
 * Registra `public/sw.js` e tiene aggiornata l'app installata.
 *
 * Il service worker dà a Montaigne installata una pagina propria quando la
 * rete non c'è e un guscio già pronto all'avvio (il perché, e la regola che
 * nessun dato di lettura entri in cache, stanno in testa a quel file).
 *
 * **In sviluppo il service worker si disinstalla invece di installarsi.**
 * `sw.js` conserva `/assets/…` dando per scontato che quei nomi contengano
 * l'impronta del contenuto: vero nel build, falso con `vite dev`, dove i moduli
 * cambiano a ogni salvataggio. La disinstallazione esplicita serve a chi ha
 * provato `vite preview` sulla stessa porta: quel service worker resterebbe
 * installato su `localhost` anche tornando a `vite dev`.
 *
 * **Il controllo della versione.** L'app installata può riprendere dalla
 * memoria per giorni senza rinavigare, e resterebbe su un deploy vecchio.
 * Quando torna in primo piano chiede `/version.json` (scritto dal build,
 * `vite.config.ts`) e, se è cambiato, ricarica una volta.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (import.meta.env.DEV) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrazioni) => registrazioni.forEach((r) => void r.unregister()));
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        // Il file del service worker non passa dalla cache HTTP del browser:
        // insieme al `Cache-Control: no-store` di `vercel.json`, è ciò che
        // garantisce che una versione nuova venga vista al primo avvio.
        updateViaCache: "none",
      })
      // Un fallimento qui non deve rompere la pagina: senza service worker
      // l'app funziona lo stesso, solo senza pagina propria quando la rete manca.
      .catch((errore) => console.warn("[sw] registrazione non riuscita", errore));
  }, []);

  useEffect(() => {
    const corrente = import.meta.env.VITE_APP_VERSION;
    if (!corrente || corrente === "dev") return;

    const controlla = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const risposta = await fetch("/version.json", { cache: "no-store" });
        const { version } = (await risposta.json()) as { version?: string };
        if (version && version !== corrente) window.location.reload();
      } catch {
        // Senza rete o risposta illeggibile: si riprova al prossimo ritorno.
      }
    };

    document.addEventListener("visibilitychange", controlla);
    return () => document.removeEventListener("visibilitychange", controlla);
  }, []);

  return null;
}
