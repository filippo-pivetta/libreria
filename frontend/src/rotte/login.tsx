"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { QUOTES } from "@/lib/quotes";
import { traduciErroreAuth } from "@/lib/errori-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { Messaggio } from "@/components/ui/messaggio";

// No real subscription: only here to satisfy useSyncExternalStore's signature.
function noSubscription() {
  return () => {};
}

/**
 * The quote is picked at random out of ten (fix of Aug 19, 2026).
 * useSyncExternalStore, not useEffect+setState: a Math.random() in the
 * initial render would give a different text on server and browser, and
 * Next.js would flag a hydration mismatch (design doc §3, same caution
 * already used for light). getServerSnapshot fixes the first quote for
 * the SSR render, getSnapshot picks one at random once in the browser.
 */
function useRandomQuote(): number {
  const index = useRef<number | undefined>(undefined);
  return useSyncExternalStore(
    noSubscription,
    () => {
      if (index.current === undefined) {
        index.current = Math.floor(Math.random() * QUOTES.length);
      }
      return index.current;
    },
    () => 0
  );
}

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const quoteIndex = useRandomQuote();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      // Mai la stringa grezza del fornitore (design doc §6): finora qui
      // compariva "Invalid login credentials", in inglese, sotto un campo
      // etichettato in italiano.
      setError(t(traduciErroreAuth(signInError)));
      return;
    }

    // The Proxy (src/proxy.ts) refreshes the session on every request;
    // the refresh here only kicks off the redirect the protected-area
    // layout already handles.
    router.replace("/");
    router.refresh();
  }

  return (
    // Vertical split (design doc §6): the sign on the left on plane 0
    // (the lamp behind it is the room's own, already on the public
    // layout's container), the module on the right. Single column on
    // mobile, where the sign shrinks and the module takes the rest.
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 md:py-0">
        {/* Design doc §1: the name "Montaigne" appears only here, on the login screen — never elsewhere in the interface. */}
        <p className="t-display text-center text-[clamp(2.75rem,7vw,5.5rem)] text-ink">
          Montaigne
        </p>
        {/* The quote disappears under 600px of height: it’s the first thing to give. */}
        <p className="t-sentenza max-w-xs text-center text-ink-soft [@media(max-height:600px)]:hidden">
          “{QUOTES[quoteIndex]}”
        </p>
      </div>

      {/* The module isn’t a rectangle sitting on a background: a full
          field of paper, no border and no shadow — the boundary between
          the two planes is the luminance jump alone (design doc §6). No
          .plane-1 here: that utility carries a border and a double
          shadow, deliberately excluded. */}
      <div className="flex flex-1 items-center justify-center bg-surface-1 px-6 py-12">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-4">
              {/* Fields as lines: underline, small label above, a form filled in by hand instead of a rectangle. */}
              <div className="flex flex-col gap-0.5 border-b border-line-strong pb-1 transition-colors focus-within:border-ink">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="nome@esempio.it"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-7 rounded-none border-0 bg-transparent px-0 py-0 text-base"
                />
              </div>
              <div className="flex flex-col gap-0.5 border-b border-line-strong pb-1 transition-colors focus-within:border-ink">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-7 rounded-none border-0 bg-transparent px-0 py-0 text-base"
                />
              </div>
              {/* Design doc §6: l'errore d'accesso è testo in `ink` sotto
                  il campo, non un riquadro rosso. Passa dal primitivo come
                  ogni altro messaggio dell'app: era l'ultimo `<p>` scritto
                  a mano, e quindi l'ultimo senza regione `aria-live`. */}
              <Messaggio className="text-sm">{error}</Messaggio>
            </div>

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? t("attesa.generica") : "Entra"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
