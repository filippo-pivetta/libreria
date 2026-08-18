import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rinnova la sessione Supabase a ogni richiesta e propaga i cookie
 * aggiornati sulla response. Va invocata dal Proxy radice (vedi
 * src/proxy.ts — file convention che ha sostituito "middleware" in
 * Next.js 16): è l'unico punto in cui i Server Component, che non
 * possono scrivere cookie, ottengono un token sempre valido.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Variabili non ancora configurate (es. subito dopo lo scaffold, prima
    // di copiare .env.example in .env.local): si salta il refresh della
    // sessione invece di far fallire ogni richiesta, Proxy compreso.
    console.warn(
      "[proxy] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY non impostate: " +
        "sessione Supabase non aggiornata su questa richiesta.",
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nessuna logica di autorizzazione qui: solo il refresh del token.
  // Le regole su chi vede cosa vivono nel database (RLS), non nel middleware.
  await supabase.auth.getUser();

  return supabaseResponse;
}
