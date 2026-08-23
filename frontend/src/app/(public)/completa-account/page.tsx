"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { completeAccount, getMe } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
// Testi del PRD, parola per parola (docs/design-frontend.md §17):
// dall'issue #6 servono anche nelle impostazioni della Torre.
import { AVVISO_VISIBILITA, TESTO_CONSENSO } from "@/lib/testi-consenso";
import { useTranslations } from "next-intl";

type Phase = "checking" | "no_session" | "form" | "submitting";

/**
 * Schermata a sé (design doc §16), non un pannello sovrapposto: atterraggio
 * dal link di invito del Manutentore (docs/adr/0013). Supabase consegna la
 * sessione nel frammento dell'URL; il client Supabase la rileva da solo
 * (detectSessionInUrl, di default nel browser) prima che questo componente
 * monti — qui si aspetta solo che l'inizializzazione sia finita.
 */
export default function CompletaAccountPage() {
  const router = useRouter();
  const t = useTranslations();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nomeUtente, setNomeUtente] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nomeUtenteError, setNomeUtenteError] = useState<string | null>(null);
  // Una volta impostata con successo, un secondo tentativo (dopo un nome
  // utente già in uso) non deve richiederla di nuovo.
  const [passwordGiaImpostata, setPasswordGiaImpostata] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const supabase = createClient();

      // Il client di @supabase/ssr forza flowType "pkce" (aspetta un
      // ?code= in query string): il link di invito generato lato Admin —
      // senza un client che avvii il flusso — produce invece un redirect
      // "implicito", con i token nel frammento dell'URL
      // (#access_token=...&refresh_token=...), verificato empiricamente
      // contro l'istanza locale. Il rilevamento automatico del client
      // (detectSessionInUrl) non lo consuma: va fatto a mano, una volta
      // sola, prima di chiedere la sessione.
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        // I token non devono restare nell'URL nemmeno per la breve
        // finestra dell'attesa di setSession: rimossi subito, non dopo.
        window.history.replaceState(null, "", window.location.pathname);
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setPhase("no_session");
        return;
      }

      // Chi torna su questo link avendo già completato l'account (o lo
      // riapre per errore) va portato dentro l'app, non davanti a un
      // secondo modulo.
      const me = await getMe(session.access_token);
      if (cancelled) return;

      if (me.status === "ok") {
        router.replace("/");
        return;
      }

      setPhase("form");
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNomeUtenteError(null);

    if (!passwordGiaImpostata) {
      // Allineato a supabase/config.toml (minimum_password_length = 10,
      // password_requirements = "lower_upper_letters_digits"): senza
      // questo controllo il campo passava una password valida qui ma
      // rifiutata da GoTrue con un errore che l'Utente non si aspetta.
      if (
        password.length < 10 ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        setError(
          "La password deve avere almeno 10 caratteri, con almeno una lettera minuscola, una maiuscola e una cifra.",
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Le due password non coincidono.");
        return;
      }
    }

    if (!nomeUtente.trim()) {
      // Il backend valida comunque (CompleteAccountRequest), ma un invio
      // innescato dal browser stesso — es. un autofill password che
      // sottomette il form prima che l'Utente tocchi questo campo — non
      // deve arrivare a una chiamata di rete per un errore rilevabile qui.
      setNomeUtenteError("Il nome utente non può essere vuoto.");
      return;
    }

    setPhase("submitting");
    const supabase = createClient();

    if (!passwordGiaImpostata) {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setPhase("form");
        return;
      }
      setPasswordGiaImpostata(true);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError(t("sessione.scadutaInvito"));
      setPhase("no_session");
      return;
    }

    const result = await completeAccount(session.access_token, nomeUtente);

    switch (result.status) {
      case "ok":
      case "already_completed":
        router.replace("/");
        router.refresh();
        return;
      case "nome_utente_in_uso":
        setNomeUtenteError("Questo nome utente è già in uso.");
        setPhase("form");
        return;
      case "validation_error":
        setNomeUtenteError(result.message);
        setPhase("form");
        return;
      case "error":
        setError(result.message);
        setPhase("form");
        return;
    }
  }

  // A screen of its own, centered on plane 1 of the public layout (design
  // doc §6): none of the three phases is an overlapping panel.
  let content: ReactNode;

  if (phase === "checking") {
    content = <LoadingState label={t("attesa.controlloInvito")} />;
  } else if (phase === "no_session") {
    content = (
      <ErrorState
        title="Link non valido"
        message="Questo link di invito non è più valido o è scaduto. Chiedi al Manutentore di inviartene uno nuovo."
      />
    );
  } else {
    const isSubmitting = phase === "submitting";
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Completa il tuo account</CardTitle>
          <CardDescription>
            Scegli una password e un nome utente. Il nome utente è univoco e non si può cambiare
            in seguito.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error && <ErrorState message={error} />}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {!passwordGiaImpostata && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Conferma password</Label>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="nome-utente">Nome utente</Label>
              <Input
                id="nome-utente"
                name="nome-utente"
                type="text"
                autoComplete="off"
                required
                maxLength={40}
                value={nomeUtente}
                onChange={(event) => setNomeUtente(event.target.value)}
              />
              {/* Design doc §19: errors are text in `ink`, never an alarm color. */}
              {nomeUtenteError && <span className="text-sm text-ink">{nomeUtenteError}</span>}
            </div>

            <Separator />

            <div className="flex flex-col gap-3 text-sm text-ink-soft">
              <p>{AVVISO_VISIBILITA}</p>
              <p>{TESTO_CONSENSO}</p>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("attesa.generica") : "Ho letto e accetto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">{content}</div>
    </div>
  );
}
