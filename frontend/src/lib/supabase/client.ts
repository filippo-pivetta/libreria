import { createClient as creaClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Il client Supabase del browser, uno per pagina.
 *
 * Serve solo all'autenticazione: accesso, uscita, rinnovo del token e lettura
 * del link d'invito (`detectSessionInUrl`, attivo di default, legge il
 * frammento `#access_token=…` su `/completa-account`, docs/adr/0013). I dati
 * passano tutti dal backend, che verifica il JWT su ogni richiesta (ADR 0012).
 *
 * La sessione sta in `localStorage`, come fa supabase-js di default. La chiave
 * è quella pubblicabile (`sb_publishable_…`): può stare nel bundle, perché da
 * sola non apre niente — nulla di `public` è raggiungibile senza un utente
 * autenticato (ADR 0006).
 */
export function createClient(): SupabaseClient {
  client ??= creaClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
