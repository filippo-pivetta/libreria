"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { RigaRisultato } from "@/components/ricerca/riga-risultato";
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

const LUNGHEZZA_MINIMA = 2;
const CHIAVE_LOCALE = "ricerca-catalogo";
const CHIAVE_ESTERNA = "ricerca-cataloghi";

export function RicercaLibri() {
  const [termine, setTermine] = useState("");
  const [errorePerRiga, setErrorePerRiga] = useState<{ chiave: string; messaggio: string } | null>(
    null,
  );
  const queryClient = useQueryClient();

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
      if (risultato.status !== "ok") throw new Error(risultato.message);
      return risultato.data;
    },
  });

  const esterni = useQuery({
    queryKey: [CHIAVE_ESTERNA, cercato],
    enabled: attivo,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const risultato = await cercaNeiCataloghi(await getAccessToken(), cercato);
      if (risultato.status === "error") throw new Error(risultato.message);
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
      setErrorePerRiga({ chiave: risultato.chiave, messaggio: errore.message });
    },
  });

  const caricando = attivo && (locali.isFetching || esterni.isFetching);
  const risposteArrivate = attivo && !locali.isFetching && !esterni.isFetching;
  const vicoloCieco = risposteArrivate && !fonteIrraggiungibile && risultati.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="ricerca" className="t-label">
          Aggiungi un libro
        </label>
        {/* Un campo solo, senza selettore di modalità: il PRD è netto,
            non esistono altre vie d'ingresso, né codice né scansione. */}
        <input
          id="ricerca"
          type="search"
          autoFocus
          value={termine}
          onChange={(event) => setTermine(event.target.value)}
          placeholder="Titolo o autore"
          className="field-line w-full max-w-lg border-0 border-b border-line bg-transparent px-0 py-2 font-display text-lg text-ink outline-none placeholder:text-ink-soft"
        />
      </div>

      {locali.isError && (
        <ErrorState
          message={locali.error instanceof Error ? locali.error.message : "Ricerca non riuscita."}
          onRetry={() => void locali.refetch()}
        />
      )}

      {fonteIrraggiungibile && (
        /* Testo e non un riquadro d'allarme (regole di scrittura,
           AGENTS.md). I risultati locali restano visibili sotto: sono
           quelli che non dipendono dalla fonte caduta. */
        <p className="max-w-prose text-sm text-ink-soft">
          I cataloghi esterni non rispondono. Qui sotto ci sono solo le schede già nel sistema.
        </p>
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

      {caricando && <p className="t-meta">cerco nei cataloghi…</p>}

      {vicoloCieco && <VicoloCieco termine={cercato} />}

      {!attivo && (
        <p className="max-w-prose text-sm text-ink-soft">
          Cerca per titolo o autore. Le schede già nel sistema compaiono per prime, seguite dai
          cataloghi esterni.
        </p>
      )}
    </div>
  );
}
