"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getMetriche, getMetricheCollegato, type Metriche } from "@/lib/api/metriche";
import { getAccessToken } from "@/lib/api/access-token";
import type { VoceConLibro } from "@/lib/api/voci";
import { CartaQuestAnno } from "@/components/annali/carta-questanno";
import { CarteMetriche } from "@/components/annali/carte-metriche";
import { SelettoreAnno } from "@/components/annali/selettore-anno";
import { LibriInComune } from "@/components/annali/libri-in-comune";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { ASSENZE, ERRORI } from "@/messaggi/it";

function messaggioErrore(result: { status: string; message?: string }): string {
  if (result.status === "non_collegato") return ASSENZE.libreriaChiusa;
  if (result.status === "not_found") return ASSENZE.utenteInesistente;
  if (result.status === "anno_futuro") return "Gli anni futuri non sono selezionabili.";
  if (result.status === "error" && result.message) return result.message;
  return ERRORI.metricheSueNonCaricate;
}

/**
 * Scheda Annali di un collegato (design-frontend.md §15, docs/rimandato-
 * annali-collegato.md, issue #7). La stessa card delle proprie metriche
 * (`CarteMetriche`, riusata identica — "un secondo sistema visivo per
 * gli stessi dati raddoppierebbe il lavoro e dimezzerebbe il
 * riconoscimento"), calcolata sui suoi dati, più ciò che è in più
 * rispetto a guardare le proprie: l'affiancamento con le tue metriche
 * dello stesso anno e i libri letti in comune con i voti affiancati.
 * Nessun punteggio di affinità, nessuna classifica fra utenti — il PRD
 * esclude ogni interazione sociale oltre la visione reciproca.
 */
export function PaginaAnnaliCollegato({
  utenteId,
  metricheCollegatoIniziali,
  metrichePropriaIniziale,
  vociProprie,
  vociCollegato,
}: {
  utenteId: string;
  metricheCollegatoIniziali: Metriche;
  metrichePropriaIniziale: Metriche | null;
  vociProprie: VoceConLibro[];
  vociCollegato: VoceConLibro[];
}) {
  const [anno, setAnno] = useState(metricheCollegatoIniziali.anno);

  const collegatoQuery = useQuery({
    queryKey: ["metriche-collegato", utenteId, anno],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMetricheCollegato(token, utenteId, anno);
      if (result.status !== "ok") throw new Error(messaggioErrore(result));
      return result.data;
    },
    initialData: anno === metricheCollegatoIniziali.anno ? metricheCollegatoIniziali : undefined,
  });

  // Le proprie metriche dello stesso anno, solo per l'affiancamento: non
  // esiste un endpoint dedicato per questo pezzo, e un fallimento qui non
  // deve far sparire la scheda — la card semplicemente non compare. Chiave diversa da
  // quella della pagina Annali propria (["metriche", anno]): stesso
  // dato ma un contratto d'errore diverso (qui l'errore diventa `null`,
  // là rilancia), tenerle distinte evita che TanStack Query confonda le
  // due semantiche su una cache condivisa.
  const propriaQuery = useQuery({
    queryKey: ["metriche-affiancata", anno],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMetriche(token, anno);
      return result.status === "ok" ? result.data : null;
    },
    initialData: anno === metricheCollegatoIniziali.anno ? metrichePropriaIniziale : undefined,
  });

  if (collegatoQuery.isPending) return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroAnnali />
      </div>
    );
  if (collegatoQuery.isError) {
    return (
      <ErrorState
        message={
          collegatoQuery.error instanceof Error
            ? collegatoQuery.error.message
            : ERRORI.metricheSueNonCaricate
        }
        onRetry={() => void collegatoQuery.refetch()}
      />
    );
  }

  const metriche = collegatoQuery.data;
  const propria = propriaQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="t-title text-xl">Annali</p>
        <SelettoreAnno
          anno={anno}
          annoMinimo={metriche.annoMinimo}
          annoMassimo={metriche.annoMassimo}
          onCambiaAnno={setAnno}
        />
      </div>

      <CarteMetriche
        metriche={metriche}
        cartaAffiancata={
          propria ? <CartaQuestAnno titolo="Tu, nello stesso anno" metriche={propria} /> : undefined
        }
      />

      <LibriInComune vociProprie={vociProprie} vociCollegato={vociCollegato} />
    </div>
  );
}
