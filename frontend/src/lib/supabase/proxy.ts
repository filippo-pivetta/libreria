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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect di rotta, non un confine di sicurezza: quale dato ciascuno
  // vede resta deciso dalla RLS nel database (docs/adr/0001), non da
  // questo controllo. Qui si evita solo di mostrare la shell dell'area
  // protetta a chi non ha una sessione, e di rimandare al login chi ce
  // l'ha già. Il layout dell'area protetta ripete comunque il controllo
  // lato server come seconda linea, nel caso il matcher sotto non copra
  // una rotta futura.
  const isPublicRoute = request.nextUrl.pathname === "/login";

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return withRefreshedCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  if (user && isPublicRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return withRefreshedCookies(NextResponse.redirect(homeUrl), supabaseResponse);
  }

  return supabaseResponse;
}

// Un redirect è una NextResponse nuova: senza ricopiare qui i cookie di
// sessione eventualmente rinnovati da `setAll` sopra, il refresh del
// token andrebbe perso su questo hop (non l'utente disconnesso: solo un
// giro di richiesta in più prima che il cookie aggiornato arrivi al
// browser).
function withRefreshedCookies(response: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}
