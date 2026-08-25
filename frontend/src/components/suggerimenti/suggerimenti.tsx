"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RigaRisultato } from "@/components/ricerca/riga-risultato";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/api/access-token";
import { cercaNeiCataloghi, cercaNelCatalogo, type Risultato } from "@/lib/api/ricerca";
import {
  generaSuggerimenti,
  NOTA_LUNGHEZZA_MASSIMA,
  type Suggerimento,
} from "@/lib/api/suggerimenti";
import { useAggiungiRisultato } from "@/lib/hooks/use-aggiungi-risultato";
import { Messaggio } from "@/components/ui/messaggio";
import { useTranslations } from "next-intl";

const MINIMA_LUNGHEZZA_TOKEN_AUTORE = 4;

// Stessa soglia di `insight-lista.tsx`/`ricerca-semantica.tsx`: sotto,
// trattamento "sentenza" senza troncamento; sopra, "appunto" troncato a
// otto righe con "Mostra tutto".
const SOGLIA_APPUNTO = 200;

/**
 * Vero se il cognome di almeno un autore coincide fra quanto dichiarato
 * e quanto dice davvero un risultato di ricerca. Equivalente TypeScript
 * di `risoluzione.autori_compatibili` usato lato backend
 * (`suggerimenti_service._autori_si_sovrappongono`): stesso motivo,
 * niente sottostringa fra nomi interi ("Michail" non è sottostringa di
 * "Mikhail"), il confronto è per parola.
 */
function condividonoAutore(dichiarati: string[], verificati: string[]): boolean {
  if (dichiarati.length === 0) return true;
  const token = (nomi: string[]) =>
    new Set(
      nomi.flatMap((n) => n.toLowerCase().split(/\s+/).filter((t) => t.length >= MINIMA_LUNGHEZZA_TOKEN_AUTORE)),
    );
  const tokenDichiarati = token(dichiarati);
  const tokenVerificati = token(verificati);
  for (const t of tokenDichiarati) {
    if (tokenVerificati.has(t)) return true;
  }
  return false;
}

/**
 * Una riga di suggerimento, risolta contro i cataloghi.
 *
 * Stesso procedimento di `/aggiungi` (design doc §13): prima il catalogo
 * locale ("per prime perché non richiedono una chiamata esterna"), e
 * solo se non trova nulla i cataloghi esterni. A differenza di
 * `RicercaLibri`, che tiene tutti i risultati di una ricerca, qui basta
 * il primo: il titolo l'ha già scelto il modello, non c'è una lista fra
 * cui l'Utente debba scegliere.
 *
 * Il backend ha già verificato che il titolo esiste da qualche parte
 * (`suggerimenti_service._verifica_e_diversifica`): questa ricerca non
 * decide più se mostrare un comando "Aggiungi", lo trova quasi sempre.
 * Il ramo di solo testo resta come margine di sicurezza — fra la verifica
 * del backend e questa ricerca un risultato esterno può scadere dalla
 * cache — mai come esito atteso.
 */
