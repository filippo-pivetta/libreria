"use client";

import { useEffect } from "react";

/**
 * Registra `public/sw.js`, il service worker che dà a Montaigne installata
 * una pagina propria quando la rete non c'è (il perché sta in testa a quel
 * file, insieme alla regola che nessun dato di lettura entri in cache).
 *
 * Un componente che non disegna nulla e sta nel layout radice: la
 * registrazione è un effetto del browser, e il layout radice è l'unico punto
 * che copre sia l'area protetta sia il login. Deve valere anche lì — chi
 * apre l'app installata dopo una disconnessione atterra sul login, ed è
 * proprio la schermata su cui il dinosauro farebbe più danno.
 *
 * **In sviluppo il service worker si disinstalla invece di installarsi.**
 * Non è prudenza generica: `sw.js` conserva `/_next/static/…` dando per
 * scontato che quei nomi contengano l'impronta del contenuto, cosa vera nel
 * build e falsa con `next dev`, dove lo stesso nome cambia contenuto a ogni
 * salvataggio. Registrarlo in sviluppo vorrebbe dire servire moduli vecchi a
 * caso e rincorrere per mezz'ora un bug che non esiste. La disinstallazione
 * esplicita serve a chi ha provato `next build && next start` sulla stessa
 * porta: quel service worker resterebbe installato su `localhost` anche
 * tornando a `next dev`, e non c'è modo di accorgersene se non da DevTools.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrazioni) => registrazioni.forEach((r) => void r.unregister()));
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        // Il file del service worker non passa dalla cache HTTP del browser:
        // insieme al `Cache-Control: no-store` dichiarato in next.config.ts,
        // è ciò che garantisce che una versione nuova venga vista al primo
        // avvio e non dopo ore.
        updateViaCache: "none",
      })
      // Un fallimento qui non deve rompere la pagina: senza service worker
      // l'app funziona esattamente come prima, solo senza pagina propria
      // quando la rete manca.
      .catch((errore) => console.warn("[sw] registrazione non riuscita", errore));
  }, []);

  return null;
}
