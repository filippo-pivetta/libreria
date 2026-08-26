"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getVicini, type Scritto } from "@/lib/api/scritti";
import { getAccessToken } from "@/lib/api/access-token";
import { formattaData } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { IconaCoperto, IconaLucchetto } from "@/components/ui/icone";
import { RiferimentoLibro } from "@/components/ui/riferimento-libro";
import { useLocale } from "next-intl";

/** Soglia fra i due trattamenti tipografici (design doc §10): sotto,
 * "sentenza" a misura stretta e senza troncamento; sopra, "appunto" alla
 * misura piena, troncato a otto righe. La stessa costante di
 * `libro/insight-lista.tsx`, e deve restare la stessa: un insight non può
 * cambiare faccia a seconda della pagina che lo mostra. */
const SOGLIA_SENTENZA = 200;

/**
 * Un proprio scritto — insight o recensione — con accanto il libro da cui
 * viene. È LA carta dei Quaderni, la stessa sotto tutte e tre le lenti:
 * sfogliando, fra i risultati di una domanda, dentro un tema.
 *
 * ---------------------------------------------------------------------------
 * NEL PIEDE UN DATO, NON UN COMANDO RIPETUTO.
 *
 * Il piede porta «N vicini» e non «Vicini a questo». La differenza non è
 * di parole: su venti carte, venti pulsanti identici sono rumore che
 * l'occhio impara a saltare, mentre un numero è informazione — dice che
 * quel pensiero ha compagnia, ed è già di per sé il segnale che la
 * funzione esiste per dare. Le carte che non hanno vicini non mostrano
 * nulla, quindi la riga non compare nemmeno venti volte su venti.
 *
 * `vicini === null` non è `0`: a consenso revocato gli indici sono
 * cancellati, e uno zero direbbe "questo pensiero non ha compagnia",
 * cosa che in quel momento nessuno sa (`lib/api/scritti.ts`).
 *
 * ---------------------------------------------------------------------------
 * LO SPOILER COMPARE IN CHIARO, la visibilità è un segno.
 *
 * La regola 10 del PRD protegge da uno spoiler *altrui*, e qui ogni riga
 * è già del richiedente (verificato lato server: le funzioni SQL filtrano
 * `utente_id = auth.uid()`). Il contrassegno resta però leggibile accanto
 * a tipo e data, come promemoria di ciò che si è marcato per i propri
 * collegati — insieme al lucchetto di "solo tuo", perché §10 vuole
 * entrambi scanditi dall'occhio e non dedotti aprendo qualcosa. Prima
 * usciva solo lo spoiler: la stessa carta mostrava un segno su due.
 */
export function CartaScritto({
  scritto,
  onApriLibro,
}: {
  scritto: Scritto;
  /** Chiamato quando si apre un vicino: serve alla lente che sta sopra
   * per sapere che la selezione è cambiata. Facoltativo. */
  onApriLibro?: () => void;
}) {
  const lingua = useLocale();
  const [espansa, setEspansa] = useState(false);
  const [viciniAperti, setViciniAperti] = useState(false);

  const isAppunto = scritto.testo.length > SOGLIA_SENTENZA;

  // Nessuna chiamata al fornitore dietro questa richiesta: l'embedding di
  // partenza è già in tabella, il confronto è locale al database. È il
  // motivo per cui si può aprire senza pensarci, a differenza di una
  // domanda scritta nel campo.
  const { data: vicini, isLoading: viciniInCorso } = useQuery({
    queryKey: ["vicini", scritto.contenutoId],
    enabled: viciniAperti,
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await getVicini(token, scritto.contenutoId);
      return esito.status === "ok" ? esito.data.vicini : [];
    },
  });

  return (
    <article
      className="plane-1 grain flex flex-col gap-3 rounded-card p-5"
      // Aprendo i vicini la carta prende tutta la riga della griglia:
      // ciò che esce è la CODA di questo pensiero, non un secondo elenco
      // che gli sta accanto, e a mezza colonna si leggerebbe come tale.
      style={viciniAperti ? { gridColumn: "1 / -1" } : undefined}
    >
      {/* Era una riga sottolineata identica ai comandi della stessa carta.
          Ora è una pastiglia: un dato con dentro un rimando, non un'azione
          (vedi `ui/riferimento-libro.tsx`). */}
      <RiferimentoLibro
        voceId={scritto.voceId}
        titolo={scritto.titolo}
        autori={scritto.autori}
        onClick={onApriLibro}
      />

      <div className="min-w-0">
        <p
          className={isAppunto ? "t-appunto" : "t-sentenza max-w-[34ch]"}
          data-clamped={isAppunto && !espansa ? "" : undefined}
        >
          {scritto.testo}
        </p>
        {isAppunto && !espansa && (
          <Button variant="quiet" size="testo" className="mt-2" onClick={() => setEspansa(true)}>
            Mostra tutto
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-t border-line pt-3">
        <span className="t-meta flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {scritto.tipoContenuto === "recensione" ? "Recensione" : "Insight"} ·{" "}
          {formattaData(scritto.data, lingua)}
          {scritto.visibilita === "privato" && (
            <>
              <span aria-hidden>·</span>
              <IconaLucchetto aria-hidden className="size-3.5 opacity-70" />
              solo tuo
            </>
          )}
          {scritto.spoiler && (
            <>
              <span aria-hidden>·</span>
              <IconaCoperto aria-hidden className="size-3.5 opacity-70" />
              coperto per i collegati
            </>
          )}
        </span>

        {scritto.vicini !== null && scritto.vicini > 0 && (
          <Button
            variant="quiet"
            size="testo"
            aria-expanded={viciniAperti}
            onClick={() => setViciniAperti((aperti) => !aperti)}
            className={viciniAperti ? "text-ink decoration-ink" : undefined}
          >
            {viciniAperti
              ? "Nascondi i vicini"
              : `${scritto.vicini} ${scritto.vicini === 1 ? "vicino" : "vicini"}`}
          </Button>
        )}
      </div>

      {viciniAperti && (
        <div className="pannello flex flex-col gap-5 border-l border-line-strong pl-6">
          <p className="t-label">
            {scritto.vicini} {scritto.vicini === 1 ? "vicino" : "vicini"} a questo pensiero
          </p>

          {viciniInCorso && <p className="t-meta">Cerco…</p>}

          {vicini?.length === 0 && !viciniInCorso && (
            <p className="t-meta max-w-prose">
              Gli indici non hanno più questo pensiero. Riprova fra qualche minuto.
            </p>
          )}

          {vicini?.map((vicino) => (
            <div key={vicino.contenutoId} className="flex flex-col gap-1.5">
              <RiferimentoLibro
                voceId={vicino.voceId}
                titolo={vicino.titolo}
                autori={vicino.autori}
              />
              <p
                className={
                  vicino.testo.length > SOGLIA_SENTENZA ? "t-appunto" : "t-sentenza max-w-[34ch]"
                }
                data-clamped={vicino.testo.length > SOGLIA_SENTENZA ? "" : undefined}
              >
                {vicino.testo}
              </p>
              <p className="t-meta">
                {vicino.tipoContenuto === "recensione" ? "Recensione" : "Insight"} ·{" "}
                {formattaData(vicino.data, lingua)}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
