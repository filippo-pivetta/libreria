import { redirect } from "next/navigation";

import { getMe } from "@/lib/api/me";
import { saluto } from "@/lib/saluto";
import { getCollegamenti } from "@/lib/api/collegamenti";
import { createClient } from "@/lib/supabase/server";
import { Chrome } from "@/components/layout/chrome";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ErrorState } from "@/components/states/error-state";
import { getTranslations } from "next-intl/server";
import { ERRORE_SESSIONE } from "@/lib/api/errore";

/**
 * Guardia di autenticazione dell'area protetta più i dati che la
 * navigazione condivide (nome utente, contatore richieste): quale barra
 * mostrare — quella globale o nessuna, nel contesto di un collegato —
 * è deciso da `Chrome` (design doc §5/§15, emendamento 20 agosto 2026).
 * Il Proxy (src/proxy.ts) fa già da prima linea e redirige prima che
 * questa pagina venga renderizzata; il controllo qui è un secondo
 * livello indipendente, nel caso un matcher del Proxy non copra una
 * rotta — la stessa logica di difesa in profondità già scelta per la
 * RLS lato database, applicata qui lato routing.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // `getClaims` e non `getUser`, per la stessa ragione del Proxy
  // (src/lib/supabase/proxy.ts, docs/adr/0012 emendato il 27 agosto
  // 2026): la firma del token si verifica in locale con WebCrypto,
  // senza interrogare il server di autenticazione. Prima questa riga
  // costava una seconda andata e ritorno di rete DOPO quella già pagata
  // dal Proxy, in serie, su ogni navigazione dell'area protetta.
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims) {
    redirect("/login");
  }

  // Sicuro solo perché getClaims() sopra ha già verificato la firma del
  // token: qui si legge il token già validato, non ci si fida di un
  // cookie non controllato. `getSession` è una lettura locale dei
  // cookie, nessuna chiamata di rete — e legge il token già rinnovato,
  // perché è getClaims a rinnovarlo quando sta per scadere.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // getMe e getCollegamenti non dipendono l'uno dall'altro (il secondo
  // usa solo il token, non il risultato del primo): in parallelo invece
  // che in sequenza, ogni navigazione nell'area protetta risparmia un
  // giro di rete intero rispetto a prima.
  const [me, collegamenti] = session
    ? await Promise.all([getMe(session.access_token), getCollegamenti(session.access_token)])
    : [
        // Nessuna sessione: non si finge una chiamata fallita. `sessione`
        // è il genere giusto, e il suo rimedio — ricaricare — è l'unico
        // che funziona davvero. "Sessione assente." era, oltre che solo
        // italiano, il nome interno di uno stato messo davanti a chi legge.
        { status: "error" as const, errore: ERRORE_SESSIONE },
        { status: "error" as const, errore: ERRORE_SESSIONE },
      ];

  if (me.status === "not_provisioned") {
    // Sessione valida ma account non ancora completato: capita a chi ha
    // chiuso la scheda a metà del completamento dell'invito (docs/adr/0013)
    // e torna più tardi navigando direttamente in un'altra pagina. Non è
    // più un vicolo cieco — la via d'uscita è finire quel passaggio.
    redirect("/completa-account");
  }

  const t = await getTranslations();

  if (me.status !== "ok") {
    return (
      <div className="plane-0-lit flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-sm">
          <ErrorState message={t("sessione.scaduta")} />
        </div>
        <SignOutButton />
      </div>
    );
  }

  // Il contatore delle richieste ricevute accanto a Lettori (design doc
  // §5): un fallimento qui non deve bloccare il layout, a differenza di
  // getMe sopra — il badge resta semplicemente assente.
  const receivedRequestCount =
    collegamenti.status === "ok"
      ? collegamenti.data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe).length
      : undefined;

  return (
    <div className="plane-0-lit flex min-h-screen flex-col">
      {/* Il saluto della Libreria si calcola qui, dove si è già lato
          server e si ha il nome: `Chrome` è un componente client e non
          deve leggere l'ora dal browser (la stessa regola della luce,
          design-frontend.md §3). Come la luce, si aggiorna al cambio
          pagina e non durante una permanenza. */}
      <Chrome
        userName={me.data.nomeUtente}
        saluto={saluto(me.data.nomeUtente)}
        receivedRequestCount={receivedRequestCount}
      >
        {children}
      </Chrome>
    </div>
  );
}
