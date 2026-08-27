"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getMetriche, getMetricheCollegato, type Metriche } from "@/lib/api/metriche";
import { getAccessToken } from "@/lib/api/access-token";
import type { VoceConLibro } from "@/lib/api/voci";
import { CarteMetriche } from "@/components/annali/carte-metriche";
import { IntestazioneAnnali } from "@/components/annali/intestazione-annali";
import { RigaAffiancata } from "@/components/annali/riga-affiancata";
import { LibriInComune } from "@/components/annali/libri-in-comune";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroAnnali } from "@/components/states/scheletri";
import { ERRORE_SERVER, ErroreApp, assenza, erroreDi, regola } from "@/lib/api/errore";
import type { ErroreApi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/**
 * Gli esiti non-ok delle metriche, tradotti in `ErroreApi`.
 *
 * Prima era una `messaggioErrore(result, t)` per file, che scriveva le
 * frasi a mano — "Gli anni futuri non sono selezionabili." era italiano
 * fisso in due copie, e il caso `error` ricadeva su `result.message`,
 * cioè sulla stringa di trasporto. Qui si classifica soltanto: la frase
 * la compone `spiega()` più in basso, dal catalogo.
 */
function erroreDelRisultato(result: {
  status: string;
  errore?: ErroreApi;
}): ErroreApi {
  if (result.status === "anno_futuro") return regola("anno_futuro");
  if (result.status === "non_collegato") return assenza("libreriaChiusa");
  if (result.status === "not_found") return assenza("utenteInesistente");
  return result.errore ?? ERRORE_SERVER;
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
  nomeUtente,
  metricheCollegatoIniziali,
  metrichePropriaIniziale,
  vociProprie,
  vociCollegato,
}: {
  utenteId: string;
  nomeUtente: string;
  metricheCollegatoIniziali: Metriche;
  metrichePropriaIniziale: Metriche | null;
  vociProprie: VoceConLibro[];
  vociCollegato: VoceConLibro[];
}) {
  const spiega = useMessaggioErrore();
  const [anno, setAnno] = useState(metricheCollegatoIniziali.anno);

  const collegatoQuery = useQuery({
    queryKey: ["metriche-collegato", utenteId, anno],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMetricheCollegato(token, utenteId, anno);
      if (result.status !== "ok") throw new ErroreApp(erroreDelRisultato(result));
      return result.data;
    },
    initialData: anno === metricheCollegatoIniziali.anno ? metricheCollegatoIniziali : undefined,
    // Stessa correzione di pagina-annali.tsx: senza `keepPreviousData` il
    // cambio d'anno rimandava `isPending` a vero e faceva sparire la
    // carta per un istante (stesso scatto che `pensiero-che-torna.tsx`
    // documenta e risolve identicamente).
    placeholderData: keepPreviousData,
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
    placeholderData: keepPreviousData,
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
        message={spiega("metricheSueNonCaricate", erroreDi(collegatoQuery.error))}
        onRetry={() => void collegatoQuery.refetch()}
      />
    );
  }

  const metriche = collegatoQuery.data;
  const propria = propriaQuery.data;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <IntestazioneAnnali
        anno={anno}
        annoMinimo={metriche.annoMinimo}
        annoMassimo={metriche.annoMassimo}
        onCambiaAnno={setAnno}
        nomeUtente={nomeUtente}
      />

      <CarteMetriche
        metriche={metriche}
        altrui
        affiancamento={propria ? <RigaAffiancata metriche={propria} /> : undefined}
      />

      <LibriInComune
        vociProprie={vociProprie}
        vociCollegato={vociCollegato}
        nomeUtente={nomeUtente}
      />
    </div>
  );
}
