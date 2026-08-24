import { cn } from "@/lib/utils";

/**
 * Il messaggio in linea, accanto al comando che l'ha prodotto.
 *
 * È il canale predefinito dei tre (design doc §19, riscritta nella sessione
 * UI). Prima di questo componente esistevano cinque trattamenti diversi per
 * dire la stessa cosa — toast, testo locale con `useState`, testo per riga,
 * `ErrorState`, e il caso a sé del login — e otto componenti ripetevano a mano
 * `{errore && <p className="t-meta">{errore}</p>}`, ciascuno con la sua idea
 * di dove metterlo e nessuno con un annuncio per i lettori di schermo.
 *
 * Regole che questo primitivo tiene ferme:
 *
 * - **Mai un riquadro rosso.** `alert` ha un uso solo in tutta l'app, il
 *   contatore delle richieste accanto a Lettori (§3). Un errore qui è testo,
 *   e si distingue dalla conferma per l'inchiostro, non per il colore.
 * - **`aria-live="polite"` sempre**, anche sulla conferma. Un messaggio che
 *   compare accanto a un campo è invisibile a chi non guarda lo schermo:
 *   era il buco più silenzioso del vecchio schema.
 * - **`role="status"` e non `role="alert"`**: `alert` interrompe la lettura
 *   in corso, e va riservato al toast, che segnala qualcosa che l'utente non
 *   sta guardando. Qui il messaggio è già sotto gli occhi.
 *
 * Il contenitore resta montato anche quando non c'è nulla da dire: una
 * regione `aria-live` che nasce insieme al suo contenuto spesso non viene
 * annunciata, perché la tecnologia assistiva non fa in tempo a osservarla.
 */
export function Messaggio({
  tono = "errore",
  children,
  className,
}: {
  tono?: "errore" | "conferma";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "t-meta",
        tono === "errore" ? "text-ink" : "text-ink-soft",
        // Vuoto, esce dal flusso invece di sparire.
        //
        // La regione deve restare nel DOM e nell'albero di accessibilità
        // anche quando non ha nulla da dire (vedi sopra), ma un <p> vuoto
        // dentro un contenitore `flex ... gap-*` continua a contare come
        // figlio e si porta dietro il suo `gap`: comparivano spazi vuoti
        // dove prima non c'era alcun elemento. `absolute` la toglie dal
        // flusso senza toglierla agli screen reader — `hidden` invece la
        // rimuoverebbe dall'albero, e diversi lettori non annunciano una
        // regione live che passa da display:none a visibile.
        "empty:absolute",
        className,
      )}
    >
      {children}
    </p>
  );
}
