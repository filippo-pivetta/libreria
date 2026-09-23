import { cache } from "react";
import { cookies } from "next/headers";

import {
  COOKIE_LUCE,
  preferenzaValida,
  risolviLuce,
  type Anchor,
  type Palette,
  type PreferenzaLuce,
} from "@/lib/light";

/**
 * La luce di questa richiesta, risolta una volta sola.
 *
 * Il layout radice la vuole due volte — `generateViewport` per il colore
 * della chrome del browser, `RootLayout` per gli attributi su `<html>` —
 * e prima erano due letture del cookie e due interpolazioni complete per
 * ogni pagina servita. `cache()` di React è memoization *di richiesta*:
 * due chiamate nella stessa richiesta danno lo stesso oggetto, due
 * richieste diverse non condividono nulla. Nessun valore attraversa mai
 * il confine fra due visitatori.
 *
 * Vive qui e non in `lib/light.ts` perché quel modulo lo importano anche
 * i componenti client (per il tipo `PreferenzaLuce` e il comando a tre
 * stati nel Profilo), e `next/headers` è solo del server: importarlo là
 * romperebbe la build del browser.
 */
export const luceCorrente = cache(async (): Promise<{ anchor: Anchor; palette: Palette }> => {
  return risolviLuce(await preferenzaLuce());
});

/** La sola preferenza espressa, senza risolverla in una palette: la
 * vuole il comando a tre stati nel Profilo, che deve mostrare quale
 * delle tre voci è selezionata, non il colore che ne esce. */
export const preferenzaLuce = cache(async (): Promise<PreferenzaLuce> => {
  return preferenzaValida((await cookies()).get(COOKIE_LUCE)?.value);
});
