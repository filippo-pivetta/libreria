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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
