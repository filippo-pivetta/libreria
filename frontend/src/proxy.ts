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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