function SuggerimentoRiga({ suggerimento }: { suggerimento: Suggerimento }) {
  const queryClient = useQueryClient();
  // Chiave stabile per la coppia titolo/autori; i due termini di ricerca
  // sotto sono diversi apposta, non la stessa stringa incollata due volte.
  const chiave = ["suggerimento-risoluzione", suggerimento.titolo, ...suggerimento.autori];

  const locale = useQuery({
    queryKey: [...chiave, "locale"],
    queryFn: async () => {
      // Solo il titolo: `cerca_libri` confronta l'intera stringa
      // ricevuta come un blocco solo (titolo O autore, non un AND), e
      // "Titolo Autore" insieme non è sottostringa di nessuno dei due —
      // stesso bug corretto lato backend in
      // `suggerimenti_service._esiste_nei_cataloghi` il 22 agosto 2026,
      // qui sul lato che mostra invece che su quello che verifica.
      const risultato = await cercaNelCatalogo(await getAccessToken(), suggerimento.titolo);
      return risultato.status === "ok" ? risultato.data : [];
    },
  });

  const esterno = useQuery({
    queryKey: [...chiave, "esterno"],
    enabled: locale.isSuccess && locale.data.length === 0,
    queryFn: async () => {
      // `intitle:`, non testo libero: una ricerca a testo libero su
      // Google Books è una ricerca di rilevanza, non un confronto, e
      // restituisce quasi sempre qualcosa anche per un titolo che non
      // c'entra. `intitle:` da solo non basta però (osservato il 22
      // agosto 2026, generando suggerimenti veri): "La peste" trova
      // prima un'edizione scolastica ("La peste di Albert Camus" di
      // Lucile Lhoste, una guida di lettura) del romanzo vero di Camus.
      // Il rischio qui non è mostrare "Aggiungi" su un fantasma (il
      // backend l'ha già escluso — `suggerimenti_service.
      // _esiste_nei_cataloghi`), ma mostrare la copertina e l'autore di
      // UN ALTRO libro sotto la motivazione di questo: si tiene solo il
      // primo risultato il cui autore coincide con quanto dichiarato,
      // non semplicemente il primo della lista.
      const termine = `intitle:"${suggerimento.titolo}"`;
      const risultato = await cercaNeiCataloghi(await getAccessToken(), termine);
      if (risultato.status !== "ok") return [];
      return risultato.data.filter((r) => condividonoAutore(suggerimento.autori, r.autori));
    },
  });

  const risolto: Risultato | null = locale.data?.[0] ?? esterno.data?.[0] ?? null;
  const daLocale = (locale.data?.length ?? 0) > 0;

  const [errore, setErrore] = useState<string | null>(null);
  const [espansa, setEspansa] = useState(false);
  const motivazioneLunga = suggerimento.motivazione.length > SOGLIA_APPUNTO;

  const aggiunta = useAggiungiRisultato({
    onSuccess: ({ voce, libroId }) => {
      setErrore(null);
      if (!risolto) return;
      if (daLocale) {
        queryClient.setQueryData<Risultato[]>([...chiave, "locale"], (precedenti) =>
          precedenti?.map((r) => (r === risolto ? { ...r, voce } : r)),
        );
      } else {
        queryClient.setQueryData<Risultato[]>([...chiave, "esterno"], (precedenti) =>
          precedenti?.map((r) => (r === risolto ? { ...r, voce, libroId } : r)),
        );
      }
    },
    onError: (err) => setErrore(err.message),
  });

  return (
    <li className="plane-1 grain rounded-card p-4">
      {risolto ? (
        <RigaRisultato
          risultato={risolto}
          inCorso={aggiunta.isPending}
          errore={errore}
          onAggiungi={() => aggiunta.mutate(risolto)}
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-base text-ink">{suggerimento.titolo}</span>
          {suggerimento.autori.length > 0 && (
            <span className="font-ui text-sm text-ink-soft">{suggerimento.autori.join(", ")}</span>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-col gap-1">
        {/* Solo "scoperta" si etichetta: "affine" è l’esito atteso e non
            ha bisogno di dirlo, un’etichetta su ogni riga sarebbe rumore
            (design doc, evitare un’informazione mostrata due volte). */}
        {suggerimento.tipo === "scoperta" && <span className="t-meta text-ink-soft">Scoperta</span>}
        {/* Stesso trattamento tipografico di un insight vero (§10): la
            motivazione non è più metadato, è una spiegazione elaborata
            che merita Literata invece di Inter Tight. Stessa soglia e
            stesso clamp/espandi di `insight-lista.tsx`. */}
        <p
          className={motivazioneLunga ? "t-appunto" : "t-sentenza"}
          data-clamped={motivazioneLunga && !espansa ? "" : undefined}
        >
          {suggerimento.motivazione}
        </p>
        {motivazioneLunga && !espansa && (
          <button
            type="button"
            onClick={() => setEspansa(true)}
            className="t-meta self-start underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Mostra tutto
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Suggerimenti di lettura (design doc §13, era §23 quando aveva una pagina
 * sua): titoli proposti a partire dal solo storico personale, mai da quello
 * dei collegati.
 *
 * **Non è più una pagina.** Stava su `/suggerimenti`, raggiungibile solo da
 * un disclosure chiuso in mezzo ai filtri della Libreria, e nasceva vuota.
 * Ora è la seconda corsia di "Aggiungi un libro": a monte il catalogo, che sa
 * già cosa cerchi, qui il modello, che prova a indovinarlo. Ci si arriva
 * dall'unica azione primaria della Libreria — il pulsante più visibile della
 * pagina più visitata dell'app — invece che da un cassetto.
 *
 * Effimeri per scelta di prodotto: nessuna persistenza, ogni pressione
 * del pulsante ne genera di nuovi. `POST /suggerimenti` costa una
 * chiamata al modello, quindi non parte da sola al caricamento della
 * pagina (a differenza della sintesi, che rilegge l'ultima già salvata).
 */
export function Suggerimenti() {
  const t = useTranslations();
  const [suggerimenti, setSuggerimenti] = useState<Suggerimento[] | null>(null);
  const [spenta, setSpenta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const genera = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return generaSuggerimenti(token, nota);
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: (result) => {
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        setSuggerimenti(null);
        return;
      }
      if (result.status !== "ok") {
        setErrore(result.message);
        return;
      }
      setSuggerimenti(result.data);
    },
    onError: () => setErrore("I suggerimenti non sono arrivati. Riprova."),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Seconda corsia di "Aggiungi un libro", non più una pagina a sé: il
          bisogno è identico a quello della corsia sopra — voglio un libro
          nuovo — solo senza un titolo già in testa. Una carta e non una
          sezione nuda: prima erano quattro corpi tipografici impilati
          (etichetta, meta, campo, pulsante) senza che nulla li tenesse
          insieme; ora sono due sole famiglie e tre corpi soli — titolo in
          Fraunces, il resto in Inter Tight — sullo stesso oggetto che il
          resto della pagina usa per un pensiero compiuto. */}
      <section className="plane-1 grain flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <p className="t-title text-[22px]">Se non hai un titolo in mente</p>
          <p className="t-body max-w-[62ch]">
            Cinque proposte tratte dal tuo scaffale e da ciò che hai annotato leggendo. Nessuno
            storico che non sia il tuo, nessun libro che hai già.
          </p>
        </div>
        {/* Campo e comando sullo stesso rigo, come il modulo di Quaderni
            (§22): un desiderio è facoltativo, non un modulo a sé da aprire. */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="t-meta">Un desiderio, se ne hai uno</span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={NOTA_LUNGHEZZA_MASSIMA}
              placeholder="Qualcosa di breve. Niente romanzi russi, per una volta."
              aria-label="Una preferenza per questa richiesta di suggerimenti"
              className="w-full border-0 border-b border-line bg-transparent pb-1.5 font-ui text-[15px] text-ink outline-none placeholder:text-ink-soft focus:border-ink"
            />
          </label>
          <Button variant="outline" onClick={() => genera.mutate()} disabled={genera.isPending}>
            {genera.isPending
              ? t("attesa.penso")
              : suggerimenti
                ? "Proponi altri cinque titoli"
                : "Proponi cinque titoli"}
          </Button>
        </div>
        <p className="t-meta">Durano quanto la pagina: non vengono conservati.</p>
      </section>

      <Messaggio>{errore}</Messaggio>

      {spenta && (
        <EmptyState
          title="L’elaborazione assistita è spenta"
          description="I suggerimenti di lettura sono una delle funzioni che dipendono dal consenso. Riaccendilo dal tuo profilo."
        />
      )}

      {suggerimenti && suggerimenti.length === 0 && !spenta && (
        <EmptyState
          title="Nessun suggerimento"
          description="Non c’è ancora abbastanza storico per proporti qualcosa di onesto."
        />
      )}

      {suggerimenti && suggerimenti.length > 0 && (
        <ul className="flex flex-col gap-3">
          {suggerimenti.map((suggerimento) => (
            <SuggerimentoRiga key={`${suggerimento.titolo}-${suggerimento.autori.join(",")}`} suggerimento={suggerimento} />
          ))}
        </ul>
      )}
    </div>
  );
}
