"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancellaArtefatto } from "@/lib/api/preview";
import { generaSintesi, getSintesi, type RiferimentoTema, type Tema } from "@/lib/api/sintesi";
import { getAccessToken } from "@/lib/api/access-token";
import { getMe } from "@/lib/api/me";
import { formattaData } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { Messaggio } from "@/components/ui/messaggio";
import { useLocale, useTranslations } from "next-intl";

const SOGLIA_APPUNTO = 200;

/** I libri distinti dietro un tema, nell'ordine in cui compaiono la
 * prima volta fra i riferimenti — non ordinati per titolo, perché
 * l'ordine dei riferimenti è già quello di rilevanza deciso a monte. */
function libriDistinti(riferimenti: RiferimentoTema[]): { voceId: string; titolo: string }[] {
  const visti = new Set<string>();
  const risultato: { voceId: string; titolo: string }[] = [];
  for (const r of riferimenti) {
    if (visti.has(r.voceId)) continue;
    visti.add(r.voceId);
    risultato.push({ voceId: r.voceId, titolo: r.titolo });
  }
  return risultato;
}

/**
 * Un tema: nome, una frase che lo descrive, i libri da cui viene — e, su
 * richiesta, gli insight o le recensioni veri che l'hanno prodotto.
 *
 * Il nome porta il trattamento `t-label` (design doc §10, lo stesso delle
 * intestazioni di gruppo negli insight): è un'etichetta, non il
 * contenuto. La frase che lo descrive porta invece `t-sentenza`/
 * `t-appunto` a seconda della lunghezza, la stessa soglia e lo stesso
 * carattere di un insight vero — perché lo è nella sostanza: un'
 * osservazione breve, non una didascalia.
 */
