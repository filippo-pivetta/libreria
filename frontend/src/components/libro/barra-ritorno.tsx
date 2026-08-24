import { PulsanteEsci } from "@/components/layout/pulsante-esci";

/**
 * Il ritorno alla libreria, su mobile.
 *
 * Non è un affinamento: **prima non c'era.** `ProtectedNav` monta la
 * barra in cima dietro `hidden sm:block`, e sotto i 640px lascia solo i
 * quattro tab in fondo (Libreria, Annali, Lettori, Torre). Su un telefono
 * la scheda di un proprio libro non aveva quindi nessun comando di
 * ritorno: si usciva col gesto di sistema, o toccando "Libreria" in
 * fondo — che non è tornare indietro, è ricominciare da capo, e sullo
 * scaffale perde la posizione di scorrimento da cui si era partiti.
 *
 * Il libro di un COLLEGATO ce l'aveva già, perché lì la barra globale
 * sparisce per intero e al suo posto arriva `BarraContestoLibro` con il
 * suo "‹ [nome]" — cioè la rotta ospite era trattata meglio della
 * propria. Qui si pareggia, con lo stesso pulsante.
 *
 * Solo sotto i 640px (`sm:hidden`): da lì in su la barra globale è già
 * in cima e un secondo ritorno sarebbe rumore.
 */
export function BarraRitorno() {
  return (
    <div
      className="plane-0 sticky top-0 z-30 border-b border-line sm:hidden"
      style={{ paddingTop: "var(--safe-t)" }}
    >
      <div className="flex items-center px-4 py-2.5">
        <PulsanteEsci href="/" label="Libreria" />
      </div>
    </div>
  );
}
