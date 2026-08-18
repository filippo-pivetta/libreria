import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase per componenti lato browser ("use client").
 * Opera con l'identità dell'utente autenticato: le regole di riga (RLS)
 * restano sempre valutate, mai bypassate (vedi docs/adr/0001).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