function TemaCard({ tema }: { tema: Tema }) {
  const lingua = useLocale();
  const [espanso, setEspanso] = useState(false);
  const libri = libriDistinti(tema.riferimenti);
  const testoLungo = tema.sintesi.length > SOGLIA_APPUNTO;

  return (
    <div className="plane-1 grain flex flex-col gap-3 rounded-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="t-label">{tema.nome}</p>
        <span className="t-meta shrink-0">
          {libri.length} {libri.length === 1 ? "libro" : "libri"}
        </span>
      </div>

      <p className={testoLungo ? "t-appunto" : "t-sentenza"}>{tema.sintesi}</p>

      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        {libri.map((libro, indice) => (
          <span key={libro.voceId} className="flex items-baseline gap-1.5">
            <Link
              href={`/libro/${libro.voceId}`}
              className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              {libro.titolo}
            </Link>
            {indice < libri.length - 1 && <span className="t-meta text-ink-soft">·</span>}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setEspanso((valore) => !valore)}
        className="t-meta self-start underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        {espanso ? "Nascondi gli insight" : "Mostra gli insight"}
      </button>

      {espanso && (
        <ul className="flex flex-col gap-3 border-t border-line pt-3">
          {tema.riferimenti.map((riferimento, indice) => (
            <li key={`${riferimento.voceId}-${indice}`}>
              <Link
                href={`/libro/${riferimento.voceId}`}
                className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {riferimento.titolo}
              </Link>
              <p
                className={
                  riferimento.testo.length > SOGLIA_APPUNTO ? "t-appunto mt-1" : "t-sentenza mt-1"
                }
              >
                {riferimento.testo}
              </p>
              <p className="t-meta mt-1">
                {riferimento.tipo === "recensione" ? "Recensione" : "Insight"} ·{" "}
                {formattaData(riferimento.data, lingua)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * La sintesi tematica trasversale (design doc §27, issue #27, riscritta
 * il 22 agosto 2026 da un unico paragrafo a un elenco di temi con le
 * prove attaccate — un primo giro d'uso ha mostrato che un paragrafo
 * generato non è verificabile, non porta da nessuna parte, e non ha
 * ragione di essere riletto).
 *
 * **Sostituisce, non si accumula** — a differenza della preview
 * personalizzata (`preview-personalizzata.tsx`), che accumula apposta
 * perché un parere per ogni rilettura ha senso. Qui "Genera di nuovo"
 * dice esplicitamente che sostituisce, per non far credere che la
 * vecchia resti da qualche parte.
 *
 * **Nessun tema debole**: il backend non genera (e non sostituisce la
 * sintesi esistente) se non trova almeno un tema che attraversi libri
 * diversi. La pagina distingue i due modi in cui questo succede — non
 * hai ancora scritto nulla, oppure hai scritto ma nulla si collega
 * ancora — con un messaggio diverso per ciascuno.
 *
 * Riusa `cancellaArtefatto` di `lib/api/preview.ts`: è già generico
 * (`DELETE /artefatti/{id}`), nulla di specifico alla preview.
 */
export function SintesiTematica() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const [spenta, setSpenta] = useState(false);
  const [messaggioVuoto, setMessaggioVuoto] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const chiave = ["sintesi-tematica"];

  const { data: sintesi, isLoading } = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getSintesi(token);
      if (result.status === "ok") return result.data;
      if (result.status === "not_found") return null;
      throw new Error(t("errori.sintesiNonLetta"));
    },
  });

  // Solo per sapere se l'interruttore è acceso prima di offrire il
  // comando, stesso pattern di `preview-personalizzata.tsx`.
  const { data: consenso } = useQuery({
    queryKey: ["me", "consenso"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getMe(token);
      return result.status === "ok" ? result.data.consensoElaborazioneAssistita : true;
    },
  });

  const genera = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return generaSintesi(token);
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
      setMessaggioVuoto(null);
    },
    onSuccess: (result) => {
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        return;
      }
      if (result.status === "contenuto_insufficiente" || result.status === "nessun_tema_rilevante") {
        setMessaggioVuoto(result.message);
        return;
      }
      if (result.status !== "ok") {
        setErrore(result.status === "not_found" ? "La sintesi non è arrivata." : result.message);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: chiave });
    },
    onError: () => setErrore("La sintesi non è arrivata. Riprova."),
  });

  const cancella = useMutation({
    mutationFn: async (artefattoId: string) => {
      const token = await getAccessToken();
      const result = await cancellaArtefatto(token, artefattoId);
      if (result.status === "error") throw new Error(result.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chiave }),
    onError: () => setErrore(t("errori.sintesiNonCancellata")),
  });

  const spentaDavvero = spenta || consenso === false;
  const haTemi = !!sintesi && sintesi.temi.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="t-title">Sintesi dei tuoi temi</h1>
        <p className="t-meta max-w-prose">
          I temi che tornano in ciò che hai scritto, quando attraversano libri diversi. Ogni
          nuova sintesi sostituisce quella precedente.
        </p>
      </section>

      {isLoading ? null : haTemi && sintesi ? (
        <div className="flex flex-col gap-6">
          <p className="t-meta">{sintesi.avviso}</p>
          <div className="flex flex-col gap-4">
            {sintesi.temi.map((tema, indice) => (
              <TemaCard key={`${tema.nome}-${indice}`} tema={tema} />
            ))}
          </div>
          <div className="flex gap-2">
            {!spentaDavvero && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => genera.mutate()}
                disabled={genera.isPending}
              >
                {genera.isPending ? t("attesa.cercoTemi") :"Genera di nuovo"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancella.mutate(sintesi.id)}
              disabled={cancella.isPending}
            >
              Cancella
            </Button>
          </div>
        </div>
      ) : spentaDavvero ? (
        <EmptyState
          title="L’elaborazione assistita è spenta"
          description="La sintesi tematica è una delle funzioni che dipendono dal consenso. Riaccendilo dalle impostazioni nella Torre."
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => genera.mutate()}
          disabled={genera.isPending}
        >
          {genera.isPending ? t("attesa.cercoTemi") :"Genera una sintesi"}
        </Button>
      )}

      {/* Sotto entrambi i rami sopra: un tentativo di "Genera di nuovo" su
          una sintesi già esistente può restituire questo messaggio senza
          toccare la sintesi che resta visibile (il backend non sostituisce
          finché non ha un risultato valido). */}
      {messaggioVuoto && <p className="t-meta max-w-prose">{messaggioVuoto}</p>}
      <Messaggio>{errore}</Messaggio>
    </div>
  );
}
