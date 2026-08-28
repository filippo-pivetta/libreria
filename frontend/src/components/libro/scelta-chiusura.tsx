"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";

import { CampoData } from "@/components/ui/campo-data";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import type { PrecisioneChiusura } from "@/lib/api/voci";
import { cn } from "@/lib/utils";

/**
 * «Quando l'hai finito?», per un libro che si registra come già letto
 * (migrazione 20260827160000).
 *
 * Chi segna oggi un libro letto anni fa sa una di tre cose, e tutte e
 * tre sono legittime: il giorno, solo l'anno, o niente. Le altre app del
 * genere arrivano alla stessa forma per la stessa ragione — Goodreads
 * lascia vuota la data e accetta la sola annata, StoryGraph e Bookwyrm
 * rendono saltabili entrambi i campi, Letterboxd separa il "visto" senza
 * data dalla riga datata del diario. Quello che nessuna fa, e che qui è
 * la regola, è **riempire il buco al posto dell'Utente**: una data di
 * fine dedotta dal giorno dell'inserimento sarebbe plausibile e
 * sbagliata, e finirebbe in una metrica annuale.
 *
 * Il prezzo di ogni gradino è dichiarato sotto la scelta invece di
 * essere scoperto dopo negli Annali, nello stesso spirito con cui la
 * carta dell'anno dichiara i libri senza genere accanto alla classifica
 * (design doc §14) — uno scarto si dice, non si nasconde.
 *
 * Tre pastiglie e non un menù a tendina: sono tre, si leggono tutte
 * insieme, e la scelta è la parte importante del riquadro. Un
 * `RadioGroup` e non tre `Toggle`, perché è una scelta singola e chi
 * ascolta la pagina deve sentirla come tale — il pieno (bordo e sfondo,
 * come ogni "acceso" dell'app, `ui/pastiglia.tsx`) resta l'unico
 * segnale della scelta corrente: niente segno in più, che avrebbe
 * allargato la pastiglia scelta rispetto alle altre due.
 *
 * **"Non ricordo" va per primo, ed è il default.** Chi riempie una
 * libreria storica a ritroso, il caso per cui questo riquadro esiste,
 * più spesso non sa il giorno che sapersi: partire da "Un giorno
 * preciso" chiedeva la risposta più difficile prima delle altre due, e
 * costringeva chi non la sapeva a leggere l'intera fila prima di
 * trovare la propria. L'ordine va quindi dal meno al più preciso — non
 * ricordo, l'anno, il giorno — invece che il contrario.
 *
 * **Affiancate anche sotto i 390px, misurato**: a taglia "comando" (la
 * stessa degli interruttori di spoiler/visibilità) le tre pastiglie
 * misurano insieme più della larghezza disponibile in un riquadro di
 * pagina su un telefono di fascia media, e "Un giorno preciso" andava a
 * capo da solo. Qui bastava restare dentro l'unico sistema di pastiglie
 * dell'app (`ui/pastiglia.tsx`) invece di inventarne un quarto: la
 * taglia "filtro" — la stessa dei filtri dello scaffale, un ruolo non
 * troppo lontano da questo, "restringere ciò che sta sotto" — porta
 * corpo e riquadro più stretti, e con `gap-1.5` al posto di `gap-2` e
 * "Un giorno" al posto di "Un giorno preciso" (il "preciso" lo dice già
 * il contrasto con "Solo l'anno") la somma torna a stare in una riga
 * fino a 360px, la larghezza minima comune. Sotto quella soglia le
 * pastiglie vanno a capo: non c'è una taglia più piccola nel sistema, e
 * romperlo per un caso limite non varrebbe il costo.
 */

const GRADINI: { valore: PrecisioneChiusura; etichetta: string }[] = [
  { valore: "ignota", etichetta: "Non ricordo" },
  { valore: "anno", etichetta: "Solo l’anno" },
  { valore: "giorno", etichetta: "Un giorno" },
];

