"use client";

import Link from "next/link";

import type { RicercaSemantica as Esito } from "@/lib/api/ricerca-semantica";
import { formattaData } from "@/lib/formato";
import { EmptyState } from "@/components/states/empty-state";
import { useLocale } from "next-intl";

const SOGLIA_APPUNTO = 200;

/**
 * I risultati di una domanda posta ai propri Quaderni (design doc §22).
 *
 * Un risultato è l'insight con accanto il libro da cui viene (§10), non una
 * riga di libro: il testo è il contenuto, il libro è la provenienza.
 *
 * Il modulo si chiamava `ricerca/ricerca-semantica.tsx` e conteneva anche il
 * campo, il titolo di pagina e il paragrafo introduttivo. Il campo è salito
 * in `quaderni.tsx`, perché una domanda e i temi sono due modi di guardare la
 * stessa materia e devono stare sotto lo stesso campo; qui è rimasto ciò che
 * la ricerca produce.
 *
 * **Uno spoiler compare in chiaro**, a differenza di ogni altro elenco: la
 * regola 10 protegge da uno spoiler *altrui*, e qui ogni risultato è già del
 * richiedente (verificato lato server, la ricerca non attraversa mai i
 * contenuti condivisi). Il contrassegno resta accanto a data e tipo, come
 * promemoria di ciò che si è marcato per i propri collegati.
 */
export function Risultati({ esito }: { esito: Esito }) {
  const lingua = useLocale();

  return (
    <div className="flex flex-col gap-4">
      {/* La riga sta SOPRA i risultati, non sotto: chi legge un elenco corto
          deve sapere perché è corto prima di concludere che è tutto. */}
      {esito.indiciIncompleti && (
        <p className="t-meta max-w-prose">
          Gli indici si stanno ricostruendo: questi risultati sono incompleti. Riprova fra qualche
          minuto.
        </p>
      )}

      {esito.risultati.length === 0 && !esito.indiciIncompleti ? (
        <EmptyState
          title="Nessuna corrispondenza"
          description="Non hai ancora scritto nulla che somigli a questa domanda."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {esito.risultati.map((r) => (
            <li key={`${r.tipoContenuto}-${r.contenutoId}`} className="plane-1 grain rounded-card p-4">
              <Link
                href={`/libro/${r.voceId}`}
                className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {r.titolo}
                {r.autori.length > 0 && ` · ${r.autori.join(", ")}`}
              </Link>
              <p className={r.testo.length > SOGLIA_APPUNTO ? "t-appunto mt-2" : "t-sentenza mt-2"}>
                {r.testo}
              </p>
              <p className="t-meta mt-2">
                {r.tipoContenuto === "recensione" ? "Recensione" : "Insight"} ·{" "}
                {formattaData(r.data, lingua)}
                {r.spoiler ? " · spoiler per i tuoi collegati" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
