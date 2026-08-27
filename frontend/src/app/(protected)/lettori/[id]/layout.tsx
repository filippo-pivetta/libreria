import Link from "next/link";

import { getLibreriaCollegato } from "@/lib/api/utenti";
import { accettaLinguaInoltrata } from "@/lib/api/lingua-richiesta";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states/error-state";
import { BarraContesto } from "@/components/lettori/barra-contesto";
import { getTranslations } from "next-intl/server";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

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
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState message={t("sessione.scaduta")} />
      </main>
    );
  }

  const result = await getLibreriaCollegato(session.access_token, id, await accettaLinguaInoltrata());

  if (result.status === "not_found") {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState title={t("titoli.nonTrovato")} message={t("assenze.utenteInesistente")} />
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
            title={t("titoli.nonPiuAccessibile")}
            message={t("assenze.libreriaChiusa")}
          />
          {/* Era un comando testuale sottolineato: in una pagina che è un
              vicolo cieco, l'unica via d'uscita non può avere il peso più
              leggero della scala. */}
          <Button render={<Link href="/readers" />} nativeButton={false} variant="outline">
            Torna ai lettori
          </Button>
        </div>
      </main>
    );
  }
  if (result.status === "error") {
    return (
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">
        <ErrorState message={await messaggioErrore("metricheSueNonCaricate", result.errore)} />
      </main>
    );
  }

  const n = result.voci.length;
  const sottotitolo = `${n} ${n === 1 ? "volume" : "volumi"}`;

  return (
    <div data-guest className="flex flex-1 flex-col">
      <BarraContesto utenteId={id} nomeUtente={result.utente.nomeUtente} sottotitolo={sottotitolo} />
      <main className="sotto-la-barra mx-auto w-full max-w-5xl flex-1 px-4 py-5 text-ink sm:p-6">{props.children}</main>
    </div>
  );
}