// Seconda persona, un fatto alla volta, senza il gergo interno di
// `metriche_service` ("pagine senza giorno", "anno di chiusura"): chi
// legge sa cosa sta scegliendo, non come l'app lo calcola.
const CONSEGUENZA: Record<PrecisioneChiusura, string> = {
  giorno: "Lo conti tra i libri finiti di quell’anno, con le pagine nel mese in cui le hai lette.",
  anno: "Lo conti comunque tra i libri finiti di quell’anno, ma le pagine non entrano nel grafico per mese: non hai detto il giorno.",
  ignota: "Resta tra i libri che hai letto, ma non lo conterai in nessun anno.",
};

export function SceltaChiusura({
  precisione,
  onPrecisione,
  data,
  onData,
  anno,
  onAnno,
  oggi,
}: {
  precisione: PrecisioneChiusura;
  onPrecisione: (valore: PrecisioneChiusura) => void;
  data: string;
  onData: (valore: string) => void;
  anno: string;
  onAnno: (valore: string) => void;
  /** Oggi in ISO, calcolato una volta sola da chi chiama: serve come
   * massimo per entrambi i campi. */
  oggi: string;
}) {
  const annoCorrente = oggi.slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <p className="t-body text-sm">Quando l’hai finito?</p>

      <RadioGroup
        value={precisione}
        onValueChange={(valore) => onPrecisione(valore as PrecisioneChiusura)}
        aria-label="Quanto sai della data in cui hai finito il libro"
        className="flex flex-wrap gap-1.5"
      >
        {GRADINI.map((gradino) => (
          <Radio.Root
            key={gradino.valore}
            value={gradino.valore}
            {...attributiPastiglia}
            className={cn(
              pastigliaVariants({ taglia: "filtro", acceso: false }),
              // Come ogni pastiglia accesa dell'app: inchiostro pieno,
              // testo sul piano 1 (ui/pastiglia.tsx). Le classi arrivano
              // dopo quelle di `acceso: false` così vincono per ordine.
              "data-checked:border-ink data-checked:bg-ink data-checked:text-surface-1",
            )}
          >
            {gradino.etichetta}
          </Radio.Root>
        ))}
      </RadioGroup>

      {precisione === "giorno" && (
        // `self-start`: dentro una colonna flex un elemento senza
        // larghezza propria si allunga per lo stretch di default
        // (`align-items: stretch`) — il campo dell'anno lo evita con un
        // `w-fit` esplicito sul proprio contenitore, ma il riquadro di
        // `CampoData` non ne ha uno suo, e senza questo si allargava a
        // tutta la riga con "27/08/2026" isolato a sinistra.
        <div className="self-start">
          <CampoData
            riquadro
            id="data-chiusura"
            ariaLabel="Giorno in cui hai finito il libro"
            value={data}
            max={oggi}
            onChange={onData}
          />
        </div>
      )}

      {precisione === "anno" && (
        <span className="inline-flex w-fit items-center gap-2 rounded-field border border-line-strong bg-surface-1 px-3 py-2">
          <label htmlFor="anno-chiusura" className="t-meta">
            Anno
          </label>
          <input
            id="anno-chiusura"
            type="number"
            inputMode="numeric"
            min={1000}
            max={annoCorrente}
            value={anno}
            onChange={(event) => onAnno(event.target.value)}
            // Stessa lezione del campo delle pagine: le frecce del campo
            // numerico stanno DENTRO la scatola del testo e si prendono
            // una tredicina di pixel, e `ch` è l'avanzamento dello zero
            // proporzionale (0,578em) mentre `tabular-nums` rende ogni
            // cifra a 0,601em — quattro cifre sono 4,16ch, non 4.
            className="w-[4.5ch] border-0 bg-transparent p-0 font-ui text-sm tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
          />
        </span>
      )}

      <p className="t-meta">{CONSEGUENZA[precisione]}</p>
    </div>
  );
}
