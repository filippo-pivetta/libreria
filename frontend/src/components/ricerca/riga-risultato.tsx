"use client";

import Link from "next/link";

import type { Risultato } from "@/lib/api/ricerca";
import { Button } from "@/components/ui/button";
import { Messaggio } from "@/components/ui/messaggio";
import { percorsoScheda } from "@/lib/percorso-scheda";
import { useTranslations } from "next-intl";

/**
 * Una riga dei risultati di ricerca.
 *
 * I risultati locali ed esterni si presentano **senza distinzione**, come
 * impone il PRD: nessun badge "già nel sistema", nessuna sezione separata.
 * Ciò che cambia è il verbo, e lo decide la Voce (design doc §13):
 *
 *   nessuna Voce            Aggiungi     (nessuna riga sotto l'autore)
 *   letto o abbandonato     Rileggi      "Letto nel 2023, quattro stelle"
 *   ogni altro stato        Vai al libro "In lettura, pagina 88"
 *
 * "Rileggi" NAVIGA e non apre una Lettura sul posto: aprirla richiede una
 * data, e quella scelta vive già nelle transizioni della scheda del libro
 * (`transizioni-stato.tsx`). La tabella del design fa pensare a un'azione,
 * ma l'azione sarebbe incompleta.
 */

const STELLE = ["", "una stella", "due stelle", "tre stelle", "quattro stelle", "cinque stelle"];

function voto(valore: number | null): string {
  if (valore === null) return "";
  const intero = Math.round(valore);
  const parola = STELLE[intero] ?? `${valore}`;
  // Le mezze stelle non hanno una parola: si dice il numero.
  return Number.isInteger(valore) ? parola : `${valore} stelle`.replace(".", ",");
}

function sottotitolo(risultato: Risultato): string | null {
  const v = risultato.voce;
  if (!v) return null;

  if (v.stato === "letto" || v.stato === "abbandonato") {
    const azione = v.stato === "letto" ? "Letto" : "Abbandonato";
    const quando = v.annoUltimaLettura ? ` nel ${v.annoUltimaLettura}` : "";
    const stelle = voto(v.voto);
    return `${azione}${quando}${stelle ? `, ${stelle}` : ""}`;
  }
  if (v.stato === "in_lettura") {
    return v.paginaCorrente ? `In lettura, pagina ${v.paginaCorrente}` : "In lettura";
  }
  if (v.stato === "in_pausa") return "In pausa";
  return "Da leggere";
}

function annoDi(risultato: Risultato): number | null {
  return risultato.origine === "locale"
    ? risultato.annoPrimaPubblicazione
    : risultato.annoPubblicazione;
}

export function RigaRisultato({
  risultato,
  inCorso,
  errore,
  onAggiungi,
}: {
  risultato: Risultato;
  inCorso: boolean;
  errore: string | null;
  onAggiungi: () => void;
}) {
  const t = useTranslations();
  const autori = risultato.autori.join(", ");
  const anno = annoDi(risultato);
  const riga = sottotitolo(risultato);
  const voce = risultato.voce;

  return (
    <div className="flex items-start gap-3 p-4">
      <Copertina risultato={risultato} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Il titolo è un link alla scheda del libro, il verbo resta il
            verbo: sono due gesti diversi — guardare e prendere — e §13
            vuole che l'aggiunta non porti via dalla ricerca. Fondere i due
            in un unico bersaglio significherebbe scegliere quale dei due
            perdere. */}
        <Link
          href={percorsoScheda(risultato)}
          className="truncate font-display text-base text-ink underline-offset-4 hover:underline"
        >
          {risultato.titolo}
        </Link>
        <span className="truncate font-ui text-sm text-ink-soft">
          {autori || "Autore non indicato"}
          {anno ? ` · ${anno}` : ""}
        </span>
        {riga && <span className="t-meta">{riga}</span>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {voce ? (
          /* `render` e non `buttonVariants` su un `<Link>` nudo: il
             primitivo `Button` di Base UI espone `render`, e il commento
             che diceva il contrario era vecchio di una versione — lo
             stesso file `libro/nella-tua-libreria.tsx` lo usava già così.
             La differenza non è di stile: passando dal primitivo, il link
             prende il cedimento alla pressione, `data-slot="button"` (e
             quindi la regola del tocco) e il fuoco dell'app, che con le
             sole classi restavano fuori. */
          <Button
            render={<Link href={`/libro/${voce.id}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            {voce.stato === "letto" || voce.stato === "abbandonato" ? "Rileggi" : "Vai al libro"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={inCorso} onClick={onAggiungi}>
            {inCorso ? t("attesa.aggiungo") : "Aggiungi"}
          </Button>
        )}
        {/* Errore per riga e non un avviso in cima: in una lista un
            messaggio staccato non dice a quale riga si riferisce. */}
        <Messaggio className="max-w-56 text-right">{errore}</Messaggio>
      </div>
    </div>
  );
}

/**
 * Copertina o segnaposto tipografico.
 *
 * Le miniature dei risultati esterni sono immagini remote di Google: non
 * si scarica né si conserva nulla finché il libro non viene aggiunto —
 * quella è la pipeline in secondo piano, che gira una volta sola per
 * opera. Qui si mostra soltanto.
 *
 * Il back end manda `null` quando il catalogo dichiara di non avere
 * immagini, e serve che sia `null`: un volume senza copertina risponde
 * comunque 200, con un segnaposto grigio, quindi `onError` non
 * scatterebbe mai e si vedrebbe un rettangolo grigio.
 */
function Copertina({ risultato }: { risultato: Risultato }) {
  const colore =
    risultato.origine === "locale" ? risultato.copertinaColoreDominante : null;

  return (
    <span
      className="relative flex h-[72px] w-12 shrink-0 items-end overflow-hidden rounded-object bg-surface-2"
      style={colore ? { backgroundColor: colore } : undefined}
    >
      {risultato.copertinaUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- immagine
           remota di un dominio esterno, non ottimizzabile da next/image */
        <img
          src={risultato.copertinaUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="line-clamp-3 p-1 font-display text-[9px] leading-tight text-ink-soft">
          {risultato.titolo}
        </span>
      )}
    </span>
  );
}
