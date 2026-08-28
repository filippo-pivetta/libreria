"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  aggiornaConsenso,
  eliminaAccount,
  esportaLibriLetti,
  type IndiciStato,
} from "@/lib/api/me";
import { getAccessToken } from "@/lib/api/access-token";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AVVISO_VISIBILITA,
  EFFETTO_REVOCA,
  EFFETTO_RIATTIVAZIONE,
  NOTE_FUORI_DAL_CONSENSO,
  TESTO_CONSENSO,
} from "@/lib/testi-consenso";
import { Messaggio } from "@/components/ui/messaggio";
import { SceltaLuce } from "@/components/profilo/scelta-luce";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { type PreferenzaLuce } from "@/lib/light";
import { ErroreApp, assenza, erroreDi, regola } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/**
 * Il corpo del Profilo (design doc §17): il tuo account, l'avviso di
 * visibilità, la luce della stanza, il consenso all'elaborazione
 * assistita, l'esportazione dei libri letti, la cancellazione
 * dell'account — in quest'ordine (issue #6, issue #8, ADR 0011 rivisto).
 *
 * L'ordine è un racconto che va da te verso l'esterno e poi fuori: chi
 * sei, chi ti vede, come si vede l'app, cosa l'app fa dei tuoi testi,
 * come porti via i tuoi dati, come te ne vai.
 *
 * La sezione dei collegamenti che stava qui sopra è passata a Lettori,
 * dove stanno le persone: accettare una richiesta non è un'impostazione,
 * ed era anche la cosa più urgente dell'app sepolta accanto a "cancella
 * l'account".
 *
 * **Nessuna finestra di annullamento** come quella dei collegamenti,
 * benché spegnere il consenso cancelli davvero gli indici: interrompere
 * un collegamento non è simmetricamente reversibile (per tornare indietro
 * serve che l'altro accetti), mentre questo interruttore lo è del tutto —
 * riaccendendolo gli indici si ricostruiscono da soli. Un "annulla" su un
 * gesto reversibile è rumore, non prudenza.
 *
 * I due testi lunghi arrivano da `lib/testi-consenso.ts`: sono del PRD,
 * parola per parola, e il design doc vieta di riscriverli in forma più
 * breve o più simpatica.
 */
