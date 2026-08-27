/**
 * Dagli errori del fornitore di autenticazione alle chiavi del catalogo.
 *
 * Il design doc §6 è esplicito: "la stringa del fornitore di
 * autenticazione va tradotta, mai mostrata grezza". Non lo era:
 * `login/page.tsx` faceva `setError(signInError.message)` e sotto il campo
 * compariva, in inglese, "Invalid login credentials" — l'unica frase di
 * tutta l'app scritta da qualcun altro, in un'altra lingua, nel punto in
 * cui l'utente entra.
 *
 * **Questa funzione restituisce una chiave, non una frase.** Prima
 * restituiva la frase, in italiano: la traduzione c'era, ma solo una, e
 * l'accesso restava l'unica schermata dove un inglese trovava italiano
 * proprio nel momento in cui entrava. Ora la frase la sceglie il
 * catalogo, in entrambe le lingue.
 *
 * Si confronta su `code` quando c'è (Supabase lo espone dal 2024) e si
 * ricade sul testo solo per i casi che il codice non copre. Il ripiego
 * finale non ripete l'errore originale: se non sappiamo tradurlo, dirlo
 * in inglese non aiuta chi legge, e "riprova" è comunque l'unica azione
 * disponibile.
 */

type ChiaveAccesso =
  | "accesso.credenzialiErrate"
  | "accesso.emailNonConfermata"
  | "accesso.emailNonValida"
  | "accesso.accountSospeso"
  | "accesso.troppiTentativi"
  | "accesso.reteAssente"
  | "accesso.generico";

const PER_CODICE: Record<string, ChiaveAccesso> = {
  invalid_credentials: "accesso.credenzialiErrate",
  email_not_confirmed: "accesso.emailNonConfermata",
  user_banned: "accesso.accountSospeso",
  over_request_rate_limit: "accesso.troppiTentativi",
  validation_failed: "accesso.emailNonValida",
};

const PER_TESTO: [RegExp, ChiaveAccesso][] = [
  [/invalid login credentials/i, "accesso.credenzialiErrate"],
  [/email not confirmed/i, "accesso.emailNonConfermata"],
  [/rate limit|too many requests/i, "accesso.troppiTentativi"],
  [/failed to fetch|network/i, "accesso.reteAssente"],
];

export function traduciErroreAuth(
  errore: { message?: string; code?: string } | null,
): ChiaveAccesso {
  if (!errore) return "accesso.generico";
  if (errore.code && PER_CODICE[errore.code]) return PER_CODICE[errore.code];
  const testo = errore.message ?? "";
  for (const [schema, chiave] of PER_TESTO) {
    if (schema.test(testo)) return chiave;
  }
  return "accesso.generico";
}
