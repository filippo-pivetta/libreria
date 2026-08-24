const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** Il mese in cui cade il giorno `n` dell'anno, contando 28 giorni a
 * febbraio: serve solo a sapere quali mesi non sono ancora arrivati, e
 * un bisestile sposta il confine di un giorno su un dato che è già una
 * soglia grossolana. */
function meseDelGiorno(giornoDellAnno: number): number {
  const cumulati = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  return cumulati.findIndex((limite) => giornoDellAnno <= limite);
}

/**
 * Pagine mese per mese: la forma dell'anno, che sei numeri scalari non
 * potevano dare. Un anno di lettura è un ritmo, e "5.240 pagine" non
 * distingue chi ha letto tutto a maggio da chi ha letto un po' ogni
 * settimana. È anche ciò che rende sensato sfogliare gli anni: si
 * confrontano profili, non cifre.
 *
 * Un solo accento a piena tinta (§3): dodici barre della stessa
 * grandezza misurata in dodici momenti diversi non sono dodici
 * categorie, quindi non prendono dodici colori né una rampa.
 *
 * Etichetta selettiva: il valore scritto è solo quello del mese più
 * alto. Dodici numeri sopra dodici barre sarebbero una tabella disegnata
 * male, e il compito di un profilo è farsi leggere di colpo.
 */
export function AndamentoMensile({
  paginePerMese,
  giorniTrascorsi,
}: {
  paginePerMese: number[];
  /** Distingue un mese a zero da un mese non ancora arrivato: nel primo
   * caso la barra è assente perché non hai letto, nel secondo perché
   * l'anno non ci è ancora passato. Senza, dicembre di un anno in corso
   * sembrerebbe un mese vuoto. */
  giorniTrascorsi: number;
}) {
  const massimo = Math.max(...paginePerMese);
  const ultimoMese = meseDelGiorno(giorniTrascorsi);

  if (massimo === 0) return null;

  return (
    <div>
      <p className="t-label mb-3.5">Pagine, mese per mese</p>
      <div className="flex h-[141px] items-end gap-1.5 sm:gap-2.5">
        {paginePerMese.map((pagine, i) => {
          const futuro = i > ultimoMese;
          const altezza = massimo > 0 ? Math.round((pagine / massimo) * 120) : 0;
          return (
            <div key={MESI[i]} className="flex h-full flex-1 flex-col justify-end">
              {pagine === massimo && (
                <span className="t-num t-meta mb-1.5 text-center text-[11px]">
                  {pagine.toLocaleString("it-IT")}
                </span>
              )}
              {pagine > 0 ? (
                <span
                  // `flex-none`: senza, la barra è un elemento flex vuoto
                  // e assorbe da sola tutto l'eccesso della colonna con
                  // la didascalia, schiacciandosi proprio sul mese più
                  // alto. Costava il picco del grafico, in silenzio.
                  className="flex-none rounded-t-object bg-accent"
                  style={{ height: `${altezza}px` }}
                />
              ) : (
                <span
                  className={`h-0.5 flex-none rounded-[1px] ${futuro ? "bg-transparent" : "bg-ink/8"}`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line pt-2 sm:gap-2.5">
        {MESI.map((mese, i) => (
          <span
            key={mese}
            className={`t-label flex-1 text-center ${i > ultimoMese ? "text-ink/25" : ""}`}
          >
            {/* Sotto i 640px dodici etichette da 10,5px con la
                spaziatura del maiuscoletto si toccherebbero: una ogni
                tre. Mai una lettera sola, che per "gennaio" e "giugno"
                sarebbe la stessa. */}
            <span className={i % 3 === 0 ? "" : "hidden sm:inline"}>{mese}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
