import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { voceDettaglio, vociMie } from "@/lib/dati/letture";
import { contesto } from "@/lib/dati/sessione";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroScheda } from "@/components/states/scheletri";
import { Scheda } from "@/components/libro/scheda";
import { NellaTuaLibreria } from "@/components/libro/nella-tua-libreria";
import { messaggioErrore } from "@/lib/messaggi-errore-server";

/**
 * Scheda del libro (design doc §9).
 *
 * La barra e la verifica di base dell'accesso vivono nel layout di
 * questa cartella; qui si legge la stessa `voceDettaglio`, che la
 * memoization di richiesta ha già risolto — non è più il secondo fetch
 * identico che era prima.
 */
export default function LibroPage(props: PageProps<"/libro/[id]">) {
  return (
    <Suspense fallback={<ScheletroScheda />}>
      <SchedaDelLibro params={props.params} />
    </Suspense>
  );
}

async function SchedaDelLibro({ params }: { params: PageProps<"/libro/[id]">["params"] }) {
  const { id } = await params;
  const [{ utenteId }, result] = await Promise.all([contesto(), voceDettaglio(id)]);

  if (result.status === "not_found") {
    // Nessuna corsa verso un componente not-found dedicato: un rifiuto
    // indistinguibile da un contenuto inesistente resta testo semplice
    // (PRD, casi limite), non un vicolo cieco di framework.
    const t = await getTranslations();
    return <ErrorState title={t("titoli.nonTrovata")} message={t("assenze.voceNonTua")} />;
  }
  if (result.status === "error") {
    return <ErrorState message={await messaggioErrore("libroNonCaricato", result.errore)} />;
  }

  if (result.data.utenteId === utenteId) {
    return <Scheda voceIniziale={result.data} currentUserId={utenteId} />;
  }

  // "Nella tua libreria" entra nella colonna laterale della scheda invece
  // di stare sotto come una fascia a sé: è l'unico comando della pagina, e
  // in fondo a uno scorrimento lungo non lo trovava nessuno.
  //
  // In un confine di attesa suo: per sapere se il libro è già tuo serve
  // l'intera libreria, ed è l'unica parte di questa pagina che la chiede.
  // Senza, la scheda — che è il contenuto — aspettava un dato che le
  // serve solo per un comando in colonna.
  return (
    <Scheda
      voceIniziale={result.data}
      currentUserId={utenteId}
      nellaTuaLibreria={
        <Suspense fallback={null}>
          <PropriaVoce libroId={result.data.libroId} />
        </Suspense>
      }
    />
  );
}

async function PropriaVoce({ libroId }: { libroId: string }) {
  const mie = await vociMie();
  const propriaVoce =
    mie.status === "ok" ? (mie.data.find((v) => v.libroId === libroId) ?? null) : null;

  return <NellaTuaLibreria libroId={libroId} propriaVoce={propriaVoce} />;
}
