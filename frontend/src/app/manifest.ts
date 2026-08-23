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
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "it",
    theme_color: colore,
    background_color: colore,
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
