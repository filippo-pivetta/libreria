import Link from "next/link";

import { getLibreriaCollegato } from "@/lib/api/utenti";
import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states/error-state";
import { BarraContesto } from "@/components/lettori/barra-contesto";
import { ASSENZE, SESSIONE } from "@/messaggi/it";

/**
 * Layout del contesto di un collegato (design doc §15, emendamento 20
 * agosto 2026): sostituisce per intero la barra globale (già rimossa da
 * `Chrome` per queste rotte) con `BarraContesto`, e fa da unico punto in
 * cui si verifica l'accesso — sia la pagina Libreria che quella Annali
 * (le due schede) ereditano questa verifica, non la ripetono.
 *
 * `params` è una Promise in Next 16 (frontend/AGENTS.md).
 */
export default async function LibreriaCollegatoLayout(
  props: LayoutProps<"/lettori/[id]">,
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState message={SESSIONE.scaduta} />
      </main>
    );
  }

  const result = await getLibreriaCollegato(session.access_token, id);

  if (result.status === "not_found") {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState title="Non trovato" message={ASSENZE.utenteInesistente} />
      </main>
    );
  }
  if (result.status === "non_collegato") {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <div className="flex flex-col items-start gap-3">
          {/* Non "sei stato rimosso", non "errore": una stanza chiusa
              (design doc §15). */}
          <ErrorState
            title="Non più accessibile"
            message={ASSENZE.libreriaChiusa}
          />
          <Link
            href="/readers"
            className="font-ui text-sm text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Torna ai lettori
          </Link>
        </div>
      </main>
    );
  }
  if (result.status === "error") {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState message={result.message} />
      </main>
    );
  }

  return (
    <div data-guest className="flex flex-1 flex-col">
      <BarraContesto utenteId={id} nomeUtente={result.utente.nomeUtente} />
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">{props.children}</main>
    </div>
  );
}
