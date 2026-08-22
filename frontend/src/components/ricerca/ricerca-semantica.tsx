"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";

import { cercaSemantica, type RicercaSemantica as Esito } from "@/lib/api/ricerca-semantica";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaData } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";

const SOGLIA_APPUNTO = 200;

/**
 * Ricerca semantica sui propri insight e sulle proprie recensioni
 * (design doc §25).
 *
 * Tre stati distinti, e distinguerli è il punto della schermata:
 * nessun risultato, funzione spenta, indici in ricostruzione. Il PRD
 * vieta di confonderli — "l'interfaccia dichiara che la funzione è
 * disattivata, invece di restituire zero risultati come se non ci fosse
 * nulla da trovare", e "finché non sono pronti la ricerca semantica è
 * incompleta e lo dichiara".
 *
 * Un risultato è l'insight con accanto il libro da cui viene (§10), non
 * una riga di libro: la vista trasversale degli insight resta rinviata,
 * e questa non è una vista di navigazione.
 *
 * Non cerca mentre si digita, a differenza del campo dello scaffale:
 * ogni interrogazione è una chiamata al fornitore, e una domanda in
 * linguaggio naturale si finisce di scrivere prima di volerla porre.
 */
export function RicercaSemantica() {
  const [domanda, setDomanda] = useState("");
  const [spenta, setSpenta] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async (testo: string) => {
      const token = await getAccessToken();
      return cercaSemantica(token, testo);
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: (result) => {
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        setEsito(null);
        return;
      }
      if (result.status === "error") {
        setErrore(result.message);
        return;
      }
      setEsito(result.data);
    },
    onError: () => setErrore("Non è stato possibile cercare. Riprova."),
  });

  function invia(evento: FormEvent) {
    evento.preventDefault();
    const testo = domanda.trim();
    if (testo.length < 2) return;
    mutazione.mutate(testo);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="t-title">Cerca nei tuoi insight</h1>
        <p className="t-meta max-w-prose">
          Cerca per significato dentro ciò che hai scritto, non per parola esatta. Solo i tuoi
          testi: quelli dei tuoi collegati restano fuori.
        </p>
      </section>

      <form onSubmit={invia} className="flex items-end gap-3">
        <label className="flex-1">
          <span className="sr-only">Cosa cerchi</span>
          <input
            type="search"
            value={domanda}
            onChange={(e) => setDomanda(e.target.value)}
            placeholder="Che cosa ho scritto sul tempo?"
            aria-label="Cerca nei tuoi insight"
            className="w-full border-0 border-b border-line bg-transparent pb-1 font-ui text-base text-ink outline-none placeholder:text-ink-soft focus:border-ink"
          />
        </label>
        <Button type="submit" disabled={mutazione.isPending || domanda.trim().length < 2}>
          Cerca
        </Button>
      </form>

      {errore && <p className="t-meta">{errore}</p>}

      {spenta && (
        <EmptyState
          title="L'elaborazione assistita è spenta"
          description="La ricerca semantica è una delle funzioni che dipendono dal consenso. Riaccendilo dalle impostazioni nella Torre e gli indici si ricostruiscono da soli."
        />
      )}

      {esito?.indiciIncompleti && (
        <p className="t-meta max-w-prose">
          Gli indici si stanno ricostruendo: questi risultati sono incompleti. Riprova fra
          qualche minuto.
        </p>
      )}

      {esito && esito.risultati.length === 0 && !esito.indiciIncompleti && (
        <EmptyState
          title="Nessuna corrispondenza"
          description="Non hai ancora scritto nulla che somigli a questa domanda."
        />
      )}

      {esito && esito.risultati.length > 0 && (
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
              {/* La regola 10 protegge da uno spoiler ALTRUI: qui ogni
                  risultato è già tuo (mai di un collegato — verificato
                  lato server), quindi il testo si vede sempre. Il
                  contrassegno resta visibile come promemoria di ciò che
                  hai marcato per i tuoi collegati. */}
              <p
                className={r.testo.length > SOGLIA_APPUNTO ? "t-appunto mt-2" : "t-sentenza mt-2"}
              >
                {r.testo}
              </p>
              <p className="t-meta mt-2">
                {r.tipoContenuto === "recensione" ? "Recensione" : "Insight"} ·{" "}
                {formattaData(r.data)}
                {r.spoiler ? " · spoiler per i tuoi collegati" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
