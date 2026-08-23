import { headers } from "next/headers";

/**
 * La stessa `Accept-Language` della richiesta in arrivo, da inoltrare
 * esplicitamente ai fetcher di `lib/api/*` che ne accettano una (issue #34,
 * `backend/app/core/lingua.py`): il fetch lato server di Next.js non eredita
 * gli header della richiesta in arrivo, a differenza del fetch del browser,
 * che manda già da solo la propria — per questo il valore va letto qui e
 * passato esplicitamente, solo dai Server Component che fanno il fetch
 * iniziale di una pagina (`app/(protected)/**\/page.tsx`, `layout.tsx`).
 *
 * Server-only per costruzione (`next/headers`): non importare questo modulo
 * da un Client Component.
 */
export async function accettaLinguaInoltrata(): Promise<string | undefined> {
  return (await headers()).get("accept-language") ?? undefined;
}
