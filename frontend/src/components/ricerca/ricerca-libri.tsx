"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { RigaRisultato } from "@/components/ricerca/riga-risultato";
import { CampoRicerca } from "@/components/ui/campo-ricerca";
import { VicoloCieco } from "@/components/ricerca/vicolo-cieco";
import { ErrorState } from "@/components/states/error-state";
import { getAccessToken } from "@/lib/api/access-token";
import {
  cercaNeiCataloghi,
  cercaNelCatalogo,
  type Risultato,
  type RisultatoEsterno,
  type RisultatoLocale,
  type VoceDelRisultato,
} from "@/lib/api/ricerca";
import { useAggiungiRisultato } from "@/lib/hooks/use-aggiungi-risultato";
import { useDebounced } from "@/lib/use-debounce";
import { ErroreApp } from "@/lib/api/errore";
import { erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { useTranslations } from "next-intl";

const LUNGHEZZA_MINIMA = 2;
const CHIAVE_LOCALE = "ricerca-catalogo";
const CHIAVE_ESTERNA = "ricerca-cataloghi";

export function RicercaLibri() {
  const [termine, setTermine] = useState("");
  const [errorePerRiga, setErrorePerRiga] = useState<{ chiave: string; messaggio: string } | null>(
    null,
  );
  const queryClient = useQueryClient();
  const t = useTranslations();
  const spiega = useMessaggioErrore();

  const cercato = useDebounced(termine.trim(), 350).trim();
  const attivo = cercato.length >= LUNGHEZZA_MINIMA;

  // Due query e non una: la ricerca locale è una query sul database, quella
  // esterna una chiamata a Google. Il design doc §13 vuole le schede già
  // nel sistema "per prime perché non richiedono una chiamata esterna" —
  // prime nel TEMPO, non solo nell'ordine — e una query sola sarebbe lenta
  // quanto la sua fonte più lenta.
  const locali = useQuery({
    queryKey: [CHIAVE_LOCALE, cercato],
    enabled: attivo,
    // La lista non sbianca tra un tasto e l'altro: è metà della velocità
    // percepita che il design chiede.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const risultato = await cercaNelCatalogo(await getAccessToken(), cercato);
      if (risultato.status !== "ok") throw new ErroreApp(risultato.errore);
      return risultato.data;
    },
  });

  const esterni = useQuery({
    queryKey: [CHIAVE_ESTERNA, cercato],
    enabled: attivo,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const risultato = await cercaNeiCataloghi(await getAccessToken(), cercato);
      if (risultato.status === "error") throw new ErroreApp(risultato.errore);
      // "Non ha risposto" non è un errore da rilanciare: è uno stato che
      // l'interfaccia deve saper dichiarare, mostrando comunque i locali.
      return risultato;
    },
  });

  const fonteIrraggiungibile = esterni.data?.status === "fonte_irraggiungibile";

  const risultati: Risultato[] = useMemo(() => {
    const daLocali: RisultatoLocale[] = locali.data ?? [];
    const daEsterni: RisultatoEsterno[] =
      esterni.data?.status === "ok" ? esterni.data.data : [];

    // Si scarta un risultato esterno SOLO se il suo libro è già reso sopra.
    // Un esterno già noto al catalogo ma non trovato dalla ricerca locale
    // (tipico: si cerca in italiano e la scheda esiste col titolo
    // originale) resta, con la sua Voce e il suo verbo: è la differenza
    // tra collassare i duplicati e perdere risultati.
    const resi = new Set(daLocali.map((r) => r.libroId));
    return [...daLocali, ...daEsterni.filter((r) => r.libroId === null || !resi.has(r.libroId))];
  }, [locali.data, esterni.data]);

  /**
   * Sostituisce sul posto la riga appena aggiunta, in ENTRAMBE le liste.
   *
   * Non si invalidano le query: rifare `ricerca-cataloghi` costerebbe una
   * chiamata a Google e potrebbe restituire un ordine diverso, mentre il
   * design chiede l'opposto — "chi popola la libreria ne aggiunge cinque
   * di fila senza perdere i risultati". Lo scaffale invece si invalida,
   * perché lì il libro nuovo deve comparire.
   */
  /**
   * Sostituisce sul posto la riga appena aggiunta, in ENTRAMBE le liste.
   *
   * Non si invalidano le query di ricerca: rifare `ricerca-cataloghi`
   * costerebbe una chiamata a Google e potrebbe restituire un ordine
   * diverso, mentre il design chiede l'opposto — "chi popola la libreria
   * ne aggiunge cinque di fila senza perdere i risultati". L'hook
   * condiviso invalida già `["voci"]`, perché lo scaffale deve mostrare
   * il libro nuovo.
   */
  function rattoppa(chiave: string, voce: VoceDelRisultato, libroId: string) {
    queryClient.setQueryData<RisultatoLocale[]>([CHIAVE_LOCALE, cercato], (precedenti) =>
      precedenti?.map((r) => (r.chiave === chiave ? { ...r, voce } : r)),
    );
    queryClient.setQueryData<{ status: string; data?: RisultatoEsterno[] }>(
      [CHIAVE_ESTERNA, cercato],
      (precedenti) => {
        if (!precedenti || precedenti.status !== "ok" || !precedenti.data) return precedenti;
        return {
          ...precedenti,
          data: precedenti.data.map((r) => (r.chiave === chiave ? { ...r, voce, libroId } : r)),
        };
      },
    );
  }

  const aggiunta = useAggiungiRisultato({
    onSuccess: ({ chiave, voce, libroId }) => {
      setErrorePerRiga(null);
      rattoppa(chiave, voce, libroId);
    },
    onError: (errore, risultato) => {
      // Errore per riga e non un toast: in una lista un toast non dice a
      // quale riga si riferisce (stesso presidio di `elenco-lettori.tsx`).
      //
      // Mai `errore.message`: su un `ErroreApp` quello è "server:HTTP 500",
      // cioè il genere e il codice, che esistono per i log. La frase si
      // compone dal catalogo.
      setErrorePerRiga({
        chiave: risultato.chiave,
        messaggio: spiega("libroNonAggiunto", erroreDi(errore)),
      });
    },
  });

  const caricando = attivo && (locali.isFetching || esterni.isFetching);
  const risposteArrivate = attivo && !locali.isFetching && !esterni.isFetching;
  const vicoloCieco = risposteArrivate && !fonteIrraggiungibile && risultati.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Un campo solo, senza selettore di modalità: il PRD è netto, non
          esistono altre vie d’ingresso, né codice né scansione.

          `max-w-lg` è caduto (26 agosto 2026). Il campo si fermava a
          512px su una colonna da 1024: sotto di lui la lista dei
          risultati arrivava al bordo, quindi il campo che li produce era
          largo la metà di ciò che produce, e il taglio cadeva in un punto
          che nessun altro elemento della pagina condivide. Su questa
          pagina il campo È la pagina — `taglia="insegna"` lo dice, e la
          larghezza deve dire la stessa cosa. */}
      <CampoRicerca
        id="ricerca"
        autoFocus
        taglia="insegna"
        valore={termine}
        onCambia={setTermine}
        etichetta="Cerca un libro per titolo o autore"
        segnaposto="Titolo o autore"
      />

      {locali.isError && (
        <ErrorState
          message={spiega("ricercaNonRiuscita", erroreDi(locali.error))}
          onRetry={() => void locali.refetch()}
        />
      )}

      {fonteIrraggiungibile && (
        /* Testo e non un riquadro d'allarme (regole di scrittura,
           AGENTS.md). I risultati locali restano visibili sotto: sono
           quelli che non dipendono dalla fonte caduta. */
        <p className="max-w-prose text-sm text-ink-soft">{t("avvisi.cataloghiMuti")}</p>
      )}

      {risultati.length > 0 && (
        <div className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
          {risultati.map((risultato) => (
            <RigaRisultato
              key={risultato.chiave}
              risultato={risultato}
              inCorso={aggiunta.isPending && aggiunta.variables?.chiave === risultato.chiave}
              errore={errorePerRiga?.chiave === risultato.chiave ? errorePerRiga.messaggio : null}
              onAggiungi={() => aggiunta.mutate(risultato)}
            />
          ))}
        </div>
      )}

      {caricando && <p className="t-meta">{t("attesa.cercoCataloghi")}</p>}

      {vicoloCieco && <VicoloCieco termine={cercato} />}

      {!attivo && (
        /* Prima diceva come si cerca ("per titolo o autore") e in che
           ordine arrivano i risultati — cose che un lettore non deve
           sapere, e la seconda annunciava a schermo la divisione
           locale/esterno che il PRD chiede di non mostrare ("presentati
           insieme, senza distinzione"). Resta la sola cosa che non si può
           indovinare: che la ricerca esce dall'app. */
        <p className="max-w-prose text-sm text-ink-soft">
          Qui la ricerca esce dalla stanza: va per tutti i cataloghi, non soltanto fra i libri
          che qualcuno, qui, ha già letto.
        </p>
      )}
    </div>
  );
}
