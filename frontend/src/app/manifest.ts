import type { MetadataRoute } from "next";

import { ANCHORS, themeColorHex } from "@/lib/light";

/**
 * Il manifesto dell'app installata.
 *
 * Non è una funzione nuova: è ciò che permette a Montaigne, aggiunto alla
 * schermata home, di aprirsi senza la barra degli indirizzi e con la sua
 * chrome del colore giusto — il presupposto della "futura app", a costo quasi
 * nullo oggi.
 *
 * **Perché qui la luce non si segue.** Il manifesto è generato una volta sola
 * in fase di build (`○ /manifest.webmanifest`), quindi seguire l'ora
 * significherebbe congelare per sempre l'ora in cui è girato il build — un
 * deploy notturno darebbe uno schermo di avvio scuro a mezzogiorno, per
 * sempre. Si usa l'ancoraggio "giorno", che è il valore neutro, e la luce vera
 * arriva subito dopo da `<meta name="theme-color">` in `generateViewport()`,
 * che invece è ricalcolato a ogni richiesta e vince su questo.
 *
 * `background_color` è il colore del riquadro di avvio, quello mostrato prima
 * che il primo byte di CSS arrivi: senza, sarebbe bianco puro, che è l'unico
 * colore che questa palette non contiene.
 *
 * Non intacca la regola 6 del PRD (nessuna pagina indicizzabile): il manifesto
 * descrive l'applicazione, non espone contenuti, e `start_url` porta alla
 * guardia di autenticazione come qualunque altra rotta.
 */
export default function manifest(): MetadataRoute.Manifest {
  const colore = themeColorHex(ANCHORS.giorno);

  return {
    name: "Montaigne",
    short_name: "Montaigne",
    description: "Le tue letture, in una stanza sola.",
    // `id` fissa l'identità dell'applicazione installata, che altrimenti
    // sarebbe `start_url`: il giorno che la pagina d'ingresso cambiasse,
    // il browser tratterebbe l'app come una seconda app e chi ce l'ha già
    // sulla schermata home si ritroverebbe due Montaigne.
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "it",
    theme_color: colore,
    background_color: colore,
    // Le tre icone che rendono l'app installabile davvero (issue PWA):
    // finora ce n'era una sola, `/favicon.ico`, e Chrome non offre
    // "installa" senza un PNG da 192 e uno da 512 — il manifesto c'era ma
    // il pulsante non compariva mai.
    //
    // La terza, "maskable", non è un doppione della seconda: Android non
    // disegna l'icona così com'è, la ritaglia nella forma decisa dal
    // lanciatore (cerchio, goccia, squircle). Su un'icona con gli angoli
    // già arrotondati e trasparenti quel ritaglio taglia due volte e la M
    // resta in un'unghia in mezzo al vuoto; la versione mascherabile ha
    // invece il fondo che arriva al bordo e la lettera dentro la zona
    // sicura (il cerchio centrale all'80% del lato).
    //
    // `purpose: "any"` va dichiarato: senza, un'icona vale per entrambi
    // gli usi e alcuni lanciatori sceglierebbero quella sbagliata.
    // Generate da `npm run icone` (frontend/scripts/build-icone.mts), non
    // disegnate a mano.
    icons: [
      { src: "/icone/icona-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/icona-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icone/icona-mascherabile-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      // `sizes` dice le due misure che il file contiene davvero, non "any":
      // Chrome apre l'.ico, misura, e con "any" registra a console un
      // "Resource size is not correct - typo in the Manifest?" a ogni
      // caricamento di pagina. È l'icona piccola, quella delle scorciatoie
      // sul desktop; l'installazione vera la reggono i due PNG sopra.
      { src: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
    ],
  };
}
