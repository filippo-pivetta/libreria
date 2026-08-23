"use server";

import { cookies } from "next/headers";

import { COOKIE_LUCE, preferenzaValida, type PreferenzaLuce } from "@/lib/light";

/** Un anno: la preferenza sulla luce non è una sessione, è un'abitudine. */
const DURATA_S = 60 * 60 * 24 * 365;

/**
 * Scrive la preferenza sulla luce.
 *
 * Server Action e non una rotta API: il cookie deve essere `httpOnly` — non
 * serve a nessuno script del browser, perché la palette la calcola il server —
 * e va scritto prima del render successivo, che è esattamente ciò che
 * `router.refresh()` innesca subito dopo.
 *
 * `preferenzaValida` normalizza qualunque valore inatteso a "ora": il
 * parametro arriva dal client come ogni altro, e non c'è ragione di fidarsene.
 */
export async function impostaLuce(preferenza: PreferenzaLuce): Promise<void> {
  (await cookies()).set(COOKIE_LUCE, preferenzaValida(preferenza), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURATA_S,
  });
}
