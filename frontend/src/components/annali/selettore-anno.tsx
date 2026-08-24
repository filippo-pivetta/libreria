"use client";

/** Quanti anni stanno nella finestra. Tre: quello scelto e i suoi due
 * vicini. Con cinque la riga tornava a essere larga quanto la mezza
 * intestazione, che è il difetto che questa finestra esiste per togliere. */
const AMPIEZZA = 3;

/**
 * Il selettore d'anno degli Annali. `annoMinimo`/`annoMassimo` arrivano
 * dal backend (PRD, comportamento #12: "dal primo anno con dati all'anno
 * corrente"); gli anni futuri restano rifiutati lato server anche se qui
 * non compaiono mai.
 *
 * ---------------------------------------------------------------------
 * TRE ANNI, NON TUTTI
 *
 * Prima erano due chevron e un numero, e dell'intervallo dichiarato dal
 * backend usavano solo il permesso di disabilitare un pulsante: chi
 * guardava non sapeva quanti anni avesse dietro. Poi sono diventati
 * tutti, e il problema si è capovolto: a otto anni la riga occupava metà
 * intestazione per una navigazione che si usa di rado, e la sua larghezza
 * cambiava di anno in anno man mano che l'intervallo cresceva.
 *
 * Ora è una finestra di tre che scorre con la selezione. La larghezza è
 * costante, la riga resta piccola, e i due vicini bastano a dire che
 * l'anno sta dentro una serie invece che da solo. Il resto
 * dell'intervallo lo dichiara una riga sotto, "dal 2019", che è
 * l'informazione vera che l'elenco completo dava: dove comincia la
 * storia. Il numero grande dell'intestazione dice già quale anno si
 * guarda, quindi qui non serve ripeterlo in grande.
 *
 * L'anno attivo si segna con inchiostro pieno e filetto, lo stesso
 * linguaggio della voce di navigazione attiva (§5), mai un riempimento.
 * ---------------------------------------------------------------------
 */
export function SelettoreAnno({
  anno,
  annoMinimo,
  annoMassimo,
  onCambiaAnno,
}: {
  anno: number;
  annoMinimo: number;
  annoMassimo: number;
  onCambiaAnno: (anno: number) => void;
}) {
  const totale = annoMassimo - annoMinimo + 1;
  // La finestra è centrata sull'anno scelto finché può, poi si appoggia
  // a un estremo invece di accorciarsi: agli estremi dell'intervallo si
  // continuano a vedere tre anni, non due o uno.
  const primo = Math.min(
    Math.max(anno - Math.floor(AMPIEZZA / 2), annoMinimo),
    Math.max(annoMassimo - AMPIEZZA + 1, annoMinimo),
  );
  const finestra = Array.from({ length: Math.min(AMPIEZZA, totale) }, (_, i) => primo + i);

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-1">
        <Freccia
          verso="‹"
          etichetta="Anno precedente"
          disabilitata={anno <= annoMinimo}
          onClick={() => onCambiaAnno(anno - 1)}
        />

        <div className="flex items-baseline" role="group" aria-label="Anno">
          {finestra.map((a) => {
            const corrente = a === anno;
            return (
              <button
                key={a}
                type="button"
                aria-current={corrente ? "true" : undefined}
                onClick={() => onCambiaAnno(a)}
                className={`t-num relative px-2.5 py-1.5 font-ui text-sm font-medium transition-colors duration-(--dur-micro) ${
                  corrente
                    ? "text-ink after:absolute after:inset-x-1.5 after:bottom-0 after:h-px after:bg-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>

        <Freccia
          verso="›"
          etichetta="Anno successivo"
          disabilitata={anno >= annoMassimo}
          onClick={() => onCambiaAnno(anno + 1)}
        />
      </div>

      {/* Solo quando c'è davvero dell'altro dietro la finestra: su un
          intervallo di tre anni sarebbe una riga che ripete ciò che si
          vede già. */}
      {annoMinimo < primo && (
        <p className="t-meta t-num text-xs">dal {annoMinimo}</p>
      )}
    </div>
  );
}

function Freccia({
  verso,
  etichetta,
  disabilitata,
  onClick,
}: {
  verso: string;
  etichetta: string;
  disabilitata: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={etichetta}
      disabled={disabilitata}
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-field border border-line-strong font-ui text-ink transition-colors duration-(--dur-micro) hover:bg-surface-2 disabled:border-line disabled:text-ink-soft/40 disabled:hover:bg-transparent"
    >
      {verso}
    </button>
  );
}
