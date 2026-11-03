import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { voceDettaglio, vociMie } from "@/lib/dati/letture";
import { contesto } from "@/lib/dati/sessione";
import { ScheletroScheda } from "@/components/states/scheletri";
import { Scheda } from "@/components/libro/scheda";
import { NellaTuaLibreria } from "@/components/libro/nella-tua-libreria";

/**
 * Scheda del libro (design doc §9).
 *
 * La barra, gli errori e la verifica dell'accesso vivono nel guscio
 * (`rotte/libro-guscio.tsx`), che legge la stessa voce: qui la si ritrova già
 * in cache, e si arriva solo quando c'è.
 */
export default function LibroPage() {
  const { id = "" } = useParams();
  const { data: sessione } = useQuery(contesto());
  const { data: result } = useQuery(voceDettaglio(id));

  if (!sessione || result?.status !== "ok") return <ScheletroScheda />;

  const utenteId = sessione.utenteId;

  if (result.data.utenteId === utenteId) {
    return <Scheda voceIniziale={result.data} currentUserId={utenteId} />;
  }

  // "Nella tua libreria" entra nella colonna laterale della scheda invece
  // di stare sotto come una fascia a sé: è l'unico comando della pagina, e
  // in fondo a uno scorrimento lungo non lo trovava nessuno. Per sapere se
  // il libro è già tuo serve l'intera libreria: la scheda, che è il
  // contenuto, non la aspetta.
  return (
    <Scheda
      voceIniziale={result.data}
      currentUserId={utenteId}
      nellaTuaLibreria={<PropriaVoce libroId={result.data.libroId} />}
    />
  );
}

function PropriaVoce({ libroId }: { libroId: string }) {
  const { data: mie } = useQuery(vociMie());
  if (!mie) return null;

  const propriaVoce =
    mie.status === "ok" ? (mie.data.find((v) => v.libroId === libroId) ?? null) : null;

  return <NellaTuaLibreria libroId={libroId} propriaVoce={propriaVoce} />;
}
