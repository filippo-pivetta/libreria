import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // robots.txt esclusa: deve rispondere 200 senza redirect a un
    // crawler anonimo, altrimenti la regola 6 (docs/prd.md) non ha
    // effetto — un redirect a /login servirebbe HTML al posto del
    // testo robots.txt.
    //
    // manifest.webmanifest esclusa per la stessa ragione, non per una
    // nuova: il browser lo richiede fuori dal contesto della pagina e
    // senza credenziali, quindi passando di qui riceveva un redirect a
    // /login e con esso l'HTML della pagina d'accesso al posto del JSON —
    // l'app installata restava senza nome, senza colore e senza schermo
    // di avvio. Non allarga la superficie esposta: il manifesto contiene
    // il nome dell'app, la descrizione e due colori, nessun dato di
    // lettura e nessun file conservato dal sistema.
    //
    // sw.js e senza-rete escluse per la stessa ragione delle due sopra,
    // entrambe imposte dall'app installata (public/sw.js):
    //
    // - il file del service worker viene richiesto dal browser fuori dal
    //   contesto della pagina; passando di qui, chi non ha sessione ne
    //   riceverebbe un redirect al login, e la registrazione fallirebbe
    //   perché al posto di JavaScript arriva HTML;
    // - /senza-rete è la pagina che il service worker serve quando il
    //   server non si raggiunge: farla dipendere da una sessione che quel
    //   server dovrebbe validare è una contraddizione, e la copia messa in
    //   cache durante l'installazione sarebbe la pagina di login. Non
    //   contiene dati: due righe e un collegamento a "/".
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sw.js|senza-rete|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
