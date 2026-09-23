import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";

/**
 * Il contesto di richiesta che ogni fetcher di questo strato vuole: il
 * token con cui chiamare il backend e la lingua da inoltrargli.
 */
export type Contesto = {
  accessToken: string;
  utenteId: string;
  lingua: string | undefined;
};

/**
 * La sessione di questa richiesta, risolta una volta sola.
 *
 * `cache()` di React è memoization **di richiesta**: due chiamate nella
 * stessa richiesta danno lo stesso oggetto, due richieste diverse non
 * condividono nulla. Prima ogni pagina e ogni layout costruivano il
 * proprio `createServerClient` e rileggevano i cookie per conto loro —
 * fino a quattro volte per navigazione sulla scheda di un libro.
 *
 * Chi non ha sessione viene mandato al login invece di ricevere un esito
 * da gestire: il Proxy (`src/proxy.ts`) e il layout dell'area protetta
 * hanno già rediretto prima di arrivare qui, quindi il ramo non si
 * raggiunge in pratica — ma è la difesa in profondità che il layout
 * dichiara, non una svista, e tenerla qui fa sparire lo stesso controllo
 * ripetuto (e irraggiungibile) da undici Server Component.
 */
export const contesto = cache(async (): Promise<Contesto> => {
  const supabase = await createClient();

  // `getClaims` e non il solo `getSession`: verifica la FIRMA del token
  // in locale con WebCrypto (chiavi asimmetriche via JWKS, docs/adr/0012),
  // senza interrogare il server di autenticazione. Prima questa verifica
  // la faceva solo il layout dell'area protetta, una volta, all'ingresso:
  // ogni altro punto si accontentava di `getSession`, che il cookie lo
  // legge e basta. Standogli qui, ogni accesso ai dati di questa
  // richiesta passa da una firma verificata, non solo la prima pagina.
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims) {
    redirect("/login");
  }

  // Sicuro solo perché `getClaims` sopra ha già verificato la firma: qui
  // si rilegge il token validato — e già rinnovato, perché è `getClaims`
  // a rinnovarlo quando sta per scadere.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return {
    accessToken: session.access_token,
    utenteId: session.user.id,
    lingua: await accettaLinguaInoltrata(),
  };
});