export function SezioneImpostazioni({
  nomeUtente,
  consensoIniziale,
  indiciStatoIniziale,
  preferenzaLuce,
}: {
  /** Serve solo a verificare lato client che la conferma digitata nella
   * cancellazione coincida: il confronto che conta è comunque rifatto
   * server-side (`DELETE /me`), questo è solo ciò che tiene il pulsante
   * disabilitato. */
  nomeUtente: string;
  consensoIniziale: boolean;
  /** Letta dal cookie nel layout radice e passata giù: il client non legge
   * mai il cookie da sé, perché la palette la calcola il server. */
  preferenzaLuce: PreferenzaLuce;
  /** Stato reale letto da `/me`: senza questo la sezione poteva solo
   * indovinare "in ricostruzione" dal booleano del consenso, senza mai
   * sapere se una ricostruzione precedente fosse davvero finita. */
  indiciStatoIniziale: IndiciStato;
}) {
  const router = useRouter();
  const spiega = useMessaggioErrore();
  const [consenso, setConsenso] = useState(consensoIniziale);
  const [indiciStato, setIndiciStato] = useState(indiciStatoIniziale);
  const [errore, setErrore] = useState<string | null>(null);
  const [erroreExport, setErroreExport] = useState<string | null>(null);
  const [confermaNomeUtente, setConfermaNomeUtente] = useState("");
  const [erroreCancellazione, setErroreCancellazione] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async (valore: boolean) => {
      const token = await getAccessToken();
      const result = await aggiornaConsenso(token, valore);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_provisioned" ? assenza("accountIncompleto") : result.errore,
        );
      }
      return result.data;
    },
    onMutate: (valore: boolean) => {
      // Ottimistico: l'interruttore si muove subito, come ogni comando
      // dell'app, e torna indietro da solo se la scrittura non riesce.
      setErrore(null);
      setConsenso(valore);
    },
    onSuccess: (me) => {
      setConsenso(me.consensoElaborazioneAssistita);
      setIndiciStato(me.indiciStato);
    },
    onError: (err: unknown, valore: boolean) => {
      setConsenso(!valore);
      setErrore(
        spiega("consensoNonCambiato", erroreDi(err)),
      );
    },
  });

  const mutazioneExport = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await esportaLibriLetti(token);
      if (result.status !== "ok") {
        throw new ErroreApp(result.errore);
      }
      return result;
    },
    onMutate: () => setErroreExport(null),
    onSuccess: ({ blob, filename }) => {
      // Nessun link scaricabile dal server: si costruisce qui, si clicca
      // da soli, si libera subito dopo — lo stesso pattern usato per
      // qualunque download avviato da fetch autenticata.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      setErroreExport(
        spiega("fileNonScaricato", erroreDi(err)),
      );
    },
  });

  const mutazioneCancellazione = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await eliminaAccount(token, confermaNomeUtente);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "conferma_non_corrispondente"
            ? regola("conferma_non_corrispondente")
            : result.status === "not_provisioned"
              ? assenza("accountIncompleto")
              : result.errore,
        );
      }
    },
    onMutate: () => setErroreCancellazione(null),
    onSuccess: async () => {
      // La sessione locale va comunque ripulita anche se il backend, a
      // questo punto, non ha più una riga auth.users da cui farla
      // scadere: signOut() non deve poter far fallire una cancellazione
      // già avvenuta (me_service.elimina_account l'ha già eseguita).
      try {
        await createClient().auth.signOut();
      } catch {
        // ignorato deliberatamente
      }
      router.push("/account-eliminato");
    },
    onError: (err: unknown) => {
      setErroreCancellazione(
        spiega("accountNonCancellato", erroreDi(err)),
      );
    },
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Chi sei, e la via d’uscita. Era una didascalia sopra l’elenco dei
          collegamenti ("Sei entrato come …"); ora che la pagina è del solo
          account è la prima sezione e ha il peso di una riga vera. Su
          desktop il nome resta anche in barra, e vederlo due volte nel
          posto giusto non è un difetto. */}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">Il tuo account</h2>
        <div className="plane-1 grain flex items-center gap-4 rounded-card p-4">
          <span className="font-ui text-sm font-medium text-ink">{nomeUtente}</span>
          <span className="ml-auto">
            <SignOutButton />
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="t-section">Chi vede cosa</h2>
        <p className="t-meta max-w-prose">{AVVISO_VISIBILITA}</p>
      </section>

      {/* La luce della stanza. §17 diceva "quattro cose e basta" e non
          prevedeva alcun comando sulla luce, "che non è una preferenza ma una
          conseguenza dell’ora": diventano cinque. Sta qui, prima
          dell’elaborazione assistita, perché è la sola impostazione che non
          riguarda i dati — cambia come si vede l’app, non cosa l’app fa dei
          tuoi testi. */}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">Luce della stanza</h2>
        <p className="t-meta max-w-prose">
          La stanza si scurisce da sé, dal mattino alla notte. Se la preferisci ferma,
          scegli il giorno o la notte.
        </p>
        <SceltaLuce iniziale={preferenzaLuce} />
      </section>

      {/* IL COMANDO PRIMA DEL TESTO.

          Prima l'occhio incontrava trecentosettanta battute di informativa
          e solo dopo l'interruttore, con altri tre paragrafi sotto: per
          sapere se il consenso fosse acceso bisognava leggere un muro.
          Ora legge nell'ordine in cui serve — che cos'è, com'è messo
          adesso, e poi il testo del PRD per intero.

          Non una parola in meno di quel testo: §17 lo dichiara
          intoccabile, ed è la base di un consenso informato. Solo non più
          di traverso al comando. */}
      <section className="flex flex-col gap-3">
        <h2 className="t-section">Elaborazione assistita</h2>
        <div className="plane-1 grain flex flex-col gap-3.5 rounded-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="font-ui text-sm font-medium text-ink">
                {consenso ? "Attiva" : "Spenta"}
              </p>
              <p className="t-meta">
                {!consenso
                  ? "Pareri, suggerimenti, temi e ricerca nei quaderni sono spenti."
                  : indiciStato === "in_ricostruzione"
                    ? "Gli indici si stanno ricostruendo: finché non hanno finito, la ricerca nei quaderni trova meno di quanto hai scritto."
                    : "La ricerca nei quaderni copre tutto ciò che hai scritto."}
              </p>
            </div>
            <Switch
              checked={consenso}
              onCheckedChange={(valore) => mutazione.mutate(valore)}
              disabled={mutazione.isPending}
              aria-label="Consenti l’elaborazione assistita"
            />
          </div>
          <div className="border-t border-line" />
          <p className="max-w-prose font-ui text-sm text-ink">{TESTO_CONSENSO}</p>
          <p className="t-meta max-w-prose">
            {consenso ? EFFETTO_REVOCA : EFFETTO_RIATTIVAZIONE}
          </p>
          <p className="t-meta max-w-prose">{NOTE_FUORI_DAL_CONSENSO}</p>
          <Messaggio>{errore}</Messaggio>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="t-section">Una copia dei libri letti</h2>
        <p className="t-meta max-w-prose">
          Un CSV con i libri che hai segnato come letti: titolo, autori, generi, date di lettura,
          voto e recensione. Insight e note di intenzione restano fuori.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => mutazioneExport.mutate()}
          disabled={mutazioneExport.isPending}
        >
          Scarica CSV
        </Button>
        <Messaggio>{erroreExport}</Messaggio>
      </section>

      {/* ZONA DI PERICOLO.

          §17 diceva "non è un pulsante rosso… il rosso, in quest'app, vuol
          dire una cosa sola, ed è il contatore delle richieste". Quella
          regola cambia qui, e cambia in un punto solo: `alert` acquista un
          SECONDO uso, il bordo di questo riquadro. Non un terzo — resta
          vietato sugli errori, sui nastri e su qualunque pulsante.

          Il rosso sta sul BORDO e non sul testo per una ragione misurata,
          non estetica: `alert` su `surface-1` tiene 4.57:1 nel punto peggiore
          dell'anno (scripts/check-contrast.mts, ora verificato anche su
          questo accostamento). Sopra il 3:1 che AA chiede a un componente
          d'interfaccia, ma con appena sette centesimi di margine sul 4.5:1
          del testo: sette centesimi non sono un margine, sono una
          coincidenza. Il titolo resta in `ink`.

          Il pulsante resta `outline` e non diventa rosso: la difficoltà
          sta dove §17 la mette, cioè nel dover scrivere il proprio nome
          utente, e un pulsante rosso in fondo a una pagina non ha mai
          fermato nessuno che non fosse già stato fermato da quello. */}
      <section className="mt-4 flex flex-col gap-2 border-t border-line pt-8">
        <div className="plane-1 grain zona-pericolo flex flex-col gap-3 rounded-card p-4">
          <div className="flex flex-col gap-1">
            <h2 className="t-section">Cancellazione dell&apos;account</h2>
            <p className="t-meta max-w-prose">
              Immediata e definitiva: non c’è un ripensamento, e non resta una copia da
              nessuna parte. Porta via libreria, letture, voti, recensioni, insight, note e
              collegamenti. Scrivi «{nomeUtente}» per confermare.
            </p>
          </div>
          <div className="flex max-w-sm items-center gap-2">
            <Input
              value={confermaNomeUtente}
              onChange={(event) => setConfermaNomeUtente(event.target.value)}
              placeholder={nomeUtente}
              aria-label="Nome utente di conferma"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutazioneCancellazione.mutate()}
              disabled={confermaNomeUtente !== nomeUtente || mutazioneCancellazione.isPending}
            >
              Elimina l&apos;account
            </Button>
          </div>
          <Messaggio>{erroreCancellazione}</Messaggio>
        </div>
      </section>
    </div>
  );
}
