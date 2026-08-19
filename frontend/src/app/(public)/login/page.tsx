"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { SENTENZE_MONTAIGNE } from "@/lib/montaigne-sentenze";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/states/error-state";

// Nessun abbonamento reale: serve solo a soddisfare la firma di useSyncExternalStore.
function nessunaSottoscrizione() {
  return () => {};
}

/**
 * La sentenza è scelta a caso fra una decina (fix del 19 agosto 2026).
 * useSyncExternalStore, non useEffect+setState: un Math.random() nel
 * render iniziale darebbe un testo diverso fra server e browser, e
 * Next.js segnalerebbe un mismatch di idratazione (design doc §3,
 * stessa cautela già seguita per la luce). getServerSnapshot fissa la
 * prima sentenza per il render SSR, getSnapshot sceglie a caso una
 * volta sola nel browser.
 */
function useSentenzaCasuale(): number {
  const indice = useRef<number | undefined>(undefined);
  return useSyncExternalStore(
    nessunaSottoscrizione,
    () => {
      if (indice.current === undefined) {
        indice.current = Math.floor(Math.random() * SENTENZE_MONTAIGNE.length);
      }
      return indice.current;
    },
    () => 0
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sentenzaIndex = useSentenzaCasuale();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Il Proxy (src/proxy.ts) rinnova la sessione a ogni richiesta; il
    // refresh qui serve solo a far ripartire subito il redirect gestito
    // dal layout dell'area protetta.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Design doc §1: il nome "Montaigne" compare solo qui, sulla schermata d'accesso — mai altrove nell'interfaccia. L'unico posto che merita l'incisione piena (.incisione-insegna), non il trattamento minuto riservato ai titoli di scheda. */}
      <p className="incisione-insegna font-heading text-4xl tracking-[0.08em] text-foreground">
        Montaigne
      </p>

      {/* materia-carta (design doc §2): colore pieno più rumore SVG. materia-foglio: angoli quasi vivi e ombra corta — un foglio appoggiato sul legno, non una scheda sospesa. */}
      <div className="materia-carta materia-foglio w-full px-7 py-7 ring-1 ring-foreground/10">
        {error && <ErrorState title="Accesso non riuscito" message={error} />}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-4">
            {/* Campi come righe, non riquadri (fix del 19 agosto 2026): sottolineatura, etichetta piccola sopra, un modulo compilato a mano invece che un form. */}
            <div className="flex flex-col gap-0.5 border-b border-foreground/25 pb-1 transition-colors focus-within:border-foreground/70">
              <Label
                htmlFor="email"
                className="text-[11px] font-normal tracking-[0.1em] text-muted-foreground uppercase"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="nome@esempio.it"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-7 rounded-none border-0 bg-transparent px-0 py-0 text-base focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-col gap-0.5 border-b border-foreground/25 pb-1 transition-colors focus-within:border-foreground/70">
              <Label
                htmlFor="password"
                className="text-[11px] font-normal tracking-[0.1em] text-muted-foreground uppercase"
              >
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="la tua password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-7 rounded-none border-0 bg-transparent px-0 py-0 text-base focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Rosso riservato al nastro (design doc §5): il pulsante è inchiostro, non primary rosso. Una parola sola, diversa dal titolo che non c'è più. */}
          <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? "Un momento…" : "Entra"}
          </Button>
        </form>
      </div>

      {/*
        Una sentenza dei Saggi, incisa nel legno sotto il foglio (design
        doc §1): la metafora delle travi si spiega da sola, senza
        spiegarla a parole. Taglia e interlinea del trattamento
        "sentenza" (§8, ~19px, incisione, interlinea larga): è la taglia
        a cui l'asse ottico di Literata regge l'incisione — più piccola,
        col corsivo, i due contorni di .incisione si accavallano sui
        tratti sottili e la scritta legge "sgranata" invece che incisa.
      */}
      <p className="incisione max-w-xs text-center text-[19px] leading-relaxed text-pretty text-foreground">
        “{SENTENZE_MONTAIGNE[sentenzaIndex]}”
      </p>
    </div>
  );
}
