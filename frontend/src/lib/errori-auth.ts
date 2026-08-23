/**
 * Traduzione degli errori del fornitore di autenticazione.
 *
 * Il design doc §6 è esplicito: "la stringa del fornitore di autenticazione va
 * tradotta, mai mostrata grezza". Non lo era: `login/page.tsx` faceva
 * `setError(signInError.message)` e sotto il campo compariva, in inglese,
 * "Invalid login credentials" — l'unica frase di tutta l'app scritta da
 * qualcun altro, in un'altra lingua, nel punto in cui l'utente entra.
 *
 * Si confronta su `code` quando c'è (Supabase lo espone dal 2024) e si ricade
 * sul testo solo per i casi che il codice non copre. Il ripiego finale non
 * ripete l'errore originale: se non sappiamo tradurlo, dirlo in inglese non
 * aiuta chi legge, e "riprova" è comunque l'unica azione disponibile.
 */
const PER_CODICE: Record<string, string> = {
  invalid_credentials: "Email o password non corrispondono.",
  email_not_confirmed: "Questo indirizzo non è ancora stato confermato.",
  user_banned: "Questo account non è più attivo. Parla con chi mantiene l’istanza.",
  over_request_rate_limit: "Troppi tentativi di seguito. Aspetta un minuto e riprova.",
  validation_failed: "Controlla l’indirizzo email e riprova.",
};

const PER_TESTO: [RegExp, string][] = [
  [/invalid login credentials/i, "Email o password non corrispondono."],
  [/email not confirmed/i, "Questo indirizzo non è ancora stato confermato."],
  [/rate limit|too many requests/i, "Troppi tentativi di seguito. Aspetta un minuto e riprova."],
  [/failed to fetch|network/i, "Il server non risponde. Controlla la connessione e riprova."],
];

export function traduciErroreAuth(errore: { message?: string; code?: string } | null): string {
  if (!errore) return "L’accesso non è riuscito. Riprova.";
  if (errore.code && PER_CODICE[errore.code]) return PER_CODICE[errore.code];
  const testo = errore.message ?? "";
  for (const [schema, traduzione] of PER_TESTO) {
    if (schema.test(testo)) return traduzione;
  }
  return "L’accesso non è riuscito. Riprova.";
}
